# Lagom — AI 面試模擬器

貼上職缺描述，AI 面試官會依職缺量身出題、針對你的回答追問，面試結束後給你 **1–10 分的契合度評分**、整體評論，以及**逐題的檢討與建議**。

> Lagom 是瑞典語「剛剛好」的意思，整個網站採用北歐風設計。

## 功能

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
| AI | [Anthropic Claude API](https://docs.claude.com)（`@anthropic-ai/sdk`，模型 `claude-opus-5-5`） |

## 快速開始

### 1. 環境需求

- Node.js 20.9 以上
- 一組 Anthropic API 金鑰（可在 [Anthropic Console](https://console.anthropic.com/) 申請）

### 2. 安裝

```bash
git clone https://github.com/louis561kimo/ai-interview.git
cd ai-interview
npm install
```

### 3. 設定環境變數

複製範例檔，並填入你的 API 金鑰：

```bash
cp .env.example .env.local
```

```env
# .env.local
ANTHROPIC_API_KEY=你的金鑰
```

> `.env.local` 已被 `.gitignore` 排除，不會被提交到 Git。請勿把金鑰寫進程式碼或其他會被提交的檔案。

### 4. 啟動開發伺服器

```bash
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000) 即可看到首頁，點「開始面試」進入面試頁。

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
│   ├── interview/
│   │   └── page.tsx           # 面試頁 /interview
│   └── api/
│       └── interview/
│           └── route.ts       # 面試 API：POST /api/interview
├── components/
│   ├── interview-app.tsx      # 面試互動介面（輸入職缺、問答、結果）
│   ├── site-header.tsx        # 全站頂部導覽列
│   ├── site-footer.tsx        # 全站頁尾
│   ├── logo.tsx               # 品牌標誌與產品名稱
│   └── score-bar.tsx          # 10 格分數條
└── lib/
    ├── interview.ts           # 前後端共用的型別與題數設定
    └── styles.ts              # 共用的 Tailwind class（按鈕、標籤等）
```

## API 說明

### `POST /api/interview`

API 是**無狀態**的：伺服器不保存面試紀錄，前端每次呼叫都帶上完整的對話紀錄。後端依「已回答的題數」決定要出下一題，還是產生評分結論。

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

// 發生錯誤
{ "type": "error", "error": "請輸入職缺描述" }
```

## 自訂設定

| 想調整的項目 | 修改位置 |
| --- | --- |
| 可選題數 | `src/lib/interview.ts` 的 `QUESTION_COUNT_OPTIONS` |
| 網站配色 | `src/app/globals.css` 最上方的 CSS 變數（淺色與深色模式各一組） |
| 產品名稱 | `src/components/logo.tsx` 的 `PRODUCT_NAME`（首頁標語與 `layout.tsx` 的標題也需一併修改） |
| 面試官角色與評分規則 | `src/app/api/interview/route.ts` 的 `systemPrompt` 與評分指示 |
| 使用的模型 | `src/app/api/interview/route.ts` 的 `MODEL` |

## 注意事項

- 每次出題或評分都會呼叫 Claude API，會依用量計費。
- 對話紀錄由前端送出，使用者理論上可以竄改。這個專案適合個人練習使用；若要正式上線，建議改由伺服器保存面試狀態，並加上速率限制。
