/**
 * 伺服器端的 LLM 呼叫層：把「Anthropic 或 OpenAI」的差異包在這裡，
 * 讓 API route 只需要呼叫 generate()，不必關心是哪一家。
 *
 * 安全原則：
 * - 只使用使用者這次請求帶來的金鑰，不讀取任何伺服器環境變數中的金鑰
 * - 每次請求都建立新的 client，金鑰不會被快取或跨請求共用
 * - 錯誤只記錄類型與狀態碼，絕不把金鑰寫進 log
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Provider } from "@/lib/providers";

/** 與供應商無關的對話訊息格式 */
export type LlmMessage = { role: "user" | "assistant"; content: string };

export type GenerateOptions = {
  provider: Provider;
  apiKey: string;
  model: string;
  system: string;
  messages: LlmMessage[];
  /** 提供時，模型會依此 JSON Schema 輸出 JSON 字串（用於評分結論） */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
};

/** 已整理成可直接顯示給使用者的錯誤，status 為建議回傳的 HTTP 狀態碼 */
export class LlmError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// 支援 Anthropic 伺服器端備援（fallbacks: "default"）的模型；其他模型不送此參數
const ANTHROPIC_FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

/**
 * 驗證金鑰是否有效、且帳號能使用所選模型。
 * 使用兩家的「查詢模型資訊」API（models.retrieve），不產生任何文字、不花費 token。
 * 金鑰無效會得到 401，帳號無權使用該模型會得到 403 / 404，
 * 都會被轉成 LlmError 拋出；成功則不回傳任何值。
 * 注意：這無法檢查帳號餘額，額度不足要到實際出題時才會出現錯誤。
 */
export async function verifyKey({
  provider,
  apiKey,
  model,
}: Pick<GenerateOptions, "provider" | "apiKey" | "model">) {
  try {
    if (provider === "anthropic") {
      await new Anthropic({ apiKey, authToken: null }).models.retrieve(model);
    } else {
      await new OpenAI({ apiKey, organization: null, project: null }).models.retrieve(model);
    }
  } catch (error) {
    throw toLlmError(error);
  }
}

/** 依 provider 呼叫對應的 API，回傳模型輸出的純文字 */
export async function generate(options: GenerateOptions): Promise<string> {
  try {
    return options.provider === "anthropic"
      ? await generateWithAnthropic(options)
      : await generateWithOpenAI(options);
  } catch (error) {
    throw toLlmError(error);
  }
}

async function generateWithAnthropic({
  apiKey,
  model,
  system,
  messages,
  jsonSchema,
}: GenerateOptions) {
  // 明確傳入 apiKey 並把 authToken 設為 null，SDK 就不會改讀環境變數中的憑證
  const client = new Anthropic({ apiKey, authToken: null });
  const useFallback = ANTHROPIC_FALLBACK_MODELS.has(model);

  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    // 主模型因安全分類器拒答時，由 Anthropic 建議的備援模型接手
    ...(useFallback && {
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
    }),
    system,
    // effort 控制思考深度與花費；medium 在品質與速度間取得平衡
    output_config: {
      effort: "medium",
      ...(jsonSchema && { format: { type: "json_schema", schema: jsonSchema.schema } }),
    },
    messages,
  });

  // 拒答時不應讀取 content
  if (response.stop_reason === "refusal") {
    throw new LlmError("模型拒絕回應此請求，請調整職缺描述或回答內容後再試。", 422);
  }
  // 回應可能包含 thinking 等其他區塊，只取出 text 區塊
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new LlmError("模型沒有回傳內容，請再試一次。", 502);
  return text;
}

async function generateWithOpenAI({
  apiKey,
  model,
  system,
  messages,
  jsonSchema,
}: GenerateOptions) {
  // 明確傳入 apiKey，並把 organization / project 設為 null，避免讀取環境變數
  const client = new OpenAI({ apiKey, organization: null, project: null });

  const completion = await client.chat.completions.create({
    model,
    max_completion_tokens: 16000,
    // developer 訊息相當於 system prompt
    messages: [{ role: "developer", content: system }, ...messages],
    // Structured Outputs：strict 模式保證輸出完全符合 JSON Schema
    ...(jsonSchema && {
      response_format: {
        type: "json_schema",
        json_schema: { name: jsonSchema.name, schema: jsonSchema.schema, strict: true },
      },
    }),
  });

  const message = completion.choices[0]?.message;
  if (message?.refusal) {
    throw new LlmError("模型拒絕回應此請求，請調整職缺描述或回答內容後再試。", 422);
  }
  if (completion.choices[0]?.finish_reason === "length") {
    throw new LlmError("模型輸出超過長度上限，請再試一次。", 502);
  }
  const text = message?.content?.trim();
  if (!text) throw new LlmError("模型沒有回傳內容，請再試一次。", 502);
  return text;
}

/**
 * 把兩家 SDK 的錯誤統一轉成 LlmError（中文訊息 + HTTP 狀態碼）。
 * 兩個 SDK 的錯誤類別名稱相同，依序由具體到一般判斷。
 */
function toLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error;

  // 只記錄錯誤類型與狀態碼，不記錄完整物件，確保金鑰不會出現在 log
  const status = error instanceof Anthropic.APIError || error instanceof OpenAI.APIError
    ? error.status
    : undefined;
  console.error("[llm]", error instanceof Error ? error.name : "UnknownError", status ?? "");

  const is = <K extends "AuthenticationError" | "PermissionDeniedError" | "NotFoundError" | "RateLimitError" | "BadRequestError">(
    name: K,
  ) => error instanceof Anthropic[name] || error instanceof OpenAI[name];

  if (is("AuthenticationError")) {
    return new LlmError("API 金鑰無效，請到「設定」頁確認金鑰是否正確。", 401);
  }
  if (is("PermissionDeniedError")) {
    return new LlmError("這組金鑰沒有權限使用所選的模型，請到「設定」頁更換模型或金鑰。", 403);
  }
  if (is("NotFoundError")) {
    return new LlmError("找不到所選的模型，你的帳號可能無法使用它，請到「設定」頁更換模型。", 404);
  }
  if (is("RateLimitError")) {
    return new LlmError("已達你帳號的用量上限或請求太頻繁，請確認帳號額度後稍後再試。", 429);
  }
  if (is("BadRequestError")) {
    return new LlmError("模型不接受這次的請求，請到「設定」頁換一個模型再試。", 400);
  }
  if (error instanceof Anthropic.APIError || error instanceof OpenAI.APIError) {
    return new LlmError(`AI 服務錯誤（${status ?? "連線失敗"}），請稍後再試。`, 502);
  }
  return new LlmError("伺服器發生錯誤，請稍後再試。", 500);
}
