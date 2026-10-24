import Link from "next/link";
import { PRODUCT_NAME } from "@/components/logo";
import { ScoreBar } from "@/components/score-bar";
import { QUESTION_COUNT_OPTIONS } from "@/lib/interview";
import { container, eyebrow, primaryButton, secondaryButton } from "@/lib/styles";

// ───────────────────────── 頁面內容資料 ─────────────────────────
// 文案與畫面分開存放，修改文字時不必動到排版。

// 題數選項的顯示文字，例如「3 或 5」
const COUNT_TEXT = QUESTION_COUNT_OPTIONS.join(" 或 ");

/** 使用流程的四個步驟 */
const STEPS = [
  {
    title: "設定 API 金鑰",
    body: "在設定頁填入你自己的 Anthropic 或 OpenAI API 金鑰。金鑰只存在你的瀏覽器，我們不會儲存。",
  },
  {
    title: "貼上職缺描述",
    body: "把想應徵的職缺內容貼進來，面試官會從職責與技能要求中找出要考你的重點。",
  },
  {
    title: `回答 ${COUNT_TEXT} 個問題`,
    body: "依你的時間選擇題數，面試官一次問一題。你的回答若太籠統、缺少實例，下一題就會針對它追問。",
  },
  {
    title: "取得評分與建議",
    body: "結束後拿到 1–10 分的契合度評分、整體評論，以及每一題各自的檢討與改進建議。",
  },
];

/** 功能介紹卡片；icon 是簡單的線條 SVG path，維持北歐風的極簡感 */
const FEATURES = [
  {
    title: "依職缺量身出題",
    body: "題目緊扣職缺描述的職責與技能，不是網路上千篇一律的題庫。",
    icon: "M4 6h16M4 12h10M4 18h7",
  },
  {
    title: "像真人一樣追問",
    body: "面試官會依你的回答決定追問細節，還是換一個面向繼續考。",
    icon: "M5 7h11a3 3 0 0 1 0 6H9l-4 4V7Z",
  },
  {
    title: "契合度評分",
    body: "以 1–10 分評估你的回答和這個職缺的契合程度，10 分代表最佳。",
    icon: "M4 18V13M10 18V9M16 18V5",
  },
  {
    title: "逐題檢討與建議",
    body: "每一題分開說明好在哪、缺什麼，以及具體可以怎麼回答得更好。",
    icon: "M5 12l4 4 10-10",
  },
  {
    title: "自備金鑰，費用透明",
    body: "支援 Anthropic 與 OpenAI。使用你自己的 API 金鑰，費用直接由你的帳號依用量計算，免註冊。",
    icon: "M14 7a4 4 0 1 1-3.5 5.9L4 19.5V16h3v-3h2.5",
  },
  {
    title: "不儲存金鑰與紀錄",
    body: "API 金鑰只存在你的瀏覽器；面試對話只存在當下的分頁。我們的伺服器兩者都不儲存。",
    icon: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  },
];

/** 常見問題，使用原生 <details> 製作可展開的問答，不需要額外的 JavaScript */
const FAQS = [
  {
    q: "需要付費或註冊嗎？",
    a: "不需要註冊帳號。Lagom 採用 BYOK（自備金鑰）模式：在「設定」頁填入你自己的 Anthropic 或 OpenAI API 金鑰即可使用，AI 的費用由你的帳號依用量計算。",
  },
  {
    q: "我的 API 金鑰安全嗎？會被儲存嗎？",
    a: "金鑰只儲存在你這個瀏覽器的 localStorage。每次出題時，金鑰會透過 HTTPS 隨請求傳到我們的伺服器，只用來轉呼叫你選擇的 AI 服務，請求結束就丟棄，不會被儲存或寫入紀錄。建議在供應商後台為金鑰設定用量上限；在共用電腦上使用後，請到設定頁按「清除金鑰」。",
  },
  {
    q: "一場面試有幾題？",
    a: `開始前可以選擇 ${COUNT_TEXT} 題。從第 2 題起，面試官可能針對你上一題的回答追問，也可能換一個新面向。`,
  },
  {
    q: "評分的標準是什麼？",
    a: "評分著重在你的回答和該職缺要求的契合度：是否回應了職缺需要的技能、是否有具體實例與成果。",
  },
  {
    q: "我的回答會被保存嗎？",
    a: "本服務的伺服器不儲存面試紀錄。對話只存在你目前的瀏覽器分頁中，重新整理或按「重新開始」就會清除。回答內容會傳送給你選擇的 AI 供應商（Anthropic 或 OpenAI）來產生題目與評分。",
  },
  {
    q: "可以用英文職缺練習嗎？",
    a: "可以貼上英文職缺描述，不過面試官目前會以繁體中文進行面試與評語。",
  },
];

// ───────────────────────── 頁面 ─────────────────────────

/**
 * 產品首頁（Landing Page），Server Component，純靜態內容。
 * 區塊順序：Hero → 使用流程 → 功能 → 常見問題 → 底部行動呼籲。
 * 每個區塊的 id 對應 header 導覽列的錨點連結。
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Faq />
      <CallToAction />
    </>
  );
}

/** 首屏：標語、說明、兩顆行動按鈕，右側放一張「結果預覽」卡片讓訪客一眼看懂產出 */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Landscape />
      <div
        className={`${container} relative grid items-center gap-16 py-20 sm:py-28 lg:grid-cols-[1.1fr_1fr]`}
      >
        <div className="flex flex-col gap-8">
          <span className={`${eyebrow} flex items-center gap-3`}>
            <span className="h-px w-8 bg-wood" />
            AI 面試模擬器
          </span>
          <h1 className="text-4xl font-light leading-tight tracking-tight text-ink sm:text-6xl">
            面試準備，
            <br />
            剛剛好就夠。
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-muted">
            貼上職缺描述，{PRODUCT_NAME} 的 AI 面試官會為你量身出題、適時追問，
            最後告訴你哪裡答得好、哪裡還能更好。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/interview" className={`${primaryButton} px-7 py-3`}>
              開始模擬面試
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="#how-it-works" className={`${secondaryButton} px-7 py-3`}>
              了解流程
            </Link>
          </div>
          <p className="text-xs text-muted">免註冊 · 自備 Anthropic 或 OpenAI 金鑰 · 可選 {COUNT_TEXT} 題</p>
        </div>
        <ResultPreview />
      </div>
    </section>
  );
}

