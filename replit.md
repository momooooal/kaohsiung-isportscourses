# 高雄運動 i 臺灣課程查詢

## Run & Operate

- `pnpm --filter @workspace/kaohsiung-sport-courses run dev` — 執行前端開發伺服器。
- `pnpm --filter @workspace/kaohsiung-sport-courses run build` — 建置 GitHub Pages 前端。
- `python scripts/sync_isports.py` — 同步 i運動資訊平台資料。
- `pnpm run typecheck` — 檢查 workspace TypeScript。

## Current production architecture

- Frontend: React 19 + Vite + Tailwind CSS。
- Hosting: GitHub Pages。
- Data synchronization: Python + Playwright + BeautifulSoup，透過 GitHub Actions 每日執行兩次。
- Runtime data: `artifacts/kaohsiung-sport-courses/public/data/*.json`。
- Production frontend does not require PostgreSQL or the API server.

## Data rules

- 僅顯示課程場次地址位於高雄市的常態性課程。
- 必須與「運動課程」中活動來源為「運動i臺灣計畫」的資料配對成功。
- 不確定的資料寫入 `unmatched-courses.json`，不可直接顯示。
- 同步失敗時必須保留上一次成功的 `courses.json`。
- 官方資料優先；不可自行宣稱名額或報名狀態。

## Where things live

- `artifacts/kaohsiung-sport-courses` — 正式前端。
- `scripts/sync_isports.py` — 資料抓取、解析、篩選與配對。
- `.github/workflows/sync-and-deploy.yml` — 自動同步、建置與部署。
- `artifacts/api-server`、`lib/db` — 原 Replit 後端架構，保留但目前未供 GitHub Pages 使用。

## Gotchas

- i運動資訊平台是 ASP.NET Web Forms 網站，HTML、分頁或控制項改版後可能需要調整 scraper。
- GitHub Pages 必須在 Repository Settings → Pages 將 Source 設為 GitHub Actions。
- GitHub Actions 是定時同步，不是官方網站更新後立即同步。
