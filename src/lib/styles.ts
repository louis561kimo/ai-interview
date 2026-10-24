// 跨頁面共用的 Tailwind class 組合，讓按鈕、標籤等元件在整個網站保持一致的北歐風外觀。
// 顏色名稱（accent、ink、line…）定義在 src/app/globals.css 的設計 token。

/** 主要按鈕：鼠尾草綠實心膠囊形 */
export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm tracking-wide text-on-accent transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-35";

/** 次要按鈕：細框線膠囊形 */
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-2.5 text-sm tracking-wide text-ink transition hover:border-accent hover:text-accent";

/** 小型大寫標籤，用於區塊標題（如「總分」「檢討」） */
export const eyebrow = "text-xs uppercase tracking-[0.2em] text-muted";

/** 多行輸入框 */
export const textArea =
  "w-full resize-none rounded-2xl border border-line bg-surface p-4 leading-relaxed text-ink outline-none transition placeholder:text-muted/70 focus:border-accent disabled:opacity-60";

/** 內容寬度容器，header / footer / 各區塊共用，確保左右對齊 */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";
