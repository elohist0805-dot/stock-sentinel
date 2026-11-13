# 盤中主動提醒設定（v0.4）
網站網址：https://elohist0805-dot.github.io/stock-sentinel/

GitHub Actions 每約五分鐘在臺灣一般交易時段檢查一次（排程可能延遲或漏跑），由使用者自己的 **Fugle 富果行情 API** 讀取當日最高／最低成交價，若碰觸設定門檻，向 **Telegram** 主動發訊息。這不是秒級監控、不是保證即時送達，也**不會自動下單**。

## 重要：需要由您自行設定四個 Repository Secrets
在 GitHub 儲存庫 Settings → Secrets and variables → Actions → New repository secret：

- `FUGLE_API_KEY`：自己申請的富果行情金鑰。請遵守授權與用量限制。
- `TELEGRAM_BOT_TOKEN`：透過 Telegram 官方 BotFather 建立機器人取得。
- `TELEGRAM_CHAT_ID`：先在 Telegram 對機器人送出 /start，再取得自己私聊的 chat ID。
- `ALERT_RULES_JSON`：在網站「自選股與買賣紀律」按「匯出盤中監控規則」，複製 JSON 的完整文字貼入 Secret 的 Value。

**請勿**把 API key、Bot token、chat ID、成本、持有股數或策略 JSON 放進公開儲存庫、issue、聊天訊息或網站程式碼。Secrets 僅供 Actions 後端讀取。當您在網站修改策略，必須重新匯出並更新 `ALERT_RULES_JSON`，不會自動同步。任何在網站輸入的私人資料仍只在該瀏覽器 localStorage。

排程在週一至週五約 09:00－13:35 執行，遇休市、行情非當日或 API 異常不觸發。使用當日最高／最低價判定是否「曾觸價」，因此可能在條件早已發生後才通知；同一標的同一條件同一天盡量只發一次。Actions cache 可能過期或失效，屆時可能重複通知。

參考： https://developer.fugle.tw/docs/data/http-api/intraday/quote/ 以及 https://core.telegram.org/bots/api
