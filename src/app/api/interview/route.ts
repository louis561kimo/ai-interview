/**
 * POST /api/interview — AI 模擬面試的後端 API（BYOK 模式）。
 *
 * BYOK：使用者在「設定」頁填入自己的 Anthropic 或 OpenAI API 金鑰，金鑰存在瀏覽器，
 * 每次呼叫時以 HTTP 標頭（見 LLM_HEADERS）帶上。伺服器只用這把金鑰轉呼叫 AI 供應商，
 * 不儲存、不記錄，也不使用任何伺服器端環境變數中的金鑰。
 *
 * 設計：此 API 為「無狀態」，伺服器不儲存任何面試紀錄。
 * 前端每次呼叫都會帶上職缺描述、題數（totalQuestions）與目前為止的完整對話紀錄，
 * 後端依「已回答的題數」決定這一輪要做什麼：
 *   - 已答 0 ~ totalQuestions-1 題 → 請模型出下一題（可追問上一題）
 *   - 已答 totalQuestions 題       → 請模型產生評分、評論與逐題檢討
 */
import {
  DEFAULT_QUESTION_COUNT,
  isQuestionCount,
  type ChatTurn,
  type Evaluation,
  type InterviewResponse,
} from "@/lib/interview";
import { generate, LlmError, type LlmMessage } from "@/lib/llm";
import {
  checkKeyFormat,
  isAllowedModel,
  isProvider,
  LLM_HEADERS,
  PROVIDERS,
} from "@/lib/providers";

// 輸入長度上限：避免過長的內容造成費用暴增或濫用
const MAX_JD_LENGTH = 8000;
const MAX_ANSWER_LENGTH = 4000;

/**
 * 面試官的角色設定，出題與評分兩種請求共用。
 * 題數由使用者選擇，所以做成函式依 total 產生。
 */
function systemPrompt(total: number) {
  return `你是一位資深、專業且友善的面試官，正在為下方職缺進行模擬面試。
規則：
- 全程使用繁體中文。
- 面試共 ${total} 題。題目必須緊扣職缺描述中的職責與技能要求，並盡量涵蓋不同面向。
- 每次只輸出一個問題本身，不要加上題號、開場白、評論或解說。
- 從第 2 題起，可以針對候選人上一題的回答追問（例如回答模糊、缺乏實例時），也可以換一個新的面向出題，由你判斷哪個更能評估候選人。`;
}

/**
 * 評分結論的 JSON Schema，逐題檢討的筆數依 total 而定。
 * 透過兩家供應商的 Structured Outputs 強制模型依此格式輸出，
 * 確保回傳內容一定能被 JSON.parse 並符合前端的 Evaluation 型別。
 * 所有欄位皆 required 且 additionalProperties: false，符合 OpenAI strict 模式的要求。
 */
const evaluationSchema = (total: number) => ({
  type: "object",
  properties: {
    score: {
      type: "integer",
      description: "1 到 10 的整數，10 分為最佳",
    },
    comment: {
      type: "string",
      description: "整體評論：候選人所有回答與該職缺的契合度",
    },
    questionReviews: {
      type: "array",
      description: `逐題檢討，依題目順序排列，恰好 ${total} 筆`,
      items: {
        type: "object",
        properties: {
          review: {
            type: "string",
            description: "這一題回答的檢討：做得好的地方與不足之處，以及與職缺要求的落差",
          },
          suggestion: {
            type: "string",
            description: "這一題具體可以怎麼回答得更好",
          },
        },
        required: ["review", "suggestion"],
        additionalProperties: false,
      },
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "整體的改進建議",
    },
  },
  required: ["score", "comment", "questionReviews", "suggestions"],
  additionalProperties: false,
});

/** 統一回傳格式的小工具，讓所有回應都符合 InterviewResponse 型別 */
function jsonResponse(body: InterviewResponse, status = 200) {
  return Response.json(body, { status });
}

/**
 * 從請求標頭讀取使用者的 BYOK 設定並驗證。
 * 回傳設定物件，或一則可直接顯示給使用者的錯誤訊息字串。
 */
function readLlmSettings(headers: Headers) {
  const provider = headers.get(LLM_HEADERS.provider);
  const apiKey = headers.get(LLM_HEADERS.apiKey)?.trim() ?? "";
  const model = headers.get(LLM_HEADERS.model);

  if (!isProvider(provider) || !apiKey) {
    return "尚未設定 API 金鑰，請先到「設定」頁填入你的 Anthropic 或 OpenAI 金鑰。";
  }
  const keyError = checkKeyFormat(provider, apiKey);
  if (keyError) return `${keyError}，請到「設定」頁確認。`;
  if (!isAllowedModel(provider, model)) {
    return `不支援的模型，${PROVIDERS[provider].label} 可用的模型為：${PROVIDERS[provider].models.join("、")}`;
  }
  return { provider, apiKey, model };
}

/**
 * 驗證前端送來的對話紀錄。
 * 規則：必須是陣列，且依序為「面試官、候選人、面試官、候選人…」交錯，
 * 每則內容為非空字串且不超過長度上限。任何一項不符就回傳 null。
 */
