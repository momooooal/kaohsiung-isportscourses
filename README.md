# 高雄運動 i 臺灣課程查詢

整合 i運動資訊平台「運動課程」與「常態性課程」的高雄市課程查詢網站。

## 網站資料原則

前台只顯示同時符合以下條件的資料：

1. 常態性課程的實際場次地址位於高雄市。
2. 能與「運動課程」中活動來源為「運動i臺灣計畫」的資料交叉配對。
3. 配對分數達到程式設定的最低門檻；不確定的資料會寫入 `unmatched-courses.json`，不直接顯示。

資料來源：運動部全民運動署 i運動資訊平台。實際課程、名額、辦理情形及報名資訊，仍以官方平台與主辦單位最新公告為準。

## 第一次上傳到 GitHub

1. 將本壓縮檔的「內容」完整上傳到 Repository 根目錄，不要再多包一層資料夾。
2. 進入 Repository 的 `Settings` → `Pages`。
3. 在 `Build and deployment` 的 `Source` 選擇 **GitHub Actions**。
4. 進入 `Actions`，開啟 `Sync iSports and deploy GitHub Pages`。
5. 第一次上傳到 `main` 後會自動執行；也可按 `Run workflow` 手動執行。

同步完成後，GitHub Actions 會：

- 讀取官方常態性課程全部分頁及詳細頁。
- 讀取官方運動課程，篩選高雄市與「運動i臺灣計畫」。
- 交叉比對兩邊資料。
- 更新網站使用的 JSON。
- 建置並發布 GitHub Pages。

## 自動同步頻率

工作流程預設每日執行兩次（臺北時間約 06:37、15:37），也支援手動執行。這是定時同步，不是官方資料改動後立即同步。

## 重要資料檔

```text
artifacts/kaohsiung-sport-courses/public/data/
├── courses.json             # 前台顯示的已驗證課程
├── sync-status.json         # 最近同步狀態
└── unmatched-courses.json   # 無法可靠配對的課程
```

同步失敗時，程式不會把既有 `courses.json` 清空，而會保留最近一次成功資料。

## 專案結構

```text
artifacts/kaohsiung-sport-courses/  React + Vite 前端
scripts/sync_isports.py             官方資料同步及配對程式
.github/workflows/                  GitHub Actions 同步與部署設定
artifacts/api-server/               原 Replit API 專案（保留但目前不供 Pages 使用）
lib/                                原 Replit workspace 共用程式庫
```

## 本機執行

需要 Node.js、pnpm、Python 與 Playwright Chromium。

```bash
pip install -r scripts/requirements-sync.txt
playwright install chromium
python scripts/sync_isports.py

pnpm install
pnpm --filter @workspace/kaohsiung-sport-courses run dev
```

## 同步限制

來源網站是 ASP.NET Web Forms 網站，網站若更改欄位、分頁、HTML 結構、驗證或流量限制，同步程式可能需要調整。無法可靠確認活動來源的資料不會直接出現在前台。
