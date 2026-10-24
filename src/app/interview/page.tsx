import type { Metadata } from "next";
import { InterviewApp } from "@/components/interview-app";

// 這個檔案保持為 Server Component，才能匯出 metadata；
// 實際的互動邏輯放在 Client Component（InterviewApp）中。
export const metadata: Metadata = {
  title: "模擬面試",
};

export default function InterviewPage() {
  return <InterviewApp />;
}
