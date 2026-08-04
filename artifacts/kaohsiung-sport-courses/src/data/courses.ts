export type CourseStatus = string;
export type CourseCategory = string;
export type CourseCategoryOption = string;
export type District = string;
export type ContentType = 'regular-course' | 'series-activity';
export type ContentView = 'all' | ContentType;

export const KAOHSIUNG_DISTRICT_ORDER = [
  '楠梓區', '左營區', '鼓山區', '三民區', '鹽埕區', '前金區', '新興區',
  '苓雅區', '前鎮區', '旗津區', '小港區', '鳳山區', '林園區', '大寮區',
  '大樹區', '大社區', '仁武區', '鳥松區', '岡山區', '橋頭區', '燕巢區',
  '田寮區', '阿蓮區', '路竹區', '湖內區', '茄萣區', '永安區', '彌陀區',
  '梓官區', '旗山區', '美濃區', '六龜區', '甲仙區', '杉林區', '內門區',
  '茂林區', '桃源區', '那瑪夏區', '多區辦理', '行政區待確認',
] as const;

const CATEGORY_ALIASES: Record<string, string> = {
  瑜伽: '瑜珈',
  體適能: '體適能運動',
};

/**
 * 將官方複合運動項目拆成可獨立篩選的細項。
 * 只清除「其它／其他」包裝、拆分複合項目及合併明確同義詞，
 * 不把槌球、羽球、游泳、攀樹等細項粗略併成少數大類。
 */
export function getCourseCategoryOptions(category: string): CourseCategoryOption[] {
  const normalized = String(category ?? '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/(?:其它|其他)\s*\(/g, '(');

  const options = normalized
    .split(/[、,，/／;；+＋.．()（）]|\s+(?:及|與)\s+/)
    .map(item => item.replace(/^(?:其它|其他)\s*/, '').trim())
    .map(item => CATEGORY_ALIASES[item] ?? item)
    .filter(Boolean);

  return Array.from(new Set(options));
}

/** 顯示用：保留所有細項，但移除「其它(...)」等不自然格式。 */
export function formatCourseCategories(category: string): string {
  const options = getCourseCategoryOptions(category);
  return options.length > 0 ? options.join('、') : '未分類';
}

export interface CourseSession {
  topic?: string;
  dates?: string;
  time?: string;
  location?: string;
  address?: string;
}

/**
 * 常態課程與系列活動共用的前端資料模型。
 * 系列活動不適用的名額、講師等欄位會是 null、空字串或「不適用」。
 */
export interface Course {
  id: string;
  itemType: ContentType;
  coursePkno?: string;
  activityPkno?: string;
  activityNo?: string;
  title: string;
  category: CourseCategory;
  categorySource?: 'official-page' | 'official-api' | 'system-inferred' | string;
  location: string;
  district: District;
  districts?: District[];
  address: string;
  time: string;
  startDate: string;
  endDate: string;
  registrationStartDate?: string;
  registrationEndDate?: string;
  status: CourseStatus;
  spotsTotal: number | null;
  spotsAvailable: number | null;
  fee: number | string | null;
  instructor: string;
  description: string;
  registrationUrl: string;
  detailUrl?: string;
  activityWebsite?: string;
  organizer: string;
  targetAudience: string;
  studentCategory?: string;
  contactName?: string;
  contactPhone?: string;
  sessions?: CourseSession[];
  topics?: string[];
  source?: string;
  sourceVerified?: boolean;
  county?: string;
  countyVerified?: boolean;
  activityName?: string;
  activityDetailUrl?: string;
  matchConfidence?: string;
  matchScore?: number;
}

export interface SyncStatus {
  lastAttemptAt?: string;
  lastSuccessfulAt?: string;
  status?: 'success' | 'failed' | 'partial' | string;
  message?: string;
  courseCount?: number;
  unmatchedCount?: number;
  seriesActivityCount?: number;
  seriesStatus?: 'success' | 'failed' | string;
  seriesMessage?: string;
  seriesLastAttemptAt?: string;
  seriesLastSuccessfulAt?: string;
  warnings?: string[];
  seriesWarnings?: string[];
  syncMode?: string;
}

export interface ParticipationAdvisory {
  kind: 'call-first' | 'capacity-limited';
  title: string;
  message: string;
}

const REGISTRATION_CLOSED_PATTERN = /報名.*截止|招生.*截止|報名.*額滿|已額滿|額滿/;
const COURSE_UNAVAILABLE_PATTERN = /暫停|取消|停辦|課程已結束|活動已結束/;
const CAPACITY_SENSITIVE_PATTERN = /競賽|比賽|賽事|參賽|分組|分隊|獎品|獎項|排名|名次|名額|限額|限員|額滿|抽籤|錄取|正式名單|保險名冊|保證金|贈品|紀念品/;

const toDateKey = (value?: string): number | null => {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? Number(`${match[1]}${match[2]}${match[3]}`) : null;
};

/** 取得 Asia/Taipei 當日日期，避免 GitHub／瀏覽器時區不同造成提示提早或延後消失。 */
const getTaipeiTodayKey = (now: Date): number => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(`${values.year}${values.month}${values.day}`);
};

/**
 * 報名截止不一定代表完全不能參與。
 * 只針對尚未結束的常態課程顯示電話詢問提示；暫停、取消、停辦或已結束課程不提示。
 * 除了官方狀態，也會依報名截止日判斷，避免官方狀態文字略有不同時漏掉提示。
 * 若課程文字涉及名額、分組、競賽、獎品等限制，改用較嚴格的提醒文字。
 */
export function getCourseParticipationAdvisory(
  course: Course,
  now: Date = new Date(),
): ParticipationAdvisory | null {
  if (course.itemType !== 'regular-course') return null;
  if (COURSE_UNAVAILABLE_PATTERN.test(course.status)) return null;

  const todayKey = getTaipeiTodayKey(now);
  const endDateKey = toDateKey(course.endDate);
  if (endDateKey !== null && endDateKey < todayKey) return null;

  const registrationEndDateKey = toDateKey(course.registrationEndDate);
  const registrationHasClosed =
    REGISTRATION_CLOSED_PATTERN.test(course.status) ||
    (registrationEndDateKey !== null && registrationEndDateKey < todayKey);
  if (!registrationHasClosed) return null;

  const searchableText = [
    course.title,
    course.status,
    course.category,
    course.description,
    course.targetAudience,
    ...(course.topics ?? []),
    ...(course.sessions ?? []).flatMap(session => [session.topic, session.location]),
  ].join(' ');

  if (CAPACITY_SENSITIVE_PATTERN.test(searchableText)) {
    return {
      kind: 'capacity-limited',
      title: '涉及名額或活動規則，請先電話確認',
      message:
        '此課程可能涉及名額、分組、競賽、獎品、保證金或正式名單等限制。未完成報名者不一定能直接參加，請先致電主辦單位詢問是否可候補、旁聽或加入，並以主辦單位回覆為準。',
    };
  }

  return {
    kind: 'call-first',
    title: '報名截止仍可電話詢問是否能參加',
    message:
      '部分運動i臺灣常態課程在報名截止後，仍可能視現場及課程情形接受參與。請先致電主辦單位確認是否能加入，不建議未確認就直接前往。',
  };
}

