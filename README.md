# Money Trading Intelligence Dashboard

以 React + Vite 建置的多交易所加密貨幣監控儀表板，串接 REST API 與 WebSocket 取得即時行情，提供價格/成交量對比圖、買賣深度視覺化、大戶告警，以及錢包搜尋與追蹤功能。

## 主要功能

- 📈 **多交易所價格、成交量對比**：同時呈現多個交易所的即時價格走勢與成交量疊圖，便於比較市場動態。
- 📊 **買賣深度視覺化**：將各交易所的買賣掛單深度轉換為面積圖，協助判斷流動性與掛單分布。
- 🚨 **大戶告警串流**：接收後端 WebSocket 推播，顯示大額交易資訊並快速連結到鏈上交易紀錄。
- 👛 **錢包搜尋/關注**：透過 REST API 搜尋錢包，查看詳細資訊並加入追蹤清單，並提供專屬錢包詳情頁面。
- ⚡ **效能與體驗**：採用 React Query、Zustand 等工具搭配 Tailwind CSS 優化 UI/UX 與資料更新流程，確保低延遲體驗。

## 系統需求

- Node.js 18 以上
- pnpm / npm / yarn 任一套件管理工具

## 開發流程

```bash
# 安裝依賴
pnpm install

# 啟動前端開發伺服器
pnpm dev

# 啟動模擬後端（REST + WebSocket）
pnpm server

# 建置正式版
pnpm build

# 預覽正式版
pnpm preview
```

預設會連線到 `http://localhost:4000` 的 REST API 與 `ws://localhost:4000/ws` 的 WebSocket，可透過以下環境變數覆寫：

- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`

後端伺服器會即時呼叫 `https://api1.binance.com` 的公開介面並透過 Binance WebSocket stream 擷取 BTC/USDT、ETH/USDT、BNB/USDT 的行情、深度與 24 小時統計數據，再以統一格式回傳給前端儀表板。

## 專案結構

```
money/
├── src/
│   ├── api/                # REST / WebSocket 客戶端
│   ├── components/         # 儀表板 UI 元件
│   ├── hooks/              # 共用 hook（行情、告警、搜尋等）
│   ├── pages/              # React Router 頁面（錢包詳情）
│   ├── store/              # Zustand 本地狀態（追蹤清單）
│   ├── styles/             # Tailwind 基底樣式
│   └── utils/              # 格式化工具
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

## 後端整合

請提供以下 API/WS 介面以串接資料：

- `GET /exchanges`：回傳交易所資訊（價格、24h 漲跌、成交量、狀態、延遲）。
- `WS market` topic：推播 `timestamp`、`prices`、`volumes`、`depth`、`latency` 等行情資料。
- `GET /alerts/whales` 與 `WS whale-alerts`：提供最新大戶交易告警。
- `GET /wallets/search?q=`：錢包搜尋結果。
- `GET /wallets/:address`：錢包詳細資訊、持倉、交易紀錄。

可依需求在後端實作快取與節流，確保 WebSocket 推播延遲 < 1 秒。
