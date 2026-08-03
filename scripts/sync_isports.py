#!/usr/bin/env python3
"""Synchronize Kaohsiung regular courses from the official iSports platform.

The platform is an ASP.NET Web Forms site, so this script uses Playwright to
operate the same filters and pagination that a normal visitor uses. It then
parses the public detail pages, cross-checks each regular course against the
"運動課程" area filtered to "運動i臺灣計畫", and writes static JSON for the
GitHub Pages frontend.

Failure policy: never replace a previously successful courses.json with an
empty or clearly invalid result.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse, parse_qs

from bs4 import BeautifulSoup
from playwright.async_api import Browser, Page, TimeoutError as PlaywrightTimeoutError, async_playwright

BASE_URL = "https://isports.sa.gov.tw"
REGULAR_LIST_URL = (
    BASE_URL
    + "/Apps/TIS/PFM05/PFM0560M_01V1.aspx?MENU_PRG_CD=1&ITEM_PRG_CD=6"
)
ACTIVITY_LIST_URL = (
    BASE_URL
    + "/Apps/TIS/TIS02/TIS0201M_01v1.aspx?ACT_TP_CD=3&ITEM_PRG_CD=3&MENU_PRG_CD=1"
)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "artifacts" / "kaohsiung-sport-courses" / "public" / "data"
COURSES_PATH = DATA_DIR / "courses.json"
STATUS_PATH = DATA_DIR / "sync-status.json"
UNMATCHED_PATH = DATA_DIR / "unmatched-courses.json"
RAW_DIR = DATA_DIR / "raw"

TAIPEI_TZ = timezone(timedelta(hours=8))
MAX_PAGES = int(os.getenv("ISPORTS_MAX_PAGES", "200"))
MAX_DETAILS = int(os.getenv("ISPORTS_MAX_DETAILS", "2500"))
HEADLESS = os.getenv("ISPORTS_HEADLESS", "1") != "0"
YEAR_OFFSETS = [
    int(value.strip())
    for value in os.getenv("ISPORTS_YEAR_OFFSETS", "0,1").split(",")
    if value.strip()
]

KAOHSIUNG_DISTRICTS = [
    "楠梓區", "左營區", "鼓山區", "三民區", "鹽埕區", "前金區", "新興區",
    "苓雅區", "前鎮區", "旗津區", "小港區", "鳳山區", "林園區", "大寮區",
    "大樹區", "大社區", "仁武區", "鳥松區", "岡山區", "橋頭區", "燕巢區",
    "田寮區", "阿蓮區", "路竹區", "湖內區", "茄萣區", "永安區", "彌陀區",
    "梓官區", "旗山區", "美濃區", "六龜區", "甲仙區", "杉林區", "內門區",
    "茂林區", "桃源區", "那瑪夏區",
]

FIELD_LABELS_REGULAR = [
    "課程辦理單位", "課程內容", "講師陣容", "學員類別", "參與對象", "活動項目",
    "報名日期", "招生人數", "課程聯絡人", "課程聯絡電話", "課程辦理情形",
]
FIELD_LABELS_ACTIVITY = [
    "活動名稱", "活動來源", "活動主辦單位", "主辦單位", "活動內容", "活動日期",
    "活動時間", "活動聯絡人", "聯絡人", "活動聯絡電話", "聯絡電話", "活動項目",
    "活動參與對象", "參與對象", "活動地點", "活動地址",
]


@dataclass
class ScrapeResult:
    courses: list[dict[str, Any]]
    unmatched: list[dict[str, Any]]
    regular_count: int
    activity_count: int
    warnings: list[str]


def now_iso() -> str:
    return datetime.now(TAIPEI_TZ).isoformat(timespec="seconds")


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return default


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temp.replace(path)


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_text(value: Any) -> str:
    text = clean_text(value).lower()
    text = re.sub(r"社團法人|財團法人|高雄市|中華民國|臺灣|台灣", "", text)
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]", "", text)


def digits(value: Any) -> str:
    return re.sub(r"\D", "", str(value or ""))


def extract_pkno(url: str) -> str:
    try:
        return parse_qs(urlparse(url).query).get("PKNO", [""])[0]
    except Exception:
        return ""


def roc_date_to_iso(value: str) -> str:
    raw = digits(value)
    if len(raw) < 7:
        return ""
    try:
        year = int(raw[:-4]) + 1911
        month = int(raw[-4:-2])
        day = int(raw[-2:])
        return datetime(year, month, day).date().isoformat()
    except ValueError:
        return ""


def roc_range_to_iso(value: str) -> tuple[str, str]:
    parts = re.split(r"[~～\-－—至]+", clean_text(value))
    parsed = [roc_date_to_iso(part) for part in parts if digits(part)]
    parsed = [value for value in parsed if value]
    if not parsed:
        return "", ""
    return parsed[0], parsed[-1]


def date_ranges_overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    if not all([a_start, a_end, b_start, b_end]):
        return False
    return max(a_start, b_start) <= min(a_end, b_end)


def district_from_addresses(addresses: Iterable[str]) -> str:
    combined = " ".join(clean_text(address) for address in addresses)
    for district in KAOHSIUNG_DISTRICTS:
        if district in combined:
            return district
    match = re.search(r"高雄市\s*([^\s,，路街巷弄號]{1,6}區)", combined)
    return match.group(1) if match else "行政區待確認"


def is_kaohsiung(addresses: Iterable[str]) -> bool:
    return any("高雄市" in clean_text(address) for address in addresses)


def get_table_rows(soup: BeautifulSoup) -> list[tuple[list[str], list[list[str]], Any]]:
    result: list[tuple[list[str], list[list[str]], Any]] = []
    for table in soup.find_all("table"):
        rows: list[list[str]] = []
        for tr in table.find_all("tr"):
            cells = [clean_text(cell.get_text(" ", strip=True)) for cell in tr.find_all(["th", "td"])]
            if cells:
                rows.append(cells)
        if not rows:
            continue
        headers = rows[0]
        result.append((headers, rows[1:], table))
    return result


def extract_fields(soup: BeautifulSoup, labels: list[str]) -> dict[str, str]:
    fields: dict[str, str] = {}

    for _, rows, table in get_table_rows(soup):
        for tr in table.find_all("tr"):
            cells = tr.find_all(["th", "td"])
            if len(cells) != 2:
                continue
            key = clean_text(cells[0].get_text(" ", strip=True)).rstrip("：:")
            value = clean_text(" ".join(cell.get_text(" ", strip=True) for cell in cells[1:]))
            for label in labels:
                if key == label or key.startswith(label):
                    fields.setdefault(label, value)

    lines = [clean_text(line) for line in soup.get_text("\n", strip=True).splitlines()]
    lines = [line for line in lines if line]
    for index, line in enumerate(lines):
        for label in labels:
            pattern = rf"^{re.escape(label)}\s*[：:]\s*(.*)$"
            match = re.match(pattern, line)
            if match:
                value = clean_text(match.group(1))
                if not value and index + 1 < len(lines):
                    value = lines[index + 1]
                fields.setdefault(label, value)
            elif line.rstrip("：:") == label and index + 1 < len(lines):
                next_line = lines[index + 1]
                next_key = next_line.rstrip("：:")
                if next_key not in labels and next_key not in {
                    "活動時間", "地點", "活動主題", "Map",
                    "課程日期", "課程時間", "課程地點", "課程地址",
                }:
                    fields.setdefault(label, next_line)
    return fields


def extract_title(soup: BeautifulSoup, section_title: str) -> str:
    ignored = {
        "i運動資訊平台", "運動資訊平台", "活動專區", section_title,
        "回上一頁", "系列活動", "運動課程", "體育賽事", "常態性課程(查看及報名)",
    }
    lines = [clean_text(line) for line in soup.get_text("\n", strip=True).splitlines()]
    lines = [line for line in lines if line]
    if "回上一頁" in lines:
        start = lines.index("回上一頁") + 1
        for line in lines[start:start + 8]:
            if line not in ignored and not line.startswith("※") and len(line) <= 120:
                return line
    for heading in soup.find_all(["h1", "h2", "h3", "h4"]):
        text = clean_text(heading.get_text(" ", strip=True))
        if text and text not in ignored and not text.startswith("※"):
            return text
    return ""


def parse_regular_list(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    entries: list[dict[str, Any]] = []
    for headers, rows, table in get_table_rows(soup):
        joined = "|".join(headers)
        if "課程主題" not in joined or "課程期間" not in joined:
            continue
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all(["th", "td"])
            if not cells:
                continue
            link = tr.find("a", href=re.compile(r"PFM0560M_02V1\.aspx", re.I))
            if not link:
                continue
            values = [clean_text(cell.get_text(" ", strip=True)) for cell in cells]
            href = urljoin(REGULAR_LIST_URL, link.get("href", ""))
            entries.append({
                "title": clean_text(link.get_text(" ", strip=True)),
                "studentCategory": values[1] if len(values) > 1 else "",
                "registrationPeriodRaw": values[2] if len(values) > 2 else "",
                "coursePeriodRaw": values[3] if len(values) > 3 else "",
                "detailUrl": href,
                "coursePkno": extract_pkno(href),
            })
    return entries


def parse_activity_list(html: str) -> list[dict[str, Any]]:
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
            href = urljoin(ACTIVITY_LIST_URL, link.get("href", ""))
            source_code = parse_qs(urlparse(href).query).get("ACT_SOURCE_TP_CD", [""])[0]
            if source_code and source_code != "02":
                continue
            entries.append({
                "title": clean_text(link.get_text(" ", strip=True)),
                "activityPeriodRaw": values[1] if len(values) > 1 else "",
                "detailUrl": href,
                "activityPkno": extract_pkno(href),
            })
    return entries


def parse_sessions(soup: BeautifulSoup) -> list[dict[str, str]]:
    sessions: list[dict[str, str]] = []
    for headers, _, table in get_table_rows(soup):
        normalized = [header.replace(" ", "") for header in headers]
        if "課程日期" not in normalized or "課程地址" not in normalized:
            continue
        for tr in table.find_all("tr")[1:]:
            cells = [clean_text(cell.get_text(" ", strip=True)) for cell in tr.find_all(["th", "td"])]
            if len(cells) < 5:
                continue
            sessions.append({
                "topic": cells[0],
                "dates": cells[1],
                "time": cells[2],
                "location": cells[3],
                "address": cells[4],
            })
    return sessions



def parse_activity_sessions(soup: BeautifulSoup) -> list[dict[str, str]]:
    sessions: list[dict[str, str]] = []
    for headers, _, table in get_table_rows(soup):
        normalized = [header.replace(" ", "") for header in headers]
        if "活動日期" not in normalized or "活動時間" not in normalized or "活動主題" not in normalized:
            continue
        for tr in table.find_all("tr")[1:]:
            cells = [clean_text(cell.get_text(" ", strip=True)) for cell in tr.find_all(["th", "td"])]
            if len(cells) < 4:
                continue
            sessions.append({
                "dates": cells[0],
                "time": cells[1],
                "address": cells[2],
                "topic": cells[3],
            })
    return sessions


def find_registration_url(soup: BeautifulSoup, detail_url: str) -> str:
    for link in soup.find_all("a", href=True):
        text = clean_text(link.get_text(" ", strip=True))
        if text not in {"我要報名", "線上報名", "前往報名", "立即報名"}:
            continue
        href = clean_text(link.get("href"))
        if href and not href.lower().startswith("javascript:"):
            return urljoin(detail_url, href)
    return detail_url


def parse_regular_detail(html: str, summary: dict[str, Any]) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    fields = extract_fields(soup, FIELD_LABELS_REGULAR)
    sessions = parse_sessions(soup)
    addresses = [session["address"] for session in sessions if session.get("address")]
    locations = [session["location"] for session in sessions if session.get("location")]
    times = list(dict.fromkeys(session["time"] for session in sessions if session.get("time")))

    registration_start, registration_end = roc_range_to_iso(
        fields.get("報名日期") or summary.get("registrationPeriodRaw", "")
    )
    start_date, end_date = roc_range_to_iso(summary.get("coursePeriodRaw", ""))
    spots_raw = digits(fields.get("招生人數", ""))
    spots_total = int(spots_raw) if spots_raw else None
    title = extract_title(soup, "常態性課程") or summary.get("title", "未命名課程")
    detail_url = summary["detailUrl"]

    return {
        "id": f"course-{summary.get('coursePkno') or normalize_text(title)[:24]}",
        "coursePkno": summary.get("coursePkno", ""),
        "title": title,
        "category": fields.get("活動項目") or "其他",
        "location": locations[0] if locations else "地點詳見官方頁面",
        "district": district_from_addresses(addresses),
        "address": addresses[0] if addresses else "",
        "time": "、".join(times) if times else "時間詳見官方頁面",
        "startDate": start_date,
        "endDate": end_date,
        "registrationStartDate": registration_start,
        "registrationEndDate": registration_end,
        "status": fields.get("課程辦理情形") or "狀態未提供",
        "spotsTotal": spots_total,
        "spotsAvailable": None,
        "fee": "未提供",
        "instructor": fields.get("講師陣容") or "未提供",
        "description": fields.get("課程內容") or "課程內容請參閱官方頁面。",
        "registrationUrl": find_registration_url(soup, detail_url),
        "detailUrl": detail_url,
        "organizer": fields.get("課程辦理單位") or "未提供",
        "targetAudience": fields.get("參與對象") or summary.get("studentCategory", "未提供"),
        "studentCategory": fields.get("學員類別") or summary.get("studentCategory", "未提供"),
        "contactName": fields.get("課程聯絡人") or "",
        "contactPhone": fields.get("課程聯絡電話") or "",
        "sessions": sessions,
        "source": "運動i臺灣計畫",
        "sourceVerified": False,
        "activityName": "",
        "activityPkno": "",
        "activityDetailUrl": "",
        "matchConfidence": "unmatched",
        "rawRegistrationPeriod": summary.get("registrationPeriodRaw", ""),
        "rawCoursePeriod": summary.get("coursePeriodRaw", ""),
    }


def parse_activity_detail(html: str, summary: dict[str, Any]) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    fields = extract_fields(soup, FIELD_LABELS_ACTIVITY)
    sessions = parse_activity_sessions(soup)
    title = fields.get("活動名稱") or extract_title(soup, "運動課程") or summary.get("title", "")
    start_date, end_date = roc_range_to_iso(
        fields.get("活動日期") or fields.get("活動時間") or summary.get("activityPeriodRaw", "")
    )
    organizer = fields.get("活動主辦單位") or fields.get("主辦單位") or ""
    contact = fields.get("活動聯絡人") or fields.get("聯絡人") or ""
    phone = fields.get("活動聯絡電話") or fields.get("聯絡電話") or ""
    if not phone:
        phone_match = re.search(r"(?:09\d{2}[- ]?\d{3}[- ]?\d{3}|0\d{1,2}[- ]?\d{3,4}[- ]?\d{4})", contact)
        phone = phone_match.group(0) if phone_match else ""
    return {
        **summary,
        "title": title,
        "source": fields.get("活動來源") or "運動i臺灣計畫",
        "organizer": organizer,
        "description": fields.get("活動內容") or "",
        "startDate": start_date,
        "endDate": end_date,
        "contactName": contact,
        "contactPhone": phone,
        "category": fields.get("活動項目") or "",
        "targetAudience": fields.get("活動參與對象") or fields.get("參與對象") or "",
        "location": fields.get("活動地點") or "",
        "address": fields.get("活動地址") or "",
        "sessions": sessions,
    }


def score_match(course: dict[str, Any], activity: dict[str, Any]) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    course_addresses = {
        normalize_text(address)
        for address in [course.get("address", "")] + [
            session.get("address", "") for session in course.get("sessions", [])
        ]
        if normalize_text(address)
    }
    activity_addresses = {
        normalize_text(address)
        for address in [activity.get("address", "")] + [
            session.get("address", "") for session in activity.get("sessions", [])
        ]
        if normalize_text(address)
    }
    if course_addresses & activity_addresses:
        score += 12
        reasons.append("官方場次地址完全相同")

    course_topics = {
        normalize_text(session.get("topic", ""))
        for session in course.get("sessions", [])
        if normalize_text(session.get("topic", ""))
    }
    activity_topics = {
        normalize_text(session.get("topic", ""))
        for session in activity.get("sessions", [])
        if normalize_text(session.get("topic", ""))
    }
    if course_topics & activity_topics:
        score += 5
        reasons.append("官方場次主題完全相同")
    course_org = normalize_text(course.get("organizer"))
    activity_org = normalize_text(activity.get("organizer"))
    if course_org and activity_org:
        if course_org == activity_org:
            score += 8
            reasons.append("辦理單位完全相同")
        elif course_org in activity_org or activity_org in course_org:
            score += 6
            reasons.append("辦理單位高度相符")
        else:
            ratio = SequenceMatcher(None, course_org, activity_org).ratio()
            if ratio >= 0.72:
                score += 4
                reasons.append("辦理單位文字相近")

    course_phone = digits(course.get("contactPhone"))
    activity_phone = digits(activity.get("contactPhone"))
    if course_phone and activity_phone and (
        course_phone == activity_phone
        or course_phone[-8:] == activity_phone[-8:]
    ):
        score += 3
        reasons.append("聯絡電話相同")

    if date_ranges_overlap(
        course.get("startDate", ""), course.get("endDate", ""),
        activity.get("startDate", ""), activity.get("endDate", ""),
    ):
        score += 2
        reasons.append("辦理日期重疊")

    course_title = normalize_text(course.get("title"))
    activity_title = normalize_text(activity.get("title"))
    description = normalize_text(activity.get("description"))
    location = normalize_text(course.get("location"))
    if course_title and course_title in description:
        score += 5
        reasons.append("活動內容包含課程名稱")
    if location and len(location) >= 4 and location in description:
        score += 3
        reasons.append("活動內容包含課程地點")
    if course_title and activity_title:
        ratio = SequenceMatcher(None, course_title, activity_title).ratio()
        if ratio >= 0.58:
            score += 4
            reasons.append("活動與課程名稱高度相近")
        elif ratio >= 0.35:
            score += 2
            reasons.append("活動與課程名稱部分相近")

    return score, reasons


def attach_activity(course: dict[str, Any], activities: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    ranked: list[tuple[int, list[str], dict[str, Any]]] = []
    for activity in activities:
        score, reasons = score_match(course, activity)
        if score:
            ranked.append((score, reasons, activity))
    ranked.sort(key=lambda item: item[0], reverse=True)

    diagnostic = {
        "coursePkno": course.get("coursePkno"),
        "title": course.get("title"),
        "organizer": course.get("organizer"),
        "detailUrl": course.get("detailUrl"),
        "district": course.get("district"),
        "bestCandidate": None,
        "reason": "找不到足以確認為運動i臺灣計畫的運動課程資料",
    }
    if not ranked:
        return None, diagnostic

    score, reasons, best = ranked[0]
    diagnostic["bestCandidate"] = {
        "score": score,
        "reasons": reasons,
        "activityPkno": best.get("activityPkno"),
        "title": best.get("title"),
        "organizer": best.get("organizer"),
        "detailUrl": best.get("detailUrl"),
    }
    if score < 7:
        diagnostic["reason"] = f"最佳配對分數僅 {score}，未達 7 分門檻"
        return None, diagnostic

    matched = dict(course)
    matched.update({
        "sourceVerified": True,
        "activityName": best.get("title", ""),
        "activityPkno": best.get("activityPkno", ""),
        "activityDetailUrl": best.get("detailUrl", ""),
        "matchConfidence": "high" if score >= 11 else "medium",
        "matchScore": score,
        "matchReasons": reasons,
    })
    return matched, diagnostic


async def goto_with_retry(page: Page, url: str, attempts: int = 3) -> None:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=120_000)
            await page.wait_for_timeout(700)
            return
        except Exception as error:
            last_error = error
            if attempt < attempts:
                await page.wait_for_timeout(1500 * attempt)
    raise RuntimeError(f"無法開啟 {url}: {last_error}")


async def select_option_containing(page: Page, text: str) -> bool:
    selects = page.locator("select")
    for index in range(await selects.count()):
        select = selects.nth(index)
        if not await select.is_visible():
            continue
        options = await select.locator("option").all()
        for option in options:
            label = clean_text(await option.text_content())
            if text == label or text in label:
                value = await option.get_attribute("value")
                try:
                    if value is not None:
                        await select.select_option(value=value)
                    else:
                        await select.select_option(label=label)
                    await page.wait_for_timeout(700)
                    return True
                except Exception:
                    continue
    return False


async def click_query(page: Page) -> bool:
    candidates = page.locator("input[type=submit], input[type=button], button")
    scored: list[tuple[float, Any]] = []
    for index in range(await candidates.count()):
        candidate = candidates.nth(index)
        if not await candidate.is_visible():
            continue
        label = clean_text(
            (await candidate.get_attribute("value")) or (await candidate.text_content()) or ""
        )
        if label not in {"查詢", "搜尋", "重新查詢"} and "查詢" not in label:
            continue
        box = await candidate.bounding_box()
        scored.append(((box or {}).get("y", 999999), candidate))
    if not scored:
        return False
    scored.sort(key=lambda item: item[0])
    await scored[0][1].click()
    await page.wait_for_timeout(1200)
    return True


async def apply_filters(page: Page, roc_year: int, include_source: bool) -> list[str]:
    warnings: list[str] = []
    if not await select_option_containing(page, "高雄市"):
        warnings.append("找不到「高雄市」篩選選項，將於詳細頁再次依地址過濾")
    if not await select_option_containing(page, str(roc_year)):
        warnings.append(f"來源網站沒有民國 {roc_year} 年選項")
        return warnings + ["SKIP_YEAR"]
    if include_source and not await select_option_containing(page, "運動i臺灣計畫"):
        warnings.append("找不到「運動i臺灣計畫」來源篩選選項")
    if not await click_query(page):
        warnings.append("找不到查詢按鈕，使用頁面目前顯示結果")
    return warnings


async def collect_paginated(
    page: Page,
    parser,
    detail_pattern: str,
) -> list[dict[str, Any]]:
    collected: dict[str, dict[str, Any]] = {}
    previous_signature = ""
    for page_number in range(1, MAX_PAGES + 1):
        html = await page.content()
        entries = parser(html)
        for entry in entries:
            if entry.get("detailUrl"):
                collected[entry["detailUrl"]] = entry
        signature = "|".join(sorted(entry.get("detailUrl", "") for entry in entries))
        if signature and signature == previous_signature:
            break
        previous_signature = signature

        next_links = page.get_by_text("下一頁", exact=True)
        clicked = False
        for index in range(await next_links.count()):
            link = next_links.nth(index)
            if not await link.is_visible():
                continue
            tag = await link.evaluate("el => el.tagName.toLowerCase()")
            class_name = (await link.get_attribute("class")) or ""
            aria_disabled = await link.get_attribute("aria-disabled")
            if tag != "a" or "disabled" in class_name.lower() or aria_disabled == "true":
                continue
            try:
                await link.click(timeout=20_000)
                await page.wait_for_timeout(1200)
                clicked = True
                break
            except PlaywrightTimeoutError:
                continue
        if not clicked:
            break
    return list(collected.values())[:MAX_DETAILS]


async def fetch_details(
    browser: Browser,
    summaries: list[dict[str, Any]],
    parser,
    label: str,
    warnings: list[str],
) -> list[dict[str, Any]]:
    page = await browser.new_page(locale="zh-TW")
    results: list[dict[str, Any]] = []
    try:
        for index, summary in enumerate(summaries, start=1):
            url = summary["detailUrl"]
            try:
                await goto_with_retry(page, url)
                parsed = parser(await page.content(), summary)
                results.append(parsed)
                print(f"[{label}] {index}/{len(summaries)} {parsed.get('title', url)}")
            except Exception as error:
                warnings.append(f"{label}詳細頁解析失敗：{url}｜{error}")
    finally:
        await page.close()
    return results


async def scrape_year(browser: Browser, roc_year: int, warnings: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    regular_page = await browser.new_page(locale="zh-TW")
    activity_page = await browser.new_page(locale="zh-TW")
    try:
        await goto_with_retry(regular_page, REGULAR_LIST_URL)
        year_warnings = await apply_filters(regular_page, roc_year, include_source=False)
        warnings.extend([f"民國{roc_year}年常態課程：{warning}" for warning in year_warnings if warning != "SKIP_YEAR"])
        if "SKIP_YEAR" in year_warnings:
            regular_summaries: list[dict[str, Any]] = []
        else:
            regular_summaries = await collect_paginated(
                regular_page, parse_regular_list, "PFM0560M_02V1.aspx"
            )

        await goto_with_retry(activity_page, ACTIVITY_LIST_URL)
        activity_warnings = await apply_filters(activity_page, roc_year, include_source=True)
        warnings.extend([f"民國{roc_year}年運動課程：{warning}" for warning in activity_warnings if warning != "SKIP_YEAR"])
        if "SKIP_YEAR" in activity_warnings:
            activity_summaries: list[dict[str, Any]] = []
        else:
            activity_summaries = await collect_paginated(
                activity_page, parse_activity_list, "TIS0201M_02V1.aspx"
            )
    finally:
        await regular_page.close()
        await activity_page.close()

    print(f"民國 {roc_year} 年：常態課程 {len(regular_summaries)} 筆；運動課程 {len(activity_summaries)} 筆")
    return regular_summaries, activity_summaries


async def run_scrape() -> ScrapeResult:
    warnings: list[str] = []
    current_year = datetime.now(TAIPEI_TZ).year
    roc_years = sorted({current_year - 1911 + offset for offset in YEAR_OFFSETS})

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=HEADLESS,
            args=["--disable-dev-shm-usage", "--no-sandbox"],
        )
        try:
            regular_by_url: dict[str, dict[str, Any]] = {}
            activity_by_url: dict[str, dict[str, Any]] = {}
            for roc_year in roc_years:
                regular_summaries, activity_summaries = await scrape_year(browser, roc_year, warnings)
                regular_by_url.update({item["detailUrl"]: item for item in regular_summaries})
                activity_by_url.update({item["detailUrl"]: item for item in activity_summaries})

            regular_details = await fetch_details(
                browser, list(regular_by_url.values()), parse_regular_detail, "常態課程", warnings
            )
            activity_details = await fetch_details(
                browser, list(activity_by_url.values()), parse_activity_detail, "運動課程", warnings
            )
        finally:
            await browser.close()

    kaohsiung_courses = [
        course for course in regular_details
        if is_kaohsiung(
            [course.get("address", "")]
            + [session.get("address", "") for session in course.get("sessions", [])]
        )
    ]

    verified_courses: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []
    for course in kaohsiung_courses:
        matched, diagnostic = attach_activity(course, activity_details)
        if matched:
            verified_courses.append(matched)
        else:
            unmatched.append(diagnostic)

    verified_courses.sort(
        key=lambda item: (
            item.get("startDate") or "9999-12-31",
            item.get("district") or "",
            item.get("title") or "",
        )
    )
    return ScrapeResult(
        courses=verified_courses,
        unmatched=unmatched,
        regular_count=len(regular_details),
        activity_count=len(activity_details),
        warnings=warnings,
    )


def validate_courses(courses: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    ids: set[str] = set()
    for index, course in enumerate(courses):
        if not course.get("id"):
            errors.append(f"第 {index + 1} 筆缺少 id")
        elif course["id"] in ids:
            errors.append(f"重複 id：{course['id']}")
        ids.add(course.get("id", ""))
        if not course.get("title"):
            errors.append(f"第 {index + 1} 筆缺少課程名稱")
        if not course.get("sourceVerified"):
            errors.append(f"{course.get('title', index)} 未通過活動來源驗證")
        addresses = [course.get("address", "")] + [
            session.get("address", "") for session in course.get("sessions", [])
        ]
        if not is_kaohsiung(addresses):
            errors.append(f"{course.get('title', index)} 並非高雄市地址")
    return errors


async def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    previous_courses = read_json(COURSES_PATH, [])
    previous_status = read_json(STATUS_PATH, {})
    attempt_at = now_iso()

    try:
        result = await run_scrape()
        validation_errors = validate_courses(result.courses)
        if validation_errors:
            raise RuntimeError("；".join(validation_errors[:20]))
        if not result.courses:
            raise RuntimeError(
                "同步結果為 0 筆已驗證課程。為避免清空網站，已保留前一次成功資料。"
            )

        write_json_atomic(COURSES_PATH, result.courses)
        write_json_atomic(UNMATCHED_PATH, result.unmatched)
        status = {
            "lastAttemptAt": attempt_at,
            "lastSuccessfulAt": now_iso(),
            "status": "success",
            "message": "同步完成",
            "courseCount": len(result.courses),
            "unmatchedCount": len(result.unmatched),
            "regularDetailCount": result.regular_count,
            "activityDetailCount": result.activity_count,
            "warnings": result.warnings[-100:],
            "sourceUrls": {
                "regularCourses": REGULAR_LIST_URL,
                "sportActivities": ACTIVITY_LIST_URL,
            },
            "syncMode": "GitHub Actions 定時同步（非即時）",
        }
        write_json_atomic(STATUS_PATH, status)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        traceback.print_exc()
        status = {
            "lastAttemptAt": attempt_at,
            "lastSuccessfulAt": previous_status.get("lastSuccessfulAt"),
            "status": "failed",
            "message": clean_text(error),
            "courseCount": len(previous_courses) if isinstance(previous_courses, list) else 0,
            "unmatchedCount": previous_status.get("unmatchedCount", 0),
            "warnings": previous_status.get("warnings", []),
            "sourceUrls": {
                "regularCourses": REGULAR_LIST_URL,
                "sportActivities": ACTIVITY_LIST_URL,
            },
            "syncMode": "GitHub Actions 定時同步（非即時）",
            "usingPreviousData": bool(previous_courses),
        }
        write_json_atomic(STATUS_PATH, status)
        print(json.dumps(status, ensure_ascii=False, indent=2), file=sys.stderr)
        # Return success so GitHub Pages can still redeploy the last known-good data.
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