function parseHistory(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value)) return null;
  const turns: ChatTurn[] = [];
  for (const [i, item] of value.entries()) {
    // 偶數索引必須是面試官提問，奇數索引必須是候選人回答
    const expectedRole = i % 2 === 0 ? "interviewer" : "candidate";
    if (
      typeof item !== "object" ||
      item === null ||
      item.role !== expectedRole ||
      typeof item.content !== "string" ||
      !item.content.trim() ||
      item.content.length > MAX_ANSWER_LENGTH
    ) {
      return null;
    }
    turns.push({ role: item.role, content: item.content.trim() });
  }
  return turns;
}

/**
 * 把職缺描述與對話紀錄轉成模型需要的 messages 陣列（兩家供應商通用的格式）。
 *
 * - 第一則固定是 user 訊息，內容為職缺描述（對話必須以 user 開頭）
 * - 面試官的發言對應 assistant，候選人的回答對應 user
 * - instruction 是這一輪的任務指示（出第幾題 / 產生評分），
 *   附加在最後一則 user 訊息的尾端，讓模型清楚知道現在要做什麼
 */
function buildMessages(
  jobDescription: string,
  history: ChatTurn[],
  instruction: string,
): LlmMessage[] {
  const messages: LlmMessage[] = [
    {
      role: "user",
      content: `<job_description>\n${jobDescription}\n</job_description>\n\n請開始面試。`,
    },
    ...history.map(
      (turn): LlmMessage => ({
        role: turn.role === "interviewer" ? "assistant" : "user",
        content: turn.content,
      }),
    ),
  ];
  // history 長度一定是偶數（成對），所以最後一則必定是 user 訊息
  const last = messages[messages.length - 1];
  last.content += `\n\n（面試系統指示：${instruction}）`;
  return messages;
}

export async function POST(request: Request) {
  // ── 1. 讀取使用者的 API 金鑰設定（BYOK）──
  const llm = readLlmSettings(request.headers);
  if (typeof llm === "string") {
    return jsonResponse({ type: "error", error: llm }, 400);
  }

  // ── 2. 解析並驗證請求內容 ──
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ type: "error", error: "請求格式錯誤" }, 400);
  }

  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  if (!jobDescription) {
    return jsonResponse({ type: "error", error: "請輸入職缺描述" }, 400);
  }
  if (jobDescription.length > MAX_JD_LENGTH) {
    return jsonResponse(
      { type: "error", error: `職缺描述請勿超過 ${MAX_JD_LENGTH} 字` },
      400,
    );
  }

  // 題數只接受 QUESTION_COUNT_OPTIONS 中的值；未提供時使用預設值
  const total = body.totalQuestions ?? DEFAULT_QUESTION_COUNT;
  if (!isQuestionCount(total)) {
    return jsonResponse({ type: "error", error: "題數設定不正確" }, 400);
  }

  const history = parseHistory(body.history ?? []);
  // 歷史必須是「面試官、候選人」成對出現（偶數筆），且最多 total 題
  if (!history || history.length % 2 !== 0 || history.length > total * 2) {
    return jsonResponse({ type: "error", error: "對話紀錄格式錯誤" }, 400);
  }

  // 每一對（提問 + 回答）代表已完成一題
  const answered = history.length / 2;

  try {
    // ── 3a. 還沒答滿：出下一題 ──
    if (answered < total) {
      const questionNumber = answered + 1;
      const instruction =
        questionNumber === 1
          ? `請提出第 1 題（共 ${total} 題）。`
          : `請提出第 ${questionNumber} 題（共 ${total} 題）：可針對上一題回答追問，或換新面向出題。`;
      const question = await generate({
        ...llm,
        system: systemPrompt(total),
        messages: buildMessages(jobDescription, history, instruction),
      });
      return jsonResponse({ type: "question", questionNumber, question });
    }

    // ── 3b. 已答滿：產生評分結論（以 JSON Schema 約束輸出格式）──
    const instruction = `${total} 題已全部結束，不要再出題。請根據候選人所有回答，評估其與此職缺的契合度：給出 1-10 的整數分數（10 分最佳）；整體評論（著重回答內容與職缺要求的契合程度，扼要總結優勢與不足）；依題目順序對每一題分別給出檢討與建議（共 ${total} 筆，內容針對該題回答，不要與整體評論重複）；最後給 2-4 條整體建議。`;
    const raw = await generate({
      ...llm,
      system: systemPrompt(total),
      messages: buildMessages(jobDescription, history, instruction),
      jsonSchema: { name: "interview_evaluation", schema: evaluationSchema(total) },
    });
    const parsed = JSON.parse(raw) as Evaluation;
    // 保險起見再做一次整理：分數夾在 1–10 的整數，逐題檢討不超過題數
    const evaluation: Evaluation = {
      score: Math.min(10, Math.max(1, Math.round(parsed.score))),
      comment: parsed.comment,
      questionReviews: parsed.questionReviews.slice(0, total),
      suggestions: parsed.suggestions,
    };
    return jsonResponse({ type: "result", evaluation });
  } catch (error) {
    // ── 4. 錯誤處理：LlmError 已是中文訊息；其他（如 JSON.parse 失敗）使用通用訊息 ──
    // 注意：不要在這裡 console.error(error) 整個物件或請求標頭，以免金鑰寫進 log
    if (error instanceof LlmError) {
      return jsonResponse({ type: "error", error: error.message }, error.status);
    }
    console.error("[interview]", error instanceof Error ? error.name : "UnknownError");
    return jsonResponse({ type: "error", error: "伺服器發生錯誤，請稍後再試。" }, 500);
  }
}
