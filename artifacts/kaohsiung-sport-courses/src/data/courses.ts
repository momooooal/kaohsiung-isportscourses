export type CourseStatus = string;
export type CourseCategory = string;
export type CourseCategoryOption = string;
export type District = string;

export const KAOHSIUNG_DISTRICT_ORDER = [
  '楠梓區', '左營區', '鼓山區', '三民區', '鹽埕區', '前金區', '新興區',
  '苓雅區', '前鎮區', '旗津區', '小港區', '鳳山區', '林園區', '大寮區',
  '大樹區', '大社區', '仁武區', '鳥松區', '岡山區', '橋頭區', '燕巢區',
  '田寮區', '阿蓮區', '路竹區', '湖內區', '茄萣區', '永安區', '彌陀區',
  '梓官區', '旗山區', '美濃區', '六龜區', '甲仙區', '杉林區', '內門區',
  '茂林區', '桃源區', '那瑪夏區', '行政區待確認',
] as const;

const CATEGORY_ALIASES: Record<string, string> = {
  瑜伽: '瑜珈',
  體適能: '體適能運動',
};

/**
 * 將官方的複合運動項目拆成可獨立篩選的細項。
 *
 * 例：
 * - 其它(體適能運動) → 體適能運動
 * - 瑜珈、體適能運動 → 瑜珈＋體適能運動
 * - 其它(龍舟.輕艇.立槳) → 龍舟＋輕艇＋立槳
 *
 * 僅清除「其它／其他」包裝、拆分複合項目及合併明確同義詞，
 * 不會把槌球、羽球、游泳、攀樹等細項粗略併成少數大類。
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

export interface Course {
  id: string;
  coursePkno?: string;
  title: string;
  category: CourseCategory;
  location: string;
  district: District;
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
  organizer: string;
  targetAudience: string;
  studentCategory?: string;
  contactName?: string;
  contactPhone?: string;
  sessions?: CourseSession[];
  source?: string;
  sourceVerified?: boolean;
  activityName?: string;
  activityPkno?: string;
  activityDetailUrl?: string;
  matchConfidence?: string;
  matchScore?: number;
}

export interface SyncStatus {
  lastAttemptAt?: string;
  lastSuccessfulAt?: string;
  status?: 'success' | 'failed' | string;
  message?: string;
  courseCount?: number;
  unmatchedCount?: number;
  warnings?: string[];
  syncMode?: string;
}
