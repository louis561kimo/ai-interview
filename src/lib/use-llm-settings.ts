"use client";

import { useMemo, useSyncExternalStore } from "react";
import { isAllowedModel, isProvider, type LlmSettings } from "@/lib/providers";

// 使用者的 API 金鑰設定只存在瀏覽器的 localStorage，不會送到我們的伺服器儲存。
const STORAGE_KEY = "lagom.llm-settings";
// 同一分頁內儲存或清除設定時發出的事件；localStorage 原生的 storage 事件只會通知「其他」分頁
const CHANGE_EVENT = "lagom:llm-settings-change";

/** 訂閱設定變更：其他分頁（storage 事件）與本分頁（自訂事件）都會觸發重新讀取 */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * 讀取 localStorage 原始字串。回傳字串（而非解析後的物件），
 * 讓 useSyncExternalStore 能以值比較判斷是否有變化。
 * 無痕模式或封鎖網站資料時存取可能拋錯，此時當作沒有設定。
 */
function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 伺服器端渲染時沒有 localStorage，回傳 undefined 代表「尚未讀取」 */
function getServerSnapshot() {
  return undefined;
}

/** 解析並驗證儲存的內容，格式不符（例如舊版資料或被手動修改）就視為沒有設定 */
function parseSettings(raw: string | null | undefined): LlmSettings | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      isProvider(value?.provider) &&
      typeof value.apiKey === "string" &&
      value.apiKey &&
      isAllowedModel(value.provider, value.model)
    ) {
      return { provider: value.provider, apiKey: value.apiKey, model: value.model };
    }
  } catch {
    // JSON 格式錯誤，當作沒有設定
  }
  return null;
}

/**
 * 讀取目前的 API 金鑰設定。
 * - ready：是否已在瀏覽器中讀取完成（伺服器渲染與 hydration 期間為 false）
 * - settings：已儲存的設定，沒有則為 null
 */
export function useLlmSettings() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const settings = useMemo(() => parseSettings(raw), [raw]);
  return { ready: raw !== undefined, settings };
}

/** 將設定存進 localStorage，並通知同分頁的其他元件更新 */
export function saveLlmSettings(settings: LlmSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 從 localStorage 刪除設定 */
export function clearLlmSettings() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
