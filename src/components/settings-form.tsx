"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyPrivacyNote } from "@/components/key-privacy-note";
import {
  checkKeyFormat,
  LLM_HEADERS,
  maskKey,
  PROVIDERS,
  type LlmSettings,
  type Provider,
  type VerifyKeyResponse,
} from "@/lib/providers";
import { container, eyebrow, primaryButton, secondaryButton } from "@/lib/styles";
import { clearLlmSettings, saveLlmSettings, useLlmSettings } from "@/lib/use-llm-settings";

/**
 * API 金鑰設定頁（Client Component）。
 * 等瀏覽器讀完 localStorage（ready）後才渲染表單，
 * 讓表單的初始值能直接帶入已儲存的設定。
 */
export function SettingsForm() {
  const { ready, settings } = useLlmSettings();

  return (
    <div className={`${container} flex justify-center py-14 sm:py-20`}>
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <span className="h-px w-10 bg-wood" />
          <h1 className="text-3xl font-light tracking-wide text-ink">API 金鑰設定</h1>
          <p className="text-sm leading-relaxed text-muted">
            Lagom 採用 BYOK（Bring Your Own Key）模式：使用你自己的 Anthropic 或 OpenAI API
            金鑰進行面試，費用直接由你的帳號計算。
          </p>
        </header>

        <KeyPrivacyNote />

        {ready && <Form saved={settings} />}
      </div>
    </div>
  );
}

/** 設定表單本體；saved 為目前已儲存的設定（沒有則為 null） */
function Form({ saved }: { saved: LlmSettings | null }) {
  const [provider, setProvider] = useState<Provider>(saved?.provider ?? "anthropic");
  const [model, setModel] = useState(saved?.model ?? PROVIDERS.anthropic.models[0]);
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  // 正在向伺服器驗證金鑰；期間鎖住表單，避免重複送出或在驗證途中修改內容
  const [verifying, setVerifying] = useState(false);

  const config = PROVIDERS[provider];

  /**
   * 切換供應商：模型改回該供應商的預設；
   * 若切回已儲存的供應商就還原原本的金鑰，否則清空（兩家金鑰格式不同）。
   */
  function handleProviderChange(next: Provider) {
    setProvider(next);
    setModel(saved?.provider === next ? saved.model : PROVIDERS[next].models[0]);
    setApiKey(saved?.provider === next ? saved.apiKey : "");
    setError("");
    setSavedNotice(false);
  }

  /**
   * 儲存流程：
   * 1. 先在前端檢查金鑰格式，明顯錯誤就不送出
   * 2. 呼叫 /api/verify-key，由伺服器向供應商確認金鑰有效、帳號能使用所選模型
   * 3. 驗證通過才存進 localStorage；失敗則顯示原因並停留在原頁，原本已儲存的設定不受影響
   */
  async function handleSave(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (verifying) return;
    const key = apiKey.trim();
    const formatError = checkKeyFormat(provider, key);
    if (formatError) {
      setError(formatError);
      return;
    }

    setVerifying(true);
    setError("");
    setSavedNotice(false);
    try {
      const res = await fetch("/api/verify-key", {
        method: "POST",
        headers: {
          [LLM_HEADERS.provider]: provider,
          [LLM_HEADERS.apiKey]: key,
          [LLM_HEADERS.model]: model,
        },
      });
      const data: VerifyKeyResponse = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }
      saveLlmSettings({ provider, apiKey: key, model });
      setSavedNotice(true);
    } catch {
      // 網路中斷或伺服器沒有回應 JSON；無法確認金鑰，因此不儲存
      setError("無法連線驗證金鑰，請檢查網路後再試一次。");
    } finally {
      setVerifying(false);
    }
  }

  /** 從瀏覽器刪除金鑰，並把表單清回初始狀態 */
  function handleClear() {
    clearLlmSettings();
    setProvider("anthropic");
    setModel(PROVIDERS.anthropic.models[0]);
    setApiKey("");
    setError("");
    setSavedNotice(false);
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-8">
      {/* 驗證期間以 fieldset disabled 一次鎖住所有輸入欄位與選項按鈕 */}
      <fieldset disabled={verifying} className="flex flex-col gap-8 disabled:opacity-60">
        {/* 供應商選擇：分段按鈕，語意上為單選群組 */}
        <div className="flex flex-col gap-3">
          <span id="provider-label" className={eyebrow}>
            AI 供應商
          </span>
          <div
            role="radiogroup"
            aria-labelledby="provider-label"
            className="inline-flex self-start rounded-full border border-line bg-surface p-1"
          >
            {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={p === provider}
                onClick={() => handleProviderChange(p)}
                className={`rounded-full px-5 py-1.5 text-sm tracking-wide transition ${
                  p === provider ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
                }`}
              >
                {PROVIDERS[p].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label htmlFor="model" className={eyebrow}>
            模型
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setSavedNotice(false);
            }}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none transition focus:border-accent sm:max-w-xs"
          >
            {config.models.map((m, i) => (
              <option key={m} value={m}>
                {m}
                {i === 0 ? "（預設）" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3">
          <label htmlFor="api-key" className={eyebrow}>
            {config.label} API 金鑰
          </label>
          <div className="flex gap-2">
            <input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError("");
                setSavedNotice(false);
              }}
              placeholder={config.keyPlaceholder}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "api-key-error" : undefined}
              // 避免瀏覽器自動填入、自動修正或拼字檢查把金鑰送去雲端服務
              autoComplete="off"
              // 請密碼管理器（Bitwarden、1Password、LastPass 等）忽略此欄位：
              // 這是 API 金鑰而非登入密碼，擴充功能注入的元素也曾在 Safari 造成頁面錯誤
              data-bwignore="true"
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`min-w-0 flex-1 rounded-2xl border bg-surface px-4 py-3 font-mono text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent ${
                error ? "border-[#c98a72]" : "border-line"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className={secondaryButton}
              aria-pressed={showKey}
            >
              {showKey ? "隱藏" : "顯示"}
            </button>
          </div>
          <a
            href={config.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-xs text-accent underline-offset-4 hover:underline"
          >
            到 {config.label} 後台取得 API 金鑰 ↗
          </a>
          {/* 驗證失敗的原因；role="alert" 讓螢幕閱讀器立即唸出 */}
          {error && (
            <p
              id="api-key-error"
              role="alert"
              className="rounded-xl border border-[#d9b8a8] bg-[#f6ebe5] px-4 py-2.5 text-sm text-[#8a4b35] dark:border-[#5a3a2e] dark:bg-[#2e2420] dark:text-[#e0b3a0]"
            >
              {error}
            </p>
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-8">
        <button type="submit" disabled={verifying} className={primaryButton}>
          {verifying ? "驗證金鑰中…" : "驗證並儲存"}
        </button>
        {saved && (
          <button
            type="button"
            onClick={handleClear}
            disabled={verifying}
            className={secondaryButton}
          >
            清除金鑰
          </button>
        )}
        {savedNotice && (
          <span className="text-sm text-accent" role="status">
            已儲存在此瀏覽器 ✓
          </span>
        )}
      </div>

      {/* 已儲存時顯示目前設定（金鑰遮蔽）與前往面試的捷徑 */}
      {saved && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 text-sm">
          <span className="text-muted">
            目前使用：
            <span className="text-ink">
              {PROVIDERS[saved.provider].label} · {saved.model}
            </span>{" "}
            · <span className="font-mono">{maskKey(saved.apiKey)}</span>
          </span>
          <Link href="/interview" className="text-accent underline-offset-4 hover:underline">
            開始模擬面試 →
          </Link>
        </div>
      )}
    </form>
  );
}
