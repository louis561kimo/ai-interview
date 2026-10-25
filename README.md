# Lagom — AI 面試模擬器

貼上職缺描述，AI 面試官會依職缺量身出題、針對你的回答追問，面試結束後給你 **1–10 分的契合度評分**、整體評論，以及**逐題的檢討與建議**。

> Lagom 是瑞典語「剛剛好」的意思，整個網站採用北歐風設計。

## 功能

- **BYOK（Bring Your Own Key）**：使用者在「設定」頁填入自己的 Anthropic 或 OpenAI API 金鑰，費用由使用者的帳號計算。伺服器不使用、也不儲存任何金鑰。
- **依職缺出題**：題目緊扣職缺描述中的職責與技能要求。
- **追問**：從第 2 題起，面試官會判斷要針對上一題的回答追問，或換一個新面向。
- **可選題數**：每場面試可選 3 題或 5 題。
- **評分結論**：
  - 總分（1–10 分，10 分最佳），評估回答與職缺的契合度
  - 整體評論
  - 逐題檢討與建議
  - 整體改進建議
- **不保存紀錄**：伺服器不儲存面試內容，對話只存在瀏覽器分頁中。
- **深色模式**：跟隨作業系統設定。

## 技術架構

| 項目 | 使用技術 |
| --- | --- |
| 框架 | [Next.js 16](https://nextjs.org)（App Router）、React 19、TypeScript |
| 樣式 | Tailwind CSS 4 |
| AI | [Anthropic API](https://docs.claude.com)（`@anthropic-ai/sdk`）、[OpenAI API](https://platform.openai.com/docs)（`openai`） |

## BYOK：API 金鑰如何處理

```
瀏覽器 localStorage ──(HTTPS 標頭)──▶ /api/interview ──▶ Anthropic / OpenAI
   （唯一儲存的地方）                  （只轉呼叫，用完即丟）
```

1. 使用者在 `/settings` 選擇供應商與模型、填入金鑰，按「驗證並儲存」。
   前端先呼叫 `/api/verify-key`，由伺服器向供應商查詢該模型的資訊（不產生內容、不花費 token）：
   - 驗證通過 → 存進瀏覽器的 `localStorage`
   - 金鑰無效或帳號無法使用該模型 → 顯示原因並停在原頁，不儲存
2. 面試時，前端把金鑰放在 HTTP 標頭（`x-llm-provider`、`x-llm-api-key`、`x-llm-model`）送到 `/api/interview`。
3. 伺服器用這把金鑰建立該次請求專用的 SDK client，呼叫供應商 API 後就丟棄。
   - 不讀取任何伺服器環境變數中的金鑰
   - 錯誤紀錄只寫錯誤類型與狀態碼，不寫入金鑰或請求標頭
4. 使用者可隨時在設定頁按「清除金鑰」從瀏覽器刪除。

可選的模型（定義在 `src/lib/providers.ts`）：

| 供應商 | 模型（第一個為預設） |
| --- | --- |
| Anthropic | `claude-haiku-5-5`、`claude-sonnet-5-5`、`claude-opus-5-5` |
| OpenAI | `gpt-5.4-mini`、`gpt-5.4`、`gpt-5.5` |

## 快速開始

### 1. 環境需求

- Node.js 20.9 以上
- 不需要設定任何環境變數。使用時在網站的「設定」頁填入你自己的 [Anthropic](https://console.anthropic.com/settings/keys) 或 [OpenAI](https://platform.openai.com/api-keys) API 金鑰即可。

### 2. 安裝與啟動

```bash
git clone https://github.com/louis561kimo/ai-interview.git
cd ai-interview
npm install
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)，先到「設定」頁填入 API 金鑰，再點「開始面試」。

### 其他指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器（修改程式碼會自動重新載入） |
| `npm run build` | 建置正式版本 |
| `npm run start` | 執行建置好的正式版本 |
| `npm run lint` | 執行 ESLint 檢查 |

## 專案結構

```
src/
├── app/
│   ├── page.tsx               # 首頁（產品介紹 Landing Page）
│   ├── layout.tsx             # 根版面：共用 header / footer、網站 metadata
│   ├── globals.css            # 北歐風設計 token（顏色、字型）與全域樣式
│   ├── interview/page.tsx     # 面試頁 /interview
│   ├── settings/page.tsx      # API 金鑰設定頁 /settings
│   ├── api/interview/route.ts # 面試 API：POST /api/interview
│   └── api/verify-key/route.ts # 金鑰驗證 API：POST /api/verify-key
├── components/
│   ├── interview-app.tsx      # 面試互動介面（輸入職缺、問答、結果）
│   ├── settings-form.tsx      # 金鑰設定表單（供應商、模型、金鑰）
│   ├── key-privacy-note.tsx   # 金鑰隱私說明（設定頁、面試頁共用）
│   ├── site-header.tsx        # 全站頂部導覽列
│   ├── site-footer.tsx        # 全站頁尾
│   ├── logo.tsx               # 品牌標誌與產品名稱
│   └── score-bar.tsx          # 10 格分數條
└── lib/
    ├── interview.ts           # 前後端共用的型別與題數設定
    ├── providers.ts           # 供應商、可選模型、金鑰格式檢查（前後端共用）
    ├── use-llm-settings.ts    # 讀寫 localStorage 中金鑰設定的 React hook
    ├── llm.ts                 # 伺服器端：統一呼叫 Anthropic / OpenAI 並整理錯誤訊息
    └── styles.ts              # 共用的 Tailwind class（按鈕、標籤等）
```

## API 說明

### `POST /api/interview`

API 是**無狀態**的：伺服器不保存面試紀錄，前端每次呼叫都帶上完整的對話紀錄。後端依「已回答的題數」決定要出下一題，還是產生評分結論。

**請求標頭（BYOK）**

| 標頭 | 說明 |
| --- | --- |
| `x-llm-provider` | `anthropic` 或 `openai` |
| `x-llm-api-key` | 使用者自己的 API 金鑰 |
| `x-llm-model` | 模型名稱，必須是該供應商可選模型之一 |

**請求內容**

```json
{
  "jobDescription": "前端工程師：熟悉 React 與 TypeScript……",
  "totalQuestions": 3,
  "history": [
    { "role": "interviewer", "content": "第 1 題的題目" },
    { "role": "candidate", "content": "使用者的回答" }
  ]
}
```

| 欄位 | 說明 |
| --- | --- |
| `jobDescription` | 職缺描述，必填，最多 8000 字 |
| `totalQuestions` | 題數，只能是 `3` 或 `5`，未提供時為 `3` |
| `history` | 對話紀錄，必須依序為面試官、候選人交錯成對；第一次呼叫傳空陣列 `[]` |

**回應內容**（以 `type` 區分）

```jsonc
// 還沒答滿：下一題
{ "type": "question", "questionNumber": 2, "question": "……" }

// 已答滿：評分結論
{
  "type": "result",
  "evaluation": {
    "score": 7,
    "comment": "整體評論……",
    "questionReviews": [{ "review": "檢討……", "suggestion": "建議……" }],
    "suggestions": ["整體建議……"]
  }
}

// 發生錯誤（例如金鑰無效回 401、額度不足回 429）
{ "type": "error", "error": "API 金鑰無效，請到「設定」頁確認金鑰是否正確。" }
```

### `POST /api/verify-key`

使用與 `/api/interview` 相同的三個請求標頭，不需要請求內容。

```jsonc
{ "ok": true }                                    // 金鑰有效，且帳號能使用所選模型
{ "ok": false, "error": "這組 Anthropic API 金鑰無效……" } // 401 / 403 / 404 等
```

> 這項驗證無法檢查帳號餘額；額度不足要到實際出題時才會回報錯誤。

## 自訂設定

| 想調整的項目 | 修改位置 |
| --- | --- |
| 可選題數 | `src/lib/interview.ts` 的 `QUESTION_COUNT_OPTIONS` |
| 可選供應商與模型 | `src/lib/providers.ts` 的 `PROVIDERS` |
| 網站配色 | `src/app/globals.css` 最上方的 CSS 變數（淺色與深色模式各一組） |
| 產品名稱 | `src/components/logo.tsx` 的 `PRODUCT_NAME`（首頁標語與 `layout.tsx` 的標題也需一併修改） |
| 面試官角色與評分規則 | `src/app/api/interview/route.ts` 的 `systemPrompt` 與評分指示 |

## 注意事項

- AI 的費用由使用者自己的 API 帳號計算，建議使用者在供應商後台為金鑰設定用量上限。
- 金鑰存在 `localStorage`，同一台電腦、同一個瀏覽器的人都讀得到；在共用電腦上使用後應清除。
- 對話紀錄由前端送出，使用者理論上可以竄改。這不影響他人（費用由使用者自己負擔），但若要做成正式服務，建議改由伺服器保存面試狀態。
