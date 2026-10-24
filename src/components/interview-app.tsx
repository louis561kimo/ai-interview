"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KeyPrivacyNote } from "@/components/key-privacy-note";
import {
  DEFAULT_QUESTION_COUNT,
  QUESTION_COUNT_OPTIONS,
  type ChatTurn,
  type Evaluation,
  type InterviewResponse,
  type QuestionCount,
} from "@/lib/interview";
import { ScoreBar } from "@/components/score-bar";
import { LLM_HEADERS, maskKey, PROVIDERS, type LlmSettings } from "@/lib/providers";
import { container, eyebrow, primaryButton, secondaryButton, textArea } from "@/lib/styles";
import { useLlmSettings } from "@/lib/use-llm-settings";

/**
 * 面試流程的三個階段：
 * - setup：輸入職缺描述、選擇題數
 * - interview：一問一答，共 totalQuestions 題
 * - result：顯示評分、整體評論與逐題檢討
 */
type Stage = "setup" | "interview" | "result";

/**
 * 模擬面試主畫面（Client Component）。
 *
 * 後端 API 不保存任何狀態，所以整場面試的對話紀錄（history）都存在這個元件中，
 * 每次呼叫 /api/interview 時連同職缺描述一起送出，由後端依已回答題數決定
 * 要出下一題還是產生評分結論。
 *
 * BYOK：使用者的 API 金鑰設定從 localStorage 讀取（useLlmSettings），
 * 呼叫 API 時放在 HTTP 標頭中帶上；尚未設定時引導使用者前往設定頁。
 */
