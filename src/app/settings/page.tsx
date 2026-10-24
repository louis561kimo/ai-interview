import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings-form";

// 保持為 Server Component 以匯出 metadata；表單互動與 localStorage 存取在 Client Component 中
export const metadata: Metadata = {
  title: "API 金鑰設定",
};

export default function SettingsPage() {
  return <SettingsForm />;
}
