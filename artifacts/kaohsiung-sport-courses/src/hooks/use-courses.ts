import { useEffect, useMemo, useState } from 'react';
import type {
  Course,
  CourseCategory,
  CourseStatus,
  District,
  SyncStatus,
} from '../data/courses';

export interface FilterState {
  search: string;
  categories: CourseCategory[];
  districts: District[];
  status: CourseStatus[];
  showFavoritesOnly: boolean;
}

export type SortOption =
  | 'date-asc'
  | 'date-desc'
  | 'registration-end-asc'
  | 'title-asc';

const EMPTY_STATUS: SyncStatus = {
  lastAttemptAt: null,
  lastSuccessfulAt: null,
  status: 'waiting',
  message: '等待 GitHub Actions 完成第一次同步',
  courseCount: 0,
  unmatchedCount: 0,
};

function dataUrl(fileName: string) {
  return `${import.meta.env.BASE_URL}data/${fileName}`;
}

function asTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

export function useCourses() {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(EMPTY_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    categories: [],
    districts: [],
    status: [],
    showFavoritesOnly: false,
  });
  const [sortBy, setSortBy] = useState<SortOption>('date-asc');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('ks-sport-favorites');
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)));
      } catch {
        localStorage.removeItem('ks-sport-favorites');
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setLoadError('');
      try {
        const [coursesResponse, statusResponse] = await Promise.all([
          fetch(dataUrl('courses.json'), { cache: 'no-store' }),
          fetch(dataUrl('sync-status.json'), { cache: 'no-store' }),
        ]);
        if (!coursesResponse.ok) {
          throw new Error(`課程資料讀取失敗（${coursesResponse.status}）`);
        }
        const courses = (await coursesResponse.json()) as Course[];
        const status = statusResponse.ok
          ? ((await statusResponse.json()) as SyncStatus)
          : EMPTY_STATUS;
        if (!cancelled) {
          setAllCourses(Array.isArray(courses) ? courses : []);
          setSyncStatus(status);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '課程資料讀取失敗');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(
    () => ({
      categories: Array.from(new Set(allCourses.map((course) => course.category).filter(Boolean))).sort(),
      districts: Array.from(new Set(allCourses.map((course) => course.district).filter(Boolean))).sort(),
      statuses: Array.from(new Set(allCourses.map((course) => course.status).filter(Boolean))).sort(),
    }),
    [allCourses],
  );

  const toggleFavorite = (courseId: string) => {
    setFavorites((previous) => {
      const next = new Set(previous);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      localStorage.setItem('ks-sport-favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const filteredAndSortedCourses = useMemo(() => {
    let result = [...allCourses];

    if (filters.search.trim()) {
      const query = filters.search.trim().toLocaleLowerCase('zh-TW');
      result = result.filter((course) =>
        [
          course.title,
          course.activityName,
          course.location,
          course.address,
          course.district,
          course.organizer,
          course.category,
          course.targetAudience,
          course.studentCategory,
        ]
          .filter(Boolean)
          .some((value) => value.toLocaleLowerCase('zh-TW').includes(query)),
      );
    }

    if (filters.categories.length > 0) {
      result = result.filter((course) => filters.categories.includes(course.category));
    }
    if (filters.districts.length > 0) {
      result = result.filter((course) => filters.districts.includes(course.district));
    }
    if (filters.status.length > 0) {
      result = result.filter((course) => filters.status.includes(course.status));
    }
    if (filters.showFavoritesOnly) {
      result = result.filter((course) => favorites.has(course.id));
    }

    result.sort((a, b) => {
      if (sortBy === 'date-asc') {
        return asTimestamp(a.startDate) - asTimestamp(b.startDate);
      }
      if (sortBy === 'date-desc') {
        return asTimestamp(b.startDate) - asTimestamp(a.startDate);
      }
      if (sortBy === 'registration-end-asc') {
        return asTimestamp(a.registrationEndDate) - asTimestamp(b.registrationEndDate);
      }
      return a.title.localeCompare(b.title, 'zh-TW');
    });

    return result;
  }, [allCourses, filters, sortBy, favorites]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      categories: [],
      districts: [],
      status: [],
      showFavoritesOnly: false,
    });
  };

  return {
    courses: filteredAndSortedCourses,
    allCourses,
    totalCount: filteredAndSortedCourses.length,
    filters,
    filterOptions,
    updateFilter,
    clearFilters,
    sortBy,
    setSortBy,
    favorites,
    toggleFavorite,
    syncStatus,
    isLoading,
    loadError,
  };
}
