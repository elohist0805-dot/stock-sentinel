# Stock Sentinel — 安全雲端同步後端（尚須部署）
這個資料夾提供 Cloudflare Worker + D1 的私人同步伺服器。**本程式碼在 GitHub 上並不等於已建好雲端資料庫。**
為保護私人股票資料，Github Pages 僅存放前端；資料只能經過 Worker 的密碼驗證、10 小時限期 Token 後讀寫 D1。

## Cloudflare 部署
1. 以自己的 Cloudflare 帳號操作，建立名為 `stock-sentinel-private` 的 **新 D1 資料庫**，不要與班級公告資料庫混用。
2. 以 Wrangler / Cloudflare CLI 登入；在本儲存庫 `cloudflare/` 目錄：
   - 複製 `wrangler.example.toml` 成 `wrangler.toml`，填入 D1 資料庫 ID。
   - `npx wrangler d1 execute stock-sentinel-private --remote --file=schema.sql`
   - `npx wrangler secret put LOGIN_PASSPHRASE`（自行設定 12 字以上且不易猜的密碼；不要發送給 AI）
   - `npx wrangler secret put SESSION_SECRET`（自行設定高強度隨機密鑰，至少 32 字元，不能與登入密碼相同）
   - `npx wrangler deploy`
3. 記下最後顯示的 `https://....workers.dev` 網址，在 Stock Sentinel 網站「雲端同步設定」中輸入這個網址，並輸入驗證碼登入。
4. **首次登入先匯出舊資料 JSON 備份**。若雲端空白，可點「把本機資料上傳雲端」完成一次性移轉；若雲端已有資料，先讀取而不直接覆蓋。

## 安全約束
- Cloudflare Worker 的 `LOGIN_PASSPHRASE` 和 `SESSION_SECRET` 必須是 Worker Secrets，不可寫入 GitHub、Cloudflare 公開變數或瀏覽器程式。
- 此版屬單一持有人驗證碼機制：**知道驗證碼的人都能讀取與覆寫這份資料**，不是多使用者帳號系統。
- GitHub Pages 網址固定，僅允許 `https://elohist0805-dot.github.io` 的 Origin 呼叫；這是瀏覽器來源限制，真正的存取權限仍由 Token 控制。
- Worker 以 D1 記錄登入失敗次數，5 次錯誤封鎖 15 分鐘（以來源 IP 區分）。
- 雲端版本號避免另一台裝置覆寫較新的資料。發生衝突時，應先備份本機資料，再重新下載雲端資料。
- 成功登入後令牌在目前分頁 sessionStorage 中保存約十小時；請勿在共用電腦登入。
- 同步不包含即時監控或自動下單。
- D1 內容並未做端到端加密；Cloudflare 及具有雲端管理員權限者能存取，請勿將證券帳戶密碼、身分證號或交易憑證寫入交易備註。
- 若設定遺失，可用「匯出 JSON」還原；建議每月至少備份一次。

參考官方說明：https://developers.cloudflare.com/d1/get-started/ 、https://developers.cloudflare.com/workers/configuration/secrets/
