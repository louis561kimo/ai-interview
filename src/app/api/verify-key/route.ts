/**
 * POST /api/verify-key — 驗證使用者的 API 金鑰（設定頁按「儲存」時呼叫）。
 *
 * 與 /api/interview 相同，金鑰以 LLM_HEADERS 中的 HTTP 標頭帶上。
 * 伺服器向供應商查詢所選模型的資訊：查得到代表金鑰有效且帳號能使用該模型。
 * 這個請求不產生內容、不花費 token；金鑰用完即丟棄，不儲存也不記錄。
 *
 * 回應：{ ok: true } 或 { ok: false, error: "可直接顯示的中文訊息" }
 */
import { LlmError, verifyKey } from "@/lib/llm";
import {
  checkKeyFormat,
  isAllowedModel,
  isProvider,
  LLM_HEADERS,
  PROVIDERS,
  type VerifyKeyResponse,
} from "@/lib/providers";

function jsonResponse(body: VerifyKeyResponse, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const provider = request.headers.get(LLM_HEADERS.provider);
  const apiKey = request.headers.get(LLM_HEADERS.apiKey)?.trim() ?? "";
  const model = request.headers.get(LLM_HEADERS.model);

  // ── 1. 基本格式檢查，不合格就不必浪費一次對外請求 ──
  if (!isProvider(provider)) {
    return jsonResponse({ ok: false, error: "請選擇 AI 供應商" }, 400);
  }
  const keyError = checkKeyFormat(provider, apiKey);
  if (keyError) return jsonResponse({ ok: false, error: keyError }, 400);
  if (!isAllowedModel(provider, model)) {
    return jsonResponse({ ok: false, error: "不支援的模型" }, 400);
  }

  // ── 2. 實際向供應商查詢，確認金鑰有效 ──
  try {
    await verifyKey({ provider, apiKey, model });
    return jsonResponse({ ok: true });
  } catch (error) {
    if (!(error instanceof LlmError)) {
      // 走到這裡的是程式內部錯誤（SDK 錯誤都已轉成 LlmError），只記錄類型與訊息，
      // 不記錄完整物件或請求標頭，避免金鑰寫進 log
      console.error("[verify-key]", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
      return jsonResponse({ ok: false, error: "驗證時發生錯誤，請稍後再試。" }, 500);
    }
    // 使用者此時就在設定頁，改用不含「請到設定頁」字樣、針對驗證情境的訊息
    const label = PROVIDERS[provider].label;
    const messages: Record<number, string> = {
      401: `這組 ${label} API 金鑰無效，請確認是否完整複製，或金鑰是否已被撤銷。`,
      403: `這組金鑰沒有權限使用 ${model}，請換一個模型或確認金鑰的權限設定。`,
      404: `你的 ${label} 帳號目前無法使用 ${model}，請換一個模型再試。`,
      429: "驗證請求太頻繁，請稍候幾秒再按一次儲存。",
    };
    return jsonResponse(
      { ok: false, error: messages[error.status] ?? error.message },
      error.status,
    );
  }
}
