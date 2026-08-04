#!/usr/bin/env python3
"""Synchronize Kaohsiung iSports series activities from the official platform.

The official page is filtered to:
- 縣市：高雄市
- 活動來源：運動i臺灣計畫
- 年度：current ROC year plus configured offsets

The result is written independently to series-activities.json so a temporary
series-activity failure never removes or blocks the regular-course data.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup
from playwright.async_api import Browser, async_playwright

from sync_isports import (
    BASE_URL,
    DATA_DIR,
    HEADLESS,
    MAX_DETAILS,
    TAIPEI_TZ,
    YEAR_OFFSETS,
    apply_filters,
    clean_text,
    collect_paginated,
    date_ranges_overlap,
    digits,
    district_from_addresses,
    extract_fields,
    extract_pkno,
    extract_title,
    fetch_details,
    find_registration_url,
    get_table_rows,
    goto_with_retry,
    normalize_text,
    now_iso,
    parse_activity_sessions,
    read_json,
    roc_range_to_iso,
    write_json_atomic,
)

SERIES_LIST_URL = (
    BASE_URL
    + "/Apps/TIS/TIS02/TIS0201M_01V1.aspx?ACT_TP_CD=2&MENU_PRG_CD=1&ITEM_PRG_CD=2"
)
SERIES_PATH = DATA_DIR / "series-activities.json"
STATUS_PATH = DATA_DIR / "sync-status.json"
API_LIST_URL = BASE_URL + "/Api/Rest/V1/Activity.svc/GetActivityList"

FIELD_LABELS_SERIES = [
    "活動名稱",
    "活動來源",
    "活動主辦單位",
    "主辦單位",
    "活動內容",
    "活動日期",
    "活動時間",
    "活動聯絡人",
    "聯絡人",
    "活動聯絡電話",
    "聯絡電話",
    "活動項目",
    "活動參與對象",
    "參與對象",
    "活動地點",
    "活動地址",
    "報名費用",
]


def parse_series_list(html: str) -> list[dict[str, Any]]:
    """Parse one filtered series-activity result page."""
    soup = BeautifulSoup(html, "lxml")
    entries: list[dict[str, Any]] = []
    for headers, _, table in get_table_rows(soup):
        joined = "|".join(headers)
        if "活動名稱" not in joined or "活動時間" not in joined:
            continue
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all(["th", "td"])
            link = tr.find("a", href=re.compile(r"TIS0201M_02V1\.aspx", re.I))
            if not cells or not link:
                continue
            values = [clean_text(cell.get_text(" ", strip=True)) for cell in cells]
            href = urljoin(SERIES_LIST_URL, clean_text(link.get("href", "")))
            source_code = parse_qs(urlparse(href).query).get("ACT_SOURCE_TP_CD", [""])[0]
            # The UI is filtered to source 02. If the link explicitly says another
            # source, reject it as an additional safeguard.
            if source_code and source_code != "02":
                continue
            entries.append(
                {
                    "title": clean_text(link.get_text(" ", strip=True)),
                    "activityPeriodRaw": values[1] if len(values) > 1 else "",
                    "detailUrl": href,
                    "activityPkno": extract_pkno(href),
                    "sourceCode": source_code or "02",
                    "sourceVerifiedByFilter": True,
                    "countyVerifiedByFilter": True,
                }
            )
    return entries


def unique_nonempty(values: list[str]) -> list[str]:
    return list(dict.fromkeys(clean_text(value) for value in values if clean_text(value)))


def derive_status(start_date: str, end_date: str, close_mark: str = "") -> str:
    if clean_text(close_mark).upper() == "Y":
        return "已停辦"
    today = datetime.now(TAIPEI_TZ).date().isoformat()
    if start_date and today < start_date:
        return "即將開始"
    if start_date and end_date and start_date <= today <= end_date:
        return "進行中"
    if end_date and today > end_date:
        return "已結束"
    return "辦理中"


def infer_activity_category(item: dict[str, Any]) -> str:
    """Fallback only when the official API does not provide activityType."""
    text = " ".join(
        [
            clean_text(item.get("title")),
            clean_text(item.get("description")),
            " ".join(clean_text(session.get("topic")) for session in item.get("sessions", [])),
        ]
    )
    rules: list[tuple[str, str]] = [
        (r"籃球", "籃球活動"),
        (r"羽球", "羽球活動"),
        (r"桌球", "桌球活動"),
        (r"壘球", "壘球活動"),
        (r"足球", "足球活動"),
        (r"網球", "網球活動"),
        (r"棒球", "棒球活動"),
        (r"親子", "親子活動"),
        (r"身心障礙|身障|特奧", "身障活動"),
        (r"原住民|原民", "原住民活動"),
        (r"銀髮|樂齡|中高齡|長者", "銀髮族活動"),
        (r"水域|游泳|立槳|SUP|龍舟|獨木舟|輕艇", "水域活動"),
        (r"自行車|單車|騎遊", "單車活動"),
        (r"路跑|跑步|馬拉松", "跑步"),
        (r"健走|健行|登山|步道", "登山健行"),
        (r"武術|拳擊|跆拳|柔道|空手道|太極|技擊", "技擊類"),
        (r"舞蹈|街舞|舞力|舞藝", "舞蹈活動"),
        (r"民俗|扯鈴|陀螺", "民俗活動"),
        (r"體適能|瑜珈|瑜伽|有氧|肌力|樂活", "運動樂活"),
        (r"槌球|木球|地板滾球|巧固球|躲避球|排球", "其他球類"),
    ]
    for pattern, category in rules:
        if re.search(pattern, text, re.I):
            return category
    return "其他運動"


def parse_series_detail(html: str, summary: dict[str, Any]) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    fields = extract_fields(soup, FIELD_LABELS_SERIES)
    sessions = parse_activity_sessions(soup)
    title = fields.get("活動名稱") or extract_title(soup, "系列活動") or summary.get("title", "")
    start_date, end_date = roc_range_to_iso(
        fields.get("活動日期") or fields.get("活動時間") or summary.get("activityPeriodRaw", "")
    )

    addresses = unique_nonempty(
        [fields.get("活動地址", "")]
        + [session.get("address", "") for session in sessions]
    )
    times = unique_nonempty(
        [fields.get("活動時間", "")]
        + [session.get("time", "") for session in sessions]
    )
    topics = unique_nonempty([session.get("topic", "") for session in sessions])
    districts = unique_nonempty(
        [district_from_addresses([address]) for address in addresses]
    )
    districts = [district for district in districts if district != "行政區待確認"]
    district = (
        districts[0]
        if len(districts) == 1
        else "多區辦理"
        if len(districts) > 1
        else "行政區待確認"
    )

    organizer = fields.get("活動主辦單位") or fields.get("主辦單位") or "未提供"
    contact = fields.get("活動聯絡人") or fields.get("聯絡人") or ""
    phone = fields.get("活動聯絡電話") or fields.get("聯絡電話") or ""
    if not phone:
        phone_match = re.search(
            r"(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}(?:#\d+)?)",
            contact,
        )
        phone = phone_match.group(0) if phone_match else ""

    detail_url = summary["detailUrl"]
    item: dict[str, Any] = {
        "id": f"series-{summary.get('activityPkno') or normalize_text(title)[:24]}",
        "itemType": "series-activity",
        "activityPkno": summary.get("activityPkno", ""),
        "activityNo": "",
        "title": title or "未命名系列活動",
        "category": fields.get("活動項目") or "",
        "categorySource": "official-page" if fields.get("活動項目") else "",
        "location": addresses[0] if addresses else "地點詳見官方頁面",
        "district": district,
        "districts": districts,
        "address": addresses[0] if addresses else "",
        "time": "、".join(times) if times else "時間詳見官方頁面",
        "startDate": start_date,
        "endDate": end_date,
        "status": derive_status(start_date, end_date),
        "spotsTotal": None,
        "spotsAvailable": None,
        "fee": fields.get("報名費用") or "未提供",
        "instructor": "不適用",
        "description": fields.get("活動內容") or "活動內容請參閱官方頁面。",
        "registrationUrl": find_registration_url(soup, detail_url),
        "detailUrl": detail_url,
        "activityWebsite": "",
        "organizer": organizer,
        "targetAudience": fields.get("活動參與對象") or fields.get("參與對象") or "未提供",
        "studentCategory": "",
        "contactName": contact,
        "contactPhone": phone,
        "sessions": sessions,
        "topics": topics,
        "source": "運動i臺灣計畫",
        "sourceVerified": bool(summary.get("sourceVerifiedByFilter")),
        "county": "高雄市",
        "countyVerified": bool(summary.get("countyVerifiedByFilter")),
        "rawActivityPeriod": summary.get("activityPeriodRaw", ""),
    }
    if not item["category"]:
        item["category"] = infer_activity_category(item)
        item["categorySource"] = "system-inferred"
    return item


def normalize_api_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if payload.get("activityName"):
            return [payload]
        return []
    if isinstance(payload, list):
        result: list[dict[str, Any]] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            if isinstance(item.get("data"), list):
                result.extend(value for value in item["data"] if isinstance(value, dict))
            elif item.get("activityName"):
                result.append(item)
        return result
    return []


def fetch_api_items(roc_year: int) -> list[dict[str, Any]]:
    params = {
        "county": "E",
        "activityKind": "2",
        "activityDateBegin": f"{roc_year}0101",
        "activityDateEnd": f"{roc_year}1231",
        "paging": "false",
    }
    request = Request(
        API_LIST_URL + "?" + urlencode(params),
        headers={"User-Agent": "kaohsiung-isports-courses/1.0"},
    )
    with urlopen(request, timeout=120) as response:
        return normalize_api_payload(json.loads(response.read().decode("utf-8")))


def api_date_to_iso(value: Any) -> str:
    text = clean_text(value)
    if re.fullmatch(r"\d{4}[-/]\d{2}[-/]\d{2}", text):
        return text.replace("/", "-")
    start, _ = roc_range_to_iso(text)
    return start


def enrich_with_api(items: list[dict[str, Any]], api_items: list[dict[str, Any]]) -> None:
    by_title: dict[str, list[dict[str, Any]]] = {}
    for api_item in api_items:
        key = normalize_text(api_item.get("activityName"))
        if key:
            by_title.setdefault(key, []).append(api_item)

    for item in items:
        candidates = by_title.get(normalize_text(item.get("title")), [])
        if not candidates:
            continue
        if len(candidates) > 1:
            overlapping = [
                candidate
                for candidate in candidates
                if date_ranges_overlap(
                    item.get("startDate", ""),
                    item.get("endDate", ""),
                    api_date_to_iso(candidate.get("activityDateBegin")),
                    api_date_to_iso(candidate.get("activityDateEnd")),
                )
            ]
            if overlapping:
                candidates = overlapping
        api_item = candidates[0]

        official_category = clean_text(api_item.get("activityType"))
        if official_category:
            item["category"] = official_category
            item["categorySource"] = "official-api"
        item["activityNo"] = clean_text(api_item.get("activityNo"))
        item["county"] = clean_text(api_item.get("activityCounty")) or item.get("county", "高雄市")
        website = clean_text(api_item.get("activityWebsite"))
        if website.startswith(("http://", "https://")):
            item["activityWebsite"] = website
            item["registrationUrl"] = website
        close_mark = clean_text(api_item.get("activityCloseMark"))
        item["status"] = derive_status(item.get("startDate", ""), item.get("endDate", ""), close_mark)


def validate_series(items: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for index, item in enumerate(items, start=1):
        item_id = clean_text(item.get("id"))
        if not item_id:
            errors.append(f"第 {index} 筆缺少 id")
        elif item_id in seen:
            errors.append(f"重複 id：{item_id}")
        seen.add(item_id)
        if not clean_text(item.get("title")):
            errors.append(f"第 {index} 筆缺少活動名稱")
        if not item.get("sourceVerified"):
            errors.append(f"{item.get('title', index)} 未通過活動來源驗證")
        if not item.get("countyVerified"):
            errors.append(f"{item.get('title', index)} 未通過高雄市篩選驗證")
    return errors


async def scrape_series() -> tuple[list[dict[str, Any]], list[str], int]:
    warnings: list[str] = []
    current_year = datetime.now(TAIPEI_TZ).year
    roc_years = sorted({current_year - 1911 + offset for offset in YEAR_OFFSETS})

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=HEADLESS,
            args=["--disable-dev-shm-usage", "--no-sandbox"],
        )
        try:
            summaries_by_url: dict[str, dict[str, Any]] = {}
            for roc_year in roc_years:
                page = await browser.new_page(locale="zh-TW")
                try:
                    await goto_with_retry(page, SERIES_LIST_URL)
                    year_warnings = await apply_filters(page, roc_year, include_source=True)
                    warnings.extend(
                        f"民國{roc_year}年系列活動：{warning}"
                        for warning in year_warnings
                        if warning != "SKIP_YEAR"
                    )
                    if "SKIP_YEAR" in year_warnings:
                        continue
                    required_filter_failed = any(
                        "找不到「高雄市」" in warning
                        or "找不到「運動i臺灣計畫」" in warning
                        for warning in year_warnings
                    )
                    if required_filter_failed:
                        warnings.append(
                            f"民國{roc_year}年系列活動：必要篩選條件未成功套用，已略過該年度，避免混入其他縣市或其他活動來源。"
                        )
                        continue
                    summaries = await collect_paginated(
                        page, parse_series_list, "TIS0201M_02V1.aspx"
                    )
                    for summary in summaries:
                        summary["rocYear"] = roc_year
                        summaries_by_url[summary["detailUrl"]] = summary
                    print(f"民國 {roc_year} 年：系列活動 {len(summaries)} 筆")
                finally:
                    await page.close()

            details = await fetch_details(
                browser,
                list(summaries_by_url.values())[:MAX_DETAILS],
                parse_series_detail,
                "系列活動",
                warnings,
            )
        finally:
            await browser.close()

    # The page filters are authoritative for source. The API is used only to
    # enrich official activity type, activityNo, website and stop mark.
    api_items: list[dict[str, Any]] = []
    for roc_year in roc_years:
        try:
            api_items.extend(await asyncio.to_thread(fetch_api_items, roc_year))
        except Exception as error:
            warnings.append(f"民國{roc_year}年系列活動 API 補充資料讀取失敗：{clean_text(error)}")
    enrich_with_api(details, api_items)

    details.sort(
        key=lambda item: (
            item.get("startDate") or "9999-12-31",
            item.get("district") or "",
            item.get("title") or "",
        )
    )
    return details, warnings, len(api_items)


async def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    previous_items = read_json(SERIES_PATH, [])
    status = read_json(STATUS_PATH, {})
    attempt_at = now_iso()

    try:
        items, warnings, api_count = await scrape_series()
        errors = validate_series(items)
        if errors:
            raise RuntimeError("；".join(errors[:20]))
        if not items:
            raise RuntimeError(
                "同步結果為 0 筆系列活動。為避免清空網站，已保留前一次成功資料。"
            )

        write_json_atomic(SERIES_PATH, items)
        source_urls = dict(status.get("sourceUrls") or {})
        source_urls["seriesActivities"] = SERIES_LIST_URL
        status.update(
            {
                "lastAttemptAt": attempt_at,
                "lastSuccessfulAt": now_iso(),
                "seriesLastAttemptAt": attempt_at,
                "seriesLastSuccessfulAt": now_iso(),
                "seriesStatus": "success",
                "seriesMessage": "系列活動同步完成",
                "seriesActivityCount": len(items),
                "seriesApiDetailCount": api_count,
                "seriesWarnings": warnings[-100:],
                "sourceUrls": source_urls,
                "syncMode": "GitHub Actions 定時同步（非即時）",
            }
        )
        # Keep the overall status useful while preserving course counters.
        if status.get("status") not in {"success", "partial"}:
            status["status"] = "partial"
        write_json_atomic(STATUS_PATH, status)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        traceback.print_exc()
        source_urls = dict(status.get("sourceUrls") or {})
        source_urls["seriesActivities"] = SERIES_LIST_URL
        status.update(
            {
                "seriesLastAttemptAt": attempt_at,
                "seriesStatus": "failed",
                "seriesMessage": clean_text(error),
                "seriesActivityCount": len(previous_items) if isinstance(previous_items, list) else 0,
                "seriesUsingPreviousData": bool(previous_items),
                "sourceUrls": source_urls,
                "syncMode": "GitHub Actions 定時同步（非即時）",
            }
        )
        write_json_atomic(STATUS_PATH, status)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        # The last known-good series JSON remains deployable.
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
