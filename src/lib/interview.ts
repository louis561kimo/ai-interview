// 前端（src/components/interview-app.tsx）與後端（src/app/api/interview/route.ts）
// 共用的型別與常數，確保雙方對 API 請求與回應格式的認知一致。

/** 使用者可選擇的面試題數；修改這個陣列即可同時調整前端選項與後端驗證 */
export const QUESTION_COUNT_OPTIONS = [3, 5] as const;

/** 題數型別，只能是 QUESTION_COUNT_OPTIONS 其中一個值 */
export type QuestionCount = (typeof QUESTION_COUNT_OPTIONS)[number];

/** 預設題數 */
export const DEFAULT_QUESTION_COUNT: QuestionCount = 3;

/** 判斷任意值是否為合法題數，後端用來驗證前端送來的 totalQuestions */
export function isQuestionCount(value: unknown): value is QuestionCount {
  return QUESTION_COUNT_OPTIONS.includes(value as QuestionCount);
}

/** 對話紀錄中的一則發言：interviewer 為 AI 面試官提問，candidate 為使用者回答 */
export type ChatTurn = {
  role: "interviewer" | "candidate";
  content: string;
};

/**
 * POST /api/interview 的請求內容。
 * 後端不保存狀態，所以每次都要帶上職缺描述、題數與完整的對話紀錄。
 */
export type InterviewRequest = {
  jobDescription: string;
  totalQuestions: QuestionCount;
  history: ChatTurn[];
};

/** 單一題目的檢討與建議 */
export type QuestionReview = {
  /** 這題回答的優缺點，以及與職缺要求的落差 */
  review: string;
  /** 這題可以怎麼回答得更好 */
  suggestion: string;
};

/** 面試結束後的評分結論 */
export type Evaluation = {
  /** 1–10 的整數，10 分最佳 */
  score: number;
  /** 整體評論：所有回答與職缺的契合度 */
  comment: string;
  /** 逐題檢討，索引對應題目順序 */
  questionReviews: QuestionReview[];
  /** 整體改進建議 */
  suggestions: string[];
};

/**
 * POST /api/interview 的回應，以 type 欄位區分三種情況：
 * - question：下一題（尚未答滿 totalQuestions 題）
 * - result：評分結論（已答滿）
 * - error：錯誤訊息，可直接顯示給使用者
 */
export type InterviewResponse =
  | { type: "question"; questionNumber: number; question: string }
  | { type: "result"; evaluation: Evaluation }
  | { type: "error"; error: string };
