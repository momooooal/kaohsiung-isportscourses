export type CourseStatus = string;
export type CourseCategory = string;
export type District = string;

export interface CourseSession {
  topic: string;
  dates: string;
  time: string;
  location: string;
  address: string;
}

export interface Course {
  id: string;
  coursePkno: string;
  title: string;
  category: CourseCategory;
  location: string;
  district: District;
  address: string;
  time: string;
  startDate: string;
  endDate: string;
  registrationStartDate: string;
  registrationEndDate: string;
  status: CourseStatus;
  spotsTotal: number | null;
  spotsAvailable: number | null;
  fee: string | number;
  instructor: string;
  description: string;
  registrationUrl: string;
  detailUrl: string;
  organizer: string;
  targetAudience: string;
  studentCategory: string;
  contactName: string;
  contactPhone: string;
  sessions: CourseSession[];
  source: string;
  sourceVerified: boolean;
  activityName: string;
  activityPkno: string;
  activityDetailUrl: string;
  matchConfidence: 'high' | 'medium' | 'unmatched' | string;
  matchScore?: number;
  matchReasons?: string[];
  rawRegistrationPeriod?: string;
  rawCoursePeriod?: string;
}

export interface SyncStatus {
  lastAttemptAt: string | null;
  lastSuccessfulAt: string | null;
  status: 'waiting' | 'success' | 'failed' | string;
  message: string;
  courseCount: number;
  unmatchedCount: number;
  regularDetailCount?: number;
  activityDetailCount?: number;
  warnings?: string[];
  syncMode?: string;
  usingPreviousData?: boolean;
}
