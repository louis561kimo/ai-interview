/**
 * POST /api/interview — AI 模擬面試的後端 API。
 *
 * 設計：此 API 為「無狀態」，伺服器不儲存任何面試紀錄。
 * 前端每次呼叫都會帶上職缺描述、使用者選擇的題數（totalQuestions）與目前為止的完整對話紀錄，
 * 後端依「已回答的題數」決定這一輪要做什麼：
 *   - 已答 0 ~ totalQuestions-1 題 → 請 Claude 出下一題（可追問上一題）
 *   - 已答 totalQuestions 題       → 請 Claude 產生評分、評論與逐題檢討
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_QUESTION_COUNT,
  isQuestionCount,
  type ChatTurn,
  type Evaluation,
  type InterviewResponse,
} from "@/lib/interview";

// SDK 會自動讀取環境變數 ANTHROPIC_API_KEY（Next.js 會從 .env.local 載入）。
// 放在模組層級，讓同一個伺服器程序內的請求共用連線。
const client = new Anthropic();

const MODEL = "claude-opus-5-5";
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
 * 透過 Structured Outputs（output_config.format）強制 Claude 依此格式輸出，
 * 確保回傳內容一定能被 JSON.parse 並符合前端的 Evaluation 型別。
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
 * 把職缺描述與對話紀錄轉成 Claude Messages API 需要的 messages 陣列。
 *
 * - 第一則固定是 user 訊息，內容為職缺描述（API 規定第一則必須是 user）
 * - 面試官的發言對應 assistant，候選人的回答對應 user
 * - instruction 是這一輪的任務指示（出第幾題 / 產生評分），
 *   附加在最後一則 user 訊息的尾端，讓 Claude 清楚知道現在要做什麼
 */
function buildMessages(
  jobDescription: string,
  history: ChatTurn[],
  instruction: string,
): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `<job_description>\n${jobDescription}\n</job_description>\n\n請開始面試。`,
    },
    ...history.map(
      (turn): Anthropic.Beta.BetaMessageParam => ({
        role: turn.role === "interviewer" ? "assistant" : "user",
        content: turn.content,
      }),
    ),
  ];
  // history 長度一定是偶數（成對），所以最後一則必定是 user 訊息（字串內容）
  const last = messages[messages.length - 1];
  last.content = [
    { type: "text", text: last.content as string },
    { type: "text", text: `（面試系統指示：${instruction}）` },
  ];
  return messages;
}

/**
 * 呼叫 Claude 並取回純文字結果。
 *
 * @param total  本場面試的題數，用於產生 system prompt
 * @param format 若提供 JSON Schema，Claude 會輸出符合該格式的 JSON 字串（用於評分）；
 *               不提供則輸出一般文字（用於出題）。
 *
 * fallbacks: "default" 為伺服器端備援：若主模型因安全分類器拒答，
 * API 會自動改由 Anthropic 建議的備援模型接手，這需要搭配對應的 beta 標頭。
 */
async function askClaude(
  messages: Anthropic.Beta.BetaMessageParam[],
  total: number,
  format?: Anthropic.Beta.BetaJSONOutputFormat,
) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt(total),
    // effort 控制思考深度與花費；medium 在出題品質與回應速度間取得平衡
    output_config: { effort: "medium", ...(format && { format }) },
    messages,
  });

  // 連備援模型都拒答時，stop_reason 會是 refusal，此時不應讀取 content
  if (response.stop_reason === "refusal") {
    throw new Error("模型拒絕回應此請求，請調整職缺描述或回答內容後再試。");
  }
  // 回應可能包含 thinking 等其他區塊，只取出 text 區塊並串接
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("模型沒有回傳內容，請再試一次。");
  return text;
}

export async function POST(request: Request) {
  // ── 1. 解析並驗證請求內容 ──
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
    // ── 2a. 還沒答滿：出下一題 ──
    if (answered < total) {
      const questionNumber = answered + 1;
      const instruction =
        questionNumber === 1
          ? `請提出第 1 題（共 ${total} 題）。`
          : `請提出第 ${questionNumber} 題（共 ${total} 題）：可針對上一題回答追問，或換新面向出題。`;
      const question = await askClaude(
        buildMessages(jobDescription, history, instruction),
        total,
      );
      return jsonResponse({ type: "question", questionNumber, question });
    }

    // ── 2b. 已答滿：產生評分結論（以 JSON Schema 約束輸出格式）──
    const instruction = `${total} 題已全部結束，不要再出題。請根據候選人所有回答，評估其與此職缺的契合度：給出 1-10 的整數分數（10 分最佳）；整體評論（著重回答內容與職缺要求的契合程度，扼要總結優勢與不足）；依題目順序對每一題分別給出檢討與建議（共 ${total} 筆，內容針對該題回答，不要與整體評論重複）；最後給 2-4 條整體建議。`;
    const raw = await askClaude(
      buildMessages(jobDescription, history, instruction),
      total,
      { type: "json_schema", schema: evaluationSchema(total) },
    );
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
    // ── 3. 錯誤處理：完整錯誤寫入伺服器 log，回給前端的是易懂的中文訊息 ──
    console.error("[interview]", error);
    let message = "伺服器發生錯誤，請稍後再試。";
    // 依 SDK 的錯誤類別由具體到一般判斷
    if (error instanceof Anthropic.AuthenticationError) {
      message = "API 金鑰無效，請檢查 .env.local 的 ANTHROPIC_API_KEY。";
    } else if (error instanceof Anthropic.RateLimitError) {
      message = "請求太頻繁，請稍後再試。";
    } else if (error instanceof Anthropic.APIError) {
      message = `Claude API 錯誤（${error.status ?? "連線失敗"}），請稍後再試。`;
    } else if (error instanceof Error && !(error instanceof SyntaxError)) {
      // 自行拋出的錯誤（拒答、無內容）訊息已是中文，直接顯示；
      // SyntaxError 來自 JSON.parse，屬內部問題，使用通用訊息
      message = error.message;
    }
    return jsonResponse({ type: "error", error: message }, 500);
  }
}
