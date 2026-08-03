export type CourseStatus = '報名中' | '即將開始' | '已額滿';
export type CourseCategory = string;

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

/**
 * 將 i運動平台可能出現的複合或近義運動項目，整理成單一且不重複的篩選分類。
 * 原始 category 仍保留在課程資料中，不會改寫官方資料。
 */
export function normalizeCourseCategory(category: string): CourseCategoryGroup {
  const value = category.trim().replace(/\s+/g, '');

  if (/瑜珈|瑜伽|yoga/i.test(value)) return '瑜珈';
  if (/舞蹈|舞蹈運動|韻律|熱舞|街舞|土風舞|國標舞|排舞|Zumba/i.test(value)) return '舞蹈';
  if (/游泳|水域|水上|水中|獨木舟|龍舟|立式划槳|SUP/i.test(value)) return '水域運動';
  if (/羽球|籃球|桌球|網球|足球|排球|棒球|壘球|手球|躲避球|匹克球|槌球|木球|高爾夫|球類/i.test(value)) return '球類運動';
  if (/自行車|單車|腳踏車|騎乘/i.test(value)) return '自行車';
  if (/跑步|路跑|慢跑|健走|走路|競走/i.test(value)) return '跑步健走';
  if (/武術|國術|拳術|太極|跆拳|柔道|空手道|劍道|氣功/i.test(value)) return '武術運動';
  if (/有氧|飛輪|跳繩|階梯/i.test(value)) return '有氧運動';
  if (/體適能|肌力|核心|重量訓練|健身|伸展|皮拉提斯|防跌|銀髮|樂齡|高齡/i.test(value)) return '體適能';
  if (/登山|健行|戶外|探索|攀岩|定向越野/i.test(value)) return '戶外運動';

  return '其他';
}
export type District = '鳳山區' | '左營區' | '鼓山區' | '三民區' | '苓雅區' | '前鎮區' | '楠梓區';

export interface Course {
  id: string;
  title: string;
  category: CourseCategory;
  location: string;
  district: District;
  address: string;
  time: string;
  startDate: string;
  endDate: string;
  status: CourseStatus;
  spotsTotal: number;
  spotsAvailable: number;
  fee: number | '免費';
  instructor: string;
  description: string;
  registrationUrl: string;
  organizer: string;
  targetAudience: string;
}

