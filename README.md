# Stock Sentinel｜台股紀律交易助手（網頁版 v0.2）

## 立即部署至 GitHub Pages
1. 登入 GitHub，新增一個專用 Repository，建議名稱 `stock-sentinel`。
2. 將 ZIP 解壓後 **資料夾內的檔案** `index.html`、`manifest.webmanifest`、`icon.svg`、`sw.js` 上傳至 Repository 根目錄；請勿上傳任何私人持股 JSON 備份。
3. 開啟 Repository 的 **Settings → Pages → Build and deployment**。
4. Source 選 `Deploy from a branch`，Branch 選 `main`、資料夾選 `/(root)`，按 Save。
5. 完成發布後網址通常為 `https://<GitHub帳號>.github.io/stock-sentinel/`，以 GitHub 頁面顯示的實際網址為準。
6. 手機或 iPad 可從瀏覽器分享選單選「加入主畫面」。

## 第一版能力與限制
- 自選股、加碼／停利／停損價位與交易日誌：儲存於**每個裝置的瀏覽器 localStorage**，不會被放上 GitHub。換裝置**不會自動同步**。
- 官方臺灣證交所及櫃買中心最新盤後行情 API：依瀏覽器 CORS／網路情況可能失敗。只顯示**最近十天內且日期有效**的參考收盤價。
- 通知：僅在網頁開啟、瀏覽器允許且行情成功更新時提示。**不支援關閉網頁後的雲端提醒、手機背景推播，也不會自動下單。**
- 若官方價格無法驗證，保持空白而非使用假行情。
- 假期超過 10 天時暫時無法觸發提醒；需等到有足夠新行情。
- 沒有內建任何真實持股資料；第一次開啟空白，請自行輸入。
- 一般瀏覽器通知在 iOS 上可能受限，需透過加入主畫面的網頁 App 並允許通知，仍不代表具備背景監測。
- 本版不調整除權息、交易費或換股因素，績效僅供輔助。

## 安全
- **絕對不要把私人 JSON 匯出檔、券商帳密、API token 上傳到公開 GitHub Repository。**
- 若使用共用電腦，請不要輸入私密投資資訊。資料保存在瀏覽器，但未加密，使用該瀏覽器的人可能讀到。
- JSON 備份需另外安全保存；刪除瀏覽器網站資料會遺失紀錄。
- 目前不包含帳號、雲端同步、後台或伺服器，亦不保證行情更新頻率。