export function InterviewApp() {
  // ready：是否已讀完 localStorage；llm：已儲存的金鑰設定，沒有則為 null
  const { ready, settings: llm } = useLlmSettings();
  const [stage, setStage] = useState<Stage>("setup");
  const [jobDescription, setJobDescription] = useState("");
  // 使用者選擇的題數；面試開始後鎖定，直到按「重新開始」才能更改
  const [totalQuestions, setTotalQuestions] = useState<QuestionCount>(DEFAULT_QUESTION_COUNT);
  // 依序交錯的「面試官提問、候選人回答」紀錄
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 頁面最底部的錨點，有新訊息時自動捲動到這裡
  const bottomRef = useRef<HTMLDivElement>(null);

  // 目前已出到第幾題 = 面試官發言的次數
  const questionNumber = history.filter((t) => t.role === "interviewer").length;

  // 新題目、載入提示或評分結果出現時，自動捲到最下方
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading, evaluation]);

  /**
   * 呼叫後端 API，並依回應類型更新畫面：
   * - question：把新題目加進對話紀錄，進入（或維持）面試階段
   * - result：保存評分結果，切換到結論階段
   * 回傳是否成功，讓呼叫端可以在失敗時還原狀態。
   */
  async function callInterview(nextHistory: ChatTurn[]) {
    // 面試途中在其他分頁清除了金鑰時，llm 會變成 null
    if (!llm) {
      setError("找不到 API 金鑰設定，請先到「設定」頁填入金鑰。");
      return false;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        // 金鑰放在標頭中送出；伺服器只用它轉呼叫 AI 服務，不會儲存
        headers: {
          "Content-Type": "application/json",
          [LLM_HEADERS.provider]: llm.provider,
          [LLM_HEADERS.apiKey]: llm.apiKey,
          [LLM_HEADERS.model]: llm.model,
        },
        body: JSON.stringify({ jobDescription, totalQuestions, history: nextHistory }),
      });
      const data: InterviewResponse = await res.json();
      if (data.type === "error") throw new Error(data.error);
      if (data.type === "question") {
        setHistory([...nextHistory, { role: "interviewer", content: data.question }]);
        setStage("interview");
      } else {
        setHistory(nextHistory);
        setEvaluation(data.evaluation);
        setStage("result");
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "發生錯誤，請再試一次。");
      return false;
    } finally {
      setLoading(false);
    }
  }

  /** 送出職缺描述，以空的對話紀錄向後端要第 1 題 */
  function handleStart(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!jobDescription.trim() || loading) return;
    callInterview([]);
  }

  /**
   * 送出目前的回答。先樂觀地把回答顯示在畫面上，
   * 若 API 失敗就還原對話紀錄並把文字放回輸入框，讓使用者可以直接重送。
   * 表單送出與 ⌘/Ctrl + Enter 快捷鍵都會呼叫這個函式。
   */
  async function submitAnswer() {
    const content = answer.trim();
    if (!content || loading) return;
    const nextHistory: ChatTurn[] = [...history, { role: "candidate", content }];
    setHistory(nextHistory);
    setAnswer("");
    const ok = await callInterview(nextHistory);
    if (!ok) {
      setHistory(history);
      setAnswer(content);
    }
  }

  /** 清空所有狀態，回到輸入職缺描述的畫面 */
  function handleRestart() {
    setStage("setup");
    setHistory([]);
    setAnswer("");
    setEvaluation(null);
    setError("");
  }

  return (
    <div className={`${container} flex justify-center py-14 sm:py-20`}>
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <span className="h-px w-10 bg-wood" />
          <h1 className="text-3xl font-light tracking-wide text-ink">模擬面試</h1>
          <p className="text-sm leading-relaxed text-muted">
            貼上職缺描述並選擇題數，面試官會依序提問。
            結束後你會得到分數、整體評論，以及每一題的檢討與建議。
          </p>
        </header>

        {stage === "setup" && !ready ? null : stage === "setup" && !llm ? (
          // 尚未設定 API 金鑰：不顯示表單，引導前往設定頁
          <NeedKey />
        ) : stage === "setup" ? (
          <form onSubmit={handleStart} className="flex flex-col gap-4">
            {llm && <KeyStatus settings={llm} />}
            <label htmlFor="jd" className={eyebrow}>
              職缺描述
            </label>
            <textarea
              id="jd"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={10}
              maxLength={8000}
              placeholder="例如：前端工程師，熟悉 React / Next.js、TypeScript，有串接 RESTful API 經驗……"
              className={textArea}
            />
            {/* 題數選擇與開始按鈕同一列；小螢幕時自動換行 */}
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <QuestionCountPicker
                value={totalQuestions}
                onChange={setTotalQuestions}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!jobDescription.trim() || loading}
                className={primaryButton}
              >
                {loading ? "面試官準備中…" : "開始面試"}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* 面試開始後，職缺描述收合起來，需要時再展開查看 */}
            <details className="group rounded-2xl border border-line bg-surface px-5 py-4 text-sm">
              <summary className={`cursor-pointer list-none ${eyebrow}`}>
                職缺描述 <span className="group-open:hidden">＋</span>
                <span className="hidden group-open:inline">－</span>
              </summary>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink/80">
                {jobDescription}
              </p>
            </details>

            {stage === "interview" && (
              <Progress current={questionNumber} total={totalQuestions} />
            )}

            {/* 對話紀錄：面試官提問以大字排版，候選人回答放在淡綠色區塊並向右縮排 */}
            <div className="flex flex-col gap-6">
              {history.map((turn, i) =>
                turn.role === "interviewer" ? (
                  <div key={i} className="flex flex-col gap-2">
                    {/* 對話是成對出現的，所以第 i 筆的題號是 i / 2 + 1 */}
                    <span className={eyebrow}>問題 {Math.floor(i / 2) + 1}</span>
                    <p className="whitespace-pre-wrap text-lg font-light leading-relaxed text-ink">
                      {turn.content}
                    </p>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="ml-6 whitespace-pre-wrap rounded-2xl bg-accent-soft px-5 py-4 leading-relaxed text-ink sm:ml-16"
                  >
                    {turn.content}
                  </div>
                ),
              )}
              {loading && (
                <p className="animate-pulse text-sm text-muted">
                  {questionNumber >= totalQuestions ? "面試官正在評分…" : "面試官思考中…"}
                </p>
              )}
            </div>

            {stage === "interview" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAnswer();
                }}
                className="flex flex-col gap-3"
              >
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    // ⌘ + Enter（Mac）或 Ctrl + Enter（Windows）快速送出；單按 Enter 保留換行
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      submitAnswer();
                    }
                  }}
                  rows={5}
                  maxLength={4000}
                  disabled={loading}
                  placeholder="寫下你的回答…（⌘/Ctrl + Enter 送出）"
                  className={textArea}
                />
                <button
                  type="submit"
                  disabled={!answer.trim() || loading}
                  className={`self-end ${primaryButton}`}
                >
                  送出回答
                </button>
              </form>
            )}

            {stage === "result" && evaluation && (
              <Result evaluation={evaluation} history={history} onRestart={handleRestart} />
            )}
          </>
        )}

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9b8a8] bg-[#f6ebe5] px-5 py-3 text-sm text-[#8a4b35] dark:border-[#5a3a2e] dark:bg-[#2e2420] dark:text-[#e0b3a0]">
            <span>{error}</span>
            {/* 多數錯誤（金鑰無效、模型無權限、額度不足）都需要到設定頁處理 */}
            <Link href="/settings" className="shrink-0 underline underline-offset-4">
              前往設定
            </Link>
          </div>
        )}

        {/* 金鑰隱私說明：只要已設定金鑰就顯示在頁面底部 */}
        {llm && <KeyPrivacyNote compact />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/** 尚未設定 API 金鑰時顯示的引導卡片 */
function NeedKey() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-3xl border border-line bg-surface p-7">
      <span className={eyebrow}>開始之前</span>
      <h2 className="text-xl font-light text-ink">請先設定你的 API 金鑰</h2>
      <p className="text-sm leading-relaxed text-muted">
        Lagom 使用你自己的 Anthropic 或 OpenAI API 金鑰進行面試（BYOK）。
        金鑰只會存在你的瀏覽器中，我們的伺服器不會儲存。
      </p>
      <Link href="/settings" className={primaryButton}>
        前往設定 →
      </Link>
    </div>
  );
}

