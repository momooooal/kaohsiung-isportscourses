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
