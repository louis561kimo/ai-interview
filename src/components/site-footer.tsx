import Link from "next/link";
import { Logo, PRODUCT_NAME } from "@/components/logo";
import { container, eyebrow } from "@/lib/styles";

// footer 的連結分組，資料與畫面分開，之後要增減連結只需改這裡。
const LINK_GROUPS = [
  {
    title: "產品",
    links: [
      { href: "/interview", label: "開始模擬面試" },
      { href: "/#features", label: "功能" },
      { href: "/#how-it-works", label: "使用流程" },
    ],
  },
  {
    title: "支援",
    links: [{ href: "/#faq", label: "常見問題" }],
  },
];

/**
 * 版權年份。Next.js 16 的 Cache Components 不允許在預先渲染時直接讀取目前時間，
 * 所以用 "use cache" 把年份快取起來：建置時計算一次，不需每年手動修改。
 */
async function CopyrightYear() {
  "use cache";
  return new Date().getFullYear();
}

/**
 * 全站共用的頁尾：左側是產品簡介，右側是連結分組，最下方為版權列。
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className={`${container} grid gap-12 py-14 md:grid-cols-[2fr_1fr_1fr]`}>
        <div className="flex max-w-sm flex-col gap-4">
          <Logo />
          <p className="text-sm leading-relaxed text-muted">
            {PRODUCT_NAME} 是一個 AI 面試模擬器。貼上職缺描述，面試官會依職缺提出問題、
            針對你的回答追問，最後給你 1–10 分的契合度評分，以及逐題的檢討與建議。
          </p>
        </div>
        {LINK_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-4">
            <span className={eyebrow}>{group.title}</span>
            <ul className="flex flex-col gap-2.5 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink/80 transition hover:text-accent">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div
          className={`${container} flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:justify-between`}
        >
          <span>
            © <CopyrightYear /> {PRODUCT_NAME}. All rights reserved.
          </span>
          <span>AI 能力由 Claude 提供</span>
        </div>
      </div>
    </footer>
  );
}
