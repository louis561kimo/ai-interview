import Link from "next/link";
import { Logo } from "@/components/logo";
import { container, primaryButton } from "@/lib/styles";

// 導覽連結指向首頁的各區塊錨點；加上 "/" 前綴，從 /interview 點擊也能回到首頁對應位置。
const NAV_LINKS = [
  { href: "/#features", label: "功能" },
  { href: "/#how-it-works", label: "使用流程" },
  { href: "/#faq", label: "常見問題" },
  { href: "/settings", label: "設定" },
];

/**
 * 全站共用的頂部導覽列。
 * sticky 固定在上方，半透明背景加模糊，捲動時仍看得到下方內容的輪廓。
 * 小螢幕隱藏導覽連結，只保留 Logo 與「開始面試」按鈕。
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
      <div className={`${container} flex h-16 items-center justify-between gap-6`}>
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
        <Link href="/interview" className={primaryButton}>
          開始面試
        </Link>
      </div>
    </header>
  );
}
