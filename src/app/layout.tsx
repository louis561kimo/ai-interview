import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// 透過 next/font 自動下載並自架字型，避免版面跳動；變數名稱供 globals.css 的 --font-sans 使用。
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 全站預設 metadata；子頁面設定的 title 會套入 template，例如「模擬面試｜Lagom」。
export const metadata: Metadata = {
  title: {
    default: "Lagom｜AI 面試模擬器",
    template: "%s｜Lagom",
  },
  description: "貼上職缺描述，AI 面試官為你量身出題、追問，並給出契合度評分與逐題建議。",
};

/**
 * 根版面：所有頁面共用 header 與 footer，中間的 main 撐滿剩餘高度，
 * 讓內容較少的頁面 footer 也會貼在畫面底部。
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
