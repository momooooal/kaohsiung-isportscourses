export type CourseStatus = string;
export type CourseCategory = string;
export type District = string;

export const COURSE_CATEGORY_GROUPS = [
  '體適能',
  '瑜珈',
  '舞蹈',
  '有氧運動',
  '球類運動',
  '水域運動',
  '武術運動',
  '跑步健走',
  '自行車',
  '戶外運動',
  '其他',
] as const;

export type CourseCategoryGroup = (typeof COURSE_CATEGORY_GROUPS)[number];

export const KAOHSIUNG_DISTRICT_ORDER = [
  '楠梓區', '左營區', '鼓山區', '三民區', '鹽埕區', '前金區', '新興區',
  '苓雅區', '前鎮區', '旗津區', '小港區', '鳳山區', '林園區', '大寮區',
  '大樹區', '大社區', '仁武區', '鳥松區', '岡山區', '橋頭區', '燕巢區',
  '田寮區', '阿蓮區', '路竹區', '湖內區', '茄萣區', '永安區', '彌陀區',
  '梓官區', '旗山區', '美濃區', '六龜區', '甲仙區', '杉林區', '內門區',
  '茂林區', '桃源區', '那瑪夏區', '行政區待確認',
] as const;

/**
 * 將 i運動平台可能出現的複合或近義運動項目，整理成單一且不重複的篩選分類。
 * 原始 category 仍保留在課程資料中，不會改寫官方資料。
 */
export function normalizeCourseCategory(category: string): CourseCategoryGroup {
  const value = String(category ?? '').trim().replace(/\s+/g, '');

  if (/瑜珈|瑜伽|yoga/i.test(value)) return '瑜珈';
  if (/舞蹈|舞蹈運動|韻律|熱舞|街舞|土風舞|國標舞|排舞|Zumba/i.test(value)) return '舞蹈';
  if (/游泳|水域|水上|水中|獨木舟|龍舟|立式划槳|SUP|潛水/i.test(value)) return '水域運動';
  if (/羽球|籃球|桌球|網球|足球|排球|棒球|壘球|手球|躲避球|匹克球|槌球|木球|高爾夫|滾球|球類/i.test(value)) return '球類運動';
  if (/自行車|單車|腳踏車|騎乘/i.test(value)) return '自行車';
  if (/跑步|路跑|慢跑|健走|走路|競走/i.test(value)) return '跑步健走';
  if (/武術|國術|拳術|太極|跆拳|柔道|空手道|劍道|氣功|技擊|外丹功/i.test(value)) return '武術運動';
  if (/有氧|飛輪|跳繩|階梯/i.test(value)) return '有氧運動';
  if (/體適能|肌力|核心|重量訓練|健身|伸展|皮拉提斯|防跌|銀髮|樂齡|高齡|體操/i.test(value)) return '體適能';
  if (/登山|健行|戶外|探索|攀岩|定向越野/i.test(value)) return '戶外運動';

  return '其他';
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
