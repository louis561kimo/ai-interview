// BYOK（Bring Your Own Key）的供應商設定，前端設定頁與後端 API 共用。
// 使用者自備 Anthropic 或 OpenAI 的 API 金鑰，伺服器不使用任何自己的金鑰。

export const PROVIDERS = {
  anthropic: {
    label: "Anthropic",
    keyPrefix: "sk-ant-",
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
    // 第一個為預設模型；只開放清單內的模型，避免使用者選到不支援所需參數的舊模型
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  },
  openai: {
    label: "OpenAI",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"],
  },
} as const;

export type Provider = keyof typeof PROVIDERS;

/** 使用者在設定頁儲存、並存放在瀏覽器 localStorage 的內容 */
export type LlmSettings = {
  provider: Provider;
  apiKey: string;
  model: string;
};

/**
 * 前端呼叫 /api/interview 時，用這幾個 HTTP 標頭帶上設定。
 * 金鑰放在標頭而不是網址，避免出現在瀏覽紀錄或存取日誌的 URL 中。
 */
export const LLM_HEADERS = {
  provider: "x-llm-provider",
  apiKey: "x-llm-api-key",
  model: "x-llm-model",
} as const;

/** POST /api/verify-key 的回應：驗證成功，或附上可直接顯示的錯誤訊息 */
export type VerifyKeyResponse = { ok: true } | { ok: false; error: string };

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && Object.hasOwn(PROVIDERS, value);
}

/** 模型是否在該供應商的允許清單中 */
export function isAllowedModel(provider: Provider, model: unknown): model is string {
  return (PROVIDERS[provider].models as readonly string[]).includes(model as string);
}

/**
 * 金鑰格式的基本檢查（不代表金鑰有效，真正的驗證由供應商 API 負責）。
 * Anthropic 金鑰以 sk-ant- 開頭；OpenAI 金鑰以 sk- 開頭，但不會是 sk-ant-。
 */
export function checkKeyFormat(provider: Provider, key: string): string | null {
  if (!key) return "請輸入 API 金鑰";
  if (/\s/.test(key) || key.length > 500) return "金鑰格式不正確";
  if (provider === "anthropic" && !key.startsWith("sk-ant-")) {
    return "Anthropic 的金鑰應以 sk-ant- 開頭";
  }
  if (provider === "openai" && (!key.startsWith("sk-") || key.startsWith("sk-ant-"))) {
    return "OpenAI 的金鑰應以 sk- 開頭（sk-ant- 開頭的是 Anthropic 金鑰）";
  }
  return null;
}

/** 遮蔽金鑰，只顯示開頭與結尾幾碼，例如 sk-ant-…a1b2 */
export function maskKey(key: string) {
  return key.length <= 12 ? "••••" : `${key.slice(0, 7)}…${key.slice(-4)}`;
}
