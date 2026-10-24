import Link from "next/link";

// 產品名稱。Lagom 是瑞典語「剛剛好」的意思，呼應北歐風的品牌調性。
export const PRODUCT_NAME = "Lagom";

/**
 * 品牌標誌：抽象的山形線條 + 文字，點擊回到首頁。
 * header 與 footer 共用。
 */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink" aria-label={`${PRODUCT_NAME} 首頁`}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <circle cx="13" cy="13" r="12.25" className="stroke-line" strokeWidth="1.5" />
        <path
          d="M5 17.5 10 11l3.5 4 3-3.5 4.5 6"
          className="stroke-accent"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg font-light tracking-[0.12em]">{PRODUCT_NAME}</span>
    </Link>
  );
}
