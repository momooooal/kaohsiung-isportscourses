# 高雄運動 i 臺灣資訊查詢

整合 i運動資訊平台「常態性課程」與「系列活動」的高雄市運動 i 臺灣資訊查詢網站。

## 網站資料原則

### 常態課程

前台只顯示同時符合以下條件的資料：

1. 常態性課程的實際場次地址位於高雄市。
2. 能與「運動課程」中活動來源為「運動i臺灣計畫」的資料交叉配對。
3. 配對分數達到程式設定的最低門檻；不確定的資料會寫入 `unmatched-courses.json`，不直接顯示。

### 系列活動

前台只顯示官方「系列活動」頁面中：

1. 縣市篩選為「高雄市」。
2. 活動來源篩選為「運動i臺灣計畫」。
3. 來源篩選與高雄市篩選均成功套用的活動。

系列活動會讀取全部分頁及活動詳細頁，並另以官方 Open Data API 補充活動類別、活動編號、活動網站及停辦註記。API 暫時無法讀取時，仍會保留官方網頁同步結果。

資料來源：運動部全民運動署 i運動資訊平台。實際課程、活動、名額、辦理情形及報名資訊，仍以官方平台與主辦單位最新公告為準。

## 第一次上傳到 GitHub

1. 將本壓縮檔的「內容」完整上傳到 Repository 根目錄，不要再多包一層資料夾。
2. 進入 Repository 的 `Settings` → `Pages`。
3. 在 `Build and deployment` 的 `Source` 選擇 **GitHub Actions**。
4. 回到 Repository 上方的 `Actions` 分頁，開啟 `Sync iSports and deploy GitHub Pages`。
5. 第一次上傳到 `main` 後會自動執行；也可按 `Run workflow` 手動執行。

同步完成後，GitHub Actions 會：

- 讀取官方常態性課程全部分頁及詳細頁。
- 讀取官方運動課程，篩選高雄市與「運動i臺灣計畫」。
- 交叉比對運動課程與常態性課程。
- 讀取官方系列活動全部分頁及詳細頁。
- 將系列活動篩選為高雄市與「運動i臺灣計畫」。
- 更新網站使用的 JSON。
- 建置並發布 GitHub Pages。

## 自動同步頻率

GitHub Actions 預定每天執行兩次：

- 臺灣時間約 **上午 06:37**
- 臺灣時間約 **下午 15:37**

工作流程會先同步常態課程與系列活動，再建置並發布網站，因此民眾實際看到新資料的時間通常會比排程時間晚數分鐘至數十分鐘。此機制屬於「定時同步」，不是官方網站變更後立即同步。

## 重要資料檔

```text
artifacts/kaohsiung-sport-courses/public/data/
├── courses.json             # 前台顯示的已驗證常態課程
├── series-activities.json   # 高雄市運動i臺灣系列活動
├── sync-status.json         # 最近同步狀態
└── unmatched-courses.json   # 無法可靠配對的常態課程
```

兩種資料分開保存。系列活動同步失敗時，不會清空既有 `series-activities.json`，也不會影響原本的 `courses.json`。

## 專案結構

```text
artifacts/kaohsiung-sport-courses/  React + Vite 前端
scripts/sync_isports.py             常態課程同步及交叉配對
scripts/sync_series_activities.py   系列活動同步
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
python scripts/sync_series_activities.py

pnpm install
pnpm --filter @workspace/kaohsiung-sport-courses run dev
```

## 同步限制

來源網站是 ASP.NET Web Forms 網站，網站若更改欄位、分頁、HTML 結構、驗證或流量限制，同步程式可能需要調整。官方 API 不提供活動來源欄位，因此「是否為運動i臺灣計畫」仍以官方系列活動頁面的活動來源篩選結果為準。
