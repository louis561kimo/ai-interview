/**
 * API 金鑰隱私說明，設定頁與面試頁共用，確保兩處對使用者的說法一致。
 * compact 為精簡版（一行文字），用於面試頁。
 */
export function KeyPrivacyNote({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs leading-relaxed text-muted">
        你的 API 金鑰只存在這個瀏覽器中。每次出題時會隨請求傳到我們的伺服器，
        用來轉呼叫 AI 服務，用完即丟棄，伺服器不會儲存或記錄。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-accent-soft/60 p-5 text-sm leading-relaxed text-ink/85">
      <span className="flex items-center gap-2 font-medium text-ink">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="stroke-accent"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />
        </svg>
        我們不會儲存你的 API 金鑰
      </span>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        <li>金鑰只儲存在你這個瀏覽器的 localStorage，不會上傳到我們的資料庫，我們也沒有資料庫。</li>
        <li>
          每次出題與評分時，金鑰會透過 HTTPS 隨請求傳到我們的伺服器，僅用來轉呼叫你選擇的 AI
          服務，請求結束即丟棄，不會被儲存或寫入紀錄。
        </li>
        <li>費用由你的 Anthropic 或 OpenAI 帳號依用量計費。建議在供應商後台為這組金鑰設定用量上限。</li>
        <li>在公用或共用電腦上使用後，請按「清除金鑰」刪除。</li>
      </ul>
    </div>
  );
}