/** 顯示目前使用的供應商、模型與遮蔽後的金鑰，並提供變更連結 */
function KeyStatus({ settings }: { settings: LlmSettings }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-xs text-muted">
      <span>
        使用 <span className="text-ink">{PROVIDERS[settings.provider].label}</span> ·{" "}
        {settings.model} · <span className="font-mono">{maskKey(settings.apiKey)}</span>
      </span>
      <Link href="/settings" className="text-accent underline-offset-4 hover:underline">
        變更設定
      </Link>
    </div>
  );
}

/**
 * 題數選擇器：膠囊形的分段按鈕（segmented control），選項來自 QUESTION_COUNT_OPTIONS。
 * 以 radiogroup 語意標記，螢幕閱讀器會將它視為單選群組。
 */
function QuestionCountPicker({
  value,
  onChange,
  disabled,
}: {
  value: QuestionCount;
  onChange: (count: QuestionCount) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span id="question-count-label" className={eyebrow}>
        題數
      </span>
      <div
        role="radiogroup"
        aria-labelledby="question-count-label"
        className="inline-flex rounded-full border border-line bg-surface p-1"
      >
        {QUESTION_COUNT_OPTIONS.map((count) => {
          const selected = count === value;
          return (
            <button
              key={count}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(count)}
              className={`rounded-full px-5 py-1.5 text-sm tracking-wide transition disabled:cursor-not-allowed ${
                selected ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              {count} 題
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 面試進度條：每題一段，已出題的段落以主色標示 */
function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < current ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted">
        {current} / {total}
      </span>
    </div>
  );
}

/**
 * 面試結論：總分、整體評論、逐題檢討卡片、整體建議。
 * 逐題卡片會從對話紀錄取出對應的題目與回答，和 AI 的檢討並排呈現。
 */
function Result({
  evaluation,
  history,
  onRestart,
}: {
  evaluation: Evaluation;
  history: ChatTurn[];
  onRestart: () => void;
}) {
  // 對話紀錄拆成題目與回答兩個陣列，索引即對應 questionReviews 的題序
  const questions = history.filter((t) => t.role === "interviewer");
  const answers = history.filter((t) => t.role === "candidate");

  return (
    <section className="flex flex-col gap-10 border-t border-line pt-10">
      <div className="flex flex-col gap-4">
        <span className={eyebrow}>總分</span>
        <div className="flex items-baseline gap-2">
          <span className="text-6xl font-extralight tabular-nums text-ink">
            {evaluation.score}
          </span>
          <span className="text-muted">/ 10</span>
        </div>
        <ScoreBar score={evaluation.score} />
      </div>

      <div className="flex flex-col gap-3">
        <span className={eyebrow}>整體評論</span>
        <p className="whitespace-pre-wrap leading-relaxed text-ink/90">{evaluation.comment}</p>
      </div>

      <div className="flex flex-col gap-4">
        <span className={eyebrow}>逐題檢討</span>
        {evaluation.questionReviews.map((item, i) => (
          <article
            key={i}
            className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6"
          >
            <header className="flex flex-col gap-2">
              <span className="text-xs tracking-[0.2em] text-wood">
                QUESTION {String(i + 1).padStart(2, "0")}
              </span>
              <p className="leading-relaxed text-ink">{questions[i]?.content}</p>
            </header>

            {answers[i] && (
              <details className="group text-sm">
                <summary className="cursor-pointer list-none text-muted">
                  你的回答 <span className="group-open:hidden">＋</span>
                  <span className="hidden group-open:inline">－</span>
                </summary>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink/75">
                  {answers[i].content}
                </p>
              </details>
            )}

            {/* 檢討與建議左右並排（手機上改為上下），建議欄以主色左框線強調 */}
            <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2 sm:gap-6">
              <div className="flex flex-col gap-2">
                <span className={eyebrow}>檢討</span>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                  {item.review}
                </p>
              </div>
              <div className="flex flex-col gap-2 border-l-2 border-accent pl-4">
                <span className={eyebrow}>建議</span>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                  {item.suggestion}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <span className={eyebrow}>整體建議</span>
        <ul className="flex flex-col gap-2">
          {evaluation.suggestions.map((s, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink/90">
              <span className="mt-2.5 h-px w-4 shrink-0 bg-wood" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      <button onClick={onRestart} className={`self-start ${secondaryButton}`}>
        重新開始
      </button>
    </section>
  );
}