export const MOCK_COURSES: Course[] = [
  {
    id: 'c-001',
    title: '樂活燃脂飛輪班',
    category: '有氧',
    location: '左營國民運動中心',
    district: '左營區',
    address: '高雄市左營區博愛二路123號',
    time: '每週二 19:00-20:00',
    startDate: '2023-11-01',
    endDate: '2023-12-20',
    status: '報名中',
    spotsTotal: 20,
    spotsAvailable: 5,
    fee: 800,
    instructor: '陳飛輪教練',
    description: '專為初學者設計的室內腳踏車飛輪課程，搭配音樂節奏進行高強度的間歇訓練，能有效燃燒脂肪並增強心肺功能。',
    registrationUrl: '#',
    organizer: '高雄市左營區體育會',
    targetAudience: '18-50歲一般民眾',
  },
  {
    id: 'c-002',
    title: '社區高齡者防跌肌力',
    category: '高齡友善',
    location: '鳳山體育館',
    district: '鳳山區',
    address: '高雄市鳳山區體育路65號',
    time: '每週一、四 09:00-10:00',
    startDate: '2023-11-05',
    endDate: '2024-01-15',
    status: '報名中',
    spotsTotal: 30,
    spotsAvailable: 12,
    fee: '免費',
    instructor: '王健康治療師',
    description: '針對65歲以上長者設計的溫和肌力訓練，加強下肢力量與平衡感，有效預防跌倒，提升生活品質。',
    registrationUrl: '#',
    organizer: '高雄市政府運動發展局',
    targetAudience: '65歲以上長者',
  },
  {
    id: 'c-003',
    title: '晨間舒緩哈達瑜珈',
    category: '瑜珈',
    location: '苓雅區文化中心廣場',
    district: '苓雅區',
    address: '高雄市苓雅區五福一路67號',
    time: '每週六 07:00-08:30',
    startDate: '2023-11-10',
    endDate: '2024-01-20',
    status: '即將開始',
    spotsTotal: 40,
    spotsAvailable: 40,
    fee: 500,
    instructor: '林靜心老師',
    description: '在晨光中進行的哈達瑜珈，強調呼吸與動作的配合，幫助伸展筋骨，釋放壓力，為週末帶來平靜與活力。',
    registrationUrl: '#',
    organizer: '苓雅區樂活推廣協會',
    targetAudience: '不限年齡，適合所有瑜珈初學者',
  },
  {
    id: 'c-004',
    title: '基礎自由式游泳班',
    category: '水上運動',
    location: '三民區游泳池',
    district: '三民區',
    address: '高雄市三民區大連街120號',
    time: '每週三、五 18:30-20:00',
    startDate: '2023-10-15',
    endDate: '2023-12-15',
    status: '已額滿',
    spotsTotal: 15,
    spotsAvailable: 0,
    fee: 1200,
    instructor: '張水波教練',
    description: '從零開始學習自由式，包含水感培養、打水技巧、換氣訓練及划手動作，循序漸進建立正確的游泳姿勢。',
    registrationUrl: '#',
    organizer: '高雄市水中運動協會',
    targetAudience: '旱鴨子或想改善自由式姿勢者',
  },
  {
    id: 'c-005',
    title: '親子樂活羽球體驗',
    category: '球類',
    location: '前鎮區草衙籃球館',
    district: '前鎮區',
    address: '高雄市前鎮區中安路1-1號',
    time: '每週日 14:00-16:00',
    startDate: '2023-11-12',
    endDate: '2023-12-24',
    status: '報名中',
    spotsTotal: 16,
    spotsAvailable: 8,
    fee: 1500,
    instructor: '李殺球教練',
    description: '以家庭為單位的羽球課程，學習基本握拍、發球與擊球技巧，透過趣味遊戲增進親子關係並培養運動習慣。',
    registrationUrl: '#',
    organizer: '前鎮區羽球推廣中心',
    targetAudience: '家長與國小學童（一對一組合）',
  },
  {
    id: 'c-006',
    title: '核心抗阻力訓練',
    category: '肌力訓練',
    location: '楠梓國民運動中心',
    district: '楠梓區',
    address: '高雄市楠梓區綜合路88號',
    time: '每週一 20:00-21:00',
    startDate: '2023-11-20',
    endDate: '2024-01-22',
    status: '即將開始',
    spotsTotal: 25,
    spotsAvailable: 20,
    fee: 1000,
    instructor: '黃壯壯教練',
    description: '利用自身體重與彈力帶進行全身性的核心與肌力訓練，雕塑體態並提升基礎代謝率，適合久坐族群。',
    registrationUrl: '#',
    organizer: '楠梓區健康促進會',
    targetAudience: '18-45歲上班族',
  },
  {
    id: 'c-007',
    title: '壽山生態健走與無痕山林',
    category: '戶外探索',
    location: '鼓山區壽山國家自然公園',
    district: '鼓山區',
    address: '高雄市鼓山區萬壽路301號',
    time: '每週六 08:00-11:00',
    startDate: '2023-11-04',
    endDate: '2023-12-09',
    status: '報名中',
    spotsTotal: 40,
    spotsAvailable: 15,
    fee: '免費',
    instructor: '劉嚮導',
    description: '結合自然生態導覽與健行，推廣無痕山林理念。享受森林浴的同時，認識壽山豐富的動植物生態。',
    registrationUrl: '#',
    organizer: '高雄市戶外探險協會',
    targetAudience: '熱愛大自然的民眾，需具備基本體力',
  },
  {
    id: 'c-008',
    title: '社區太極拳入門',
    category: '高齡友善',
    location: '三民區科工館南館廣場',
    district: '三民區',
    address: '高雄市三民區九如一路720號',
    time: '每週二、五 06:30-07:30',
    startDate: '2023-10-01',
    endDate: '2023-12-31',
    status: '已額滿',
    spotsTotal: 50,
    spotsAvailable: 0,
    fee: '免費',
    instructor: '趙太極師傅',
    description: '學習楊氏太極拳基礎套路，動作柔和緩慢，有助於舒緩關節僵硬，增進氣血循環，修身養性。',
    registrationUrl: '#',
    organizer: '三民區太極拳委員會',
    targetAudience: '中高齡者及壓力大需放鬆者',
  }
];