/**
 * Hero 背景裝飾：層疊的山丘線條，呼應北歐自然景觀。
 * 純裝飾，aria-hidden 讓螢幕閱讀器略過。
 */
function Landscape() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-48 w-full"
      viewBox="0 0 1440 200"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 140 C240 80 420 150 640 110 C860 70 1080 140 1440 90 V200 H0Z"
        className="fill-accent-soft"
        opacity="0.6"
      />
      <path
        d="M0 170 C300 130 520 190 820 150 C1060 120 1240 170 1440 140 V200 H0Z"
        className="fill-accent-soft"
      />
    </svg>
  );
}

/**
 * 範例結果卡片：展示面試結束後會拿到的內容（分數、單題檢討與建議）。
 * 內容為示意用的範例，並在卡片上標明「範例」。
 */
function ResultPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* 後方錯位的淺木色色塊，增加層次感 */}
      <div className="absolute -right-4 -bottom-4 h-full w-full rounded-3xl bg-wood/15" />
      <div className="relative flex flex-col gap-6 rounded-3xl border border-line bg-surface p-7 shadow-[0_20px_60px_-30px_rgba(46,45,43,0.25)]">
        <div className="flex items-center justify-between">
          <span className={eyebrow}>面試結果</span>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] tracking-widest text-muted">
            範例
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extralight text-ink">7</span>
            <span className="text-sm text-muted">/ 10</span>
          </div>
          <ScoreBar score={7} />
        </div>
        <div className="flex flex-col gap-4 border-t border-line pt-5">
          <span className="text-xs tracking-[0.2em] text-wood">QUESTION 02</span>
          <p className="text-sm leading-relaxed text-ink">你如何優化網頁效能？</p>
          <div className="flex flex-col gap-1">
            <span className={eyebrow}>檢討</span>
            <p className="text-sm leading-relaxed text-ink/80">
              有提到 lazy loading 與 memo，但只列出名詞，缺少量測方式與實際數據。
            </p>
          </div>
          <div className="flex flex-col gap-1 border-l-2 border-accent pl-3">
            <span className={eyebrow}>建議</span>
            <p className="text-sm leading-relaxed text-ink/80">
              先說明如何找出瓶頸，再說明優化手段，最後附上優化前後的指標變化。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 共用的區塊標題：小標籤 + 大標題 + 說明文字 */
function SectionHeading({ label, title, body }: { label: string; title: string; body?: string }) {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <span className={`${eyebrow} flex items-center gap-3`}>
        <span className="h-px w-8 bg-wood" />
        {label}
      </span>
      <h2 className="text-3xl font-light tracking-tight text-ink sm:text-4xl">{title}</h2>
      {body && <p className="leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

/** 使用流程：四個步驟（平板 2 欄、桌機 4 欄），以大號數字與細線區隔 */
function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-surface py-24">
      <div className={`${container} flex flex-col gap-14`}>
        <SectionHeading label="使用流程" title="四個步驟，完成一場模擬面試" />
        <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-4 border-t border-line pt-6">
              <span className="text-4xl font-extralight tabular-nums text-wood">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg text-ink">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** 功能介紹：響應式卡片格線，手機 1 欄、平板 2 欄、桌機 3 欄 */
function Features() {
  return (
    <section id="features" className="scroll-mt-16 py-24">
      <div className={`${container} flex flex-col gap-14`}>
        <SectionHeading
          label="功能"
          title="專注在真正重要的事"
          body="沒有多餘的設定和複雜的介面，只有一場貼近真實的面試，以及清楚可行的回饋。"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-7 transition hover:border-accent/60"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="stroke-accent"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={f.icon} />
                </svg>
              </span>
              <h3 className="text-lg text-ink">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 常見問題：左側標題、右側可展開的問答清單 */
function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 bg-surface py-24">
      <div className={`${container} grid gap-12 lg:grid-cols-[1fr_1.6fr]`}>
        <SectionHeading label="常見問題" title="開始之前，你可能想知道" />
        <div className="flex flex-col">
          {FAQS.map((item) => (
            <details key={item.q} className="group border-b border-line py-5 first:border-t">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-ink">
                {item.q}
                {/* 加號在展開時旋轉 45 度變成叉號 */}
                <span className="text-xl font-light text-muted transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 pr-8 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 頁面底部的行動呼籲橫幅，引導看完介紹的訪客開始使用 */
function CallToAction() {
  return (
    <section className="py-24">
      <div className={container}>
        <div className="flex flex-col items-start gap-8 rounded-3xl bg-accent px-8 py-14 sm:px-14 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-light tracking-tight text-on-accent">
              下一場面試，從這裡開始練習。
            </h2>
            <p className="text-on-accent/80">只要一份職缺描述，十分鐘後你就知道該加強什麼。</p>
          </div>
          <Link
            href="/interview"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-surface px-7 py-3 text-sm tracking-wide text-ink transition hover:opacity-90"
          >
            開始模擬面試
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
