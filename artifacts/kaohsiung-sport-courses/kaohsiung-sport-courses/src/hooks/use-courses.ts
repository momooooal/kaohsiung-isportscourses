import { useEffect, useMemo, useState } from 'react';
import {
  Course,
  COURSE_CATEGORY_GROUPS,
  CourseCategoryGroup,
  District,
  CourseStatus,
  KAOHSIUNG_DISTRICT_ORDER,
  SyncStatus,
  normalizeCourseCategory,
} from '../data/courses';

export interface FilterState {
  search: string;
  categories: CourseCategoryGroup[];
  districts: District[];
  status: CourseStatus[];
  showFavoritesOnly: boolean;
}

type SortOption = 'date-asc' | 'date-desc' | 'availability-desc';

const safeText = (value: unknown) => String(value ?? '').toLowerCase();

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
        console.error('Failed to parse favorites');
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const base = `${import.meta.env.BASE_URL}data/`;

    async function loadData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [coursesResponse, statusResponse] = await Promise.all([
          fetch(`${base}courses.json`, { cache: 'no-store', signal: controller.signal }),
          fetch(`${base}sync-status.json`, { cache: 'no-store', signal: controller.signal }),
        ]);

        if (!coursesResponse.ok) {
          throw new Error(`課程資料讀取失敗（HTTP ${coursesResponse.status}）`);
        }

        const loadedCourses: unknown = await coursesResponse.json();
        if (!Array.isArray(loadedCourses)) {
          throw new Error('課程資料格式不正確');
        }

        setCourses(loadedCourses as Course[]);

        if (statusResponse.ok) {
          setSyncStatus((await statusResponse.json()) as SyncStatus);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error(error);
        setLoadError(error instanceof Error ? error.message : '課程資料讀取失敗');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
    return () => controller.abort();
  }, []);

  const toggleFavorite = (courseId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      localStorage.setItem('ks-sport-favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const availableCategories = useMemo(() => {
    const categories = new Set(courses.map(course => normalizeCourseCategory(course.category)));
    return COURSE_CATEGORY_GROUPS.filter(category => categories.has(category));
  }, [courses]);

  const availableDistricts = useMemo(() => {
    const districts = new Set<string>(courses.map(course => course.district).filter(Boolean));
    const ordered = KAOHSIUNG_DISTRICT_ORDER.filter(district => districts.has(district));
    const remaining = Array.from(districts)
      .filter(district => !ordered.includes(district as (typeof KAOHSIUNG_DISTRICT_ORDER)[number]))
      .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    return [...ordered, ...remaining] as District[];
  }, [courses]);

  const availableStatuses = useMemo(() => {
    return Array.from(new Set<string>(courses.map(course => course.status).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'zh-Hant')
    );
  }, [courses]);

  const filteredAndSortedCourses = useMemo(() => {
    let result = [...courses];

    if (filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      result = result.filter(course =>
        [
          course.title,
          course.location,
          course.address,
          course.district,
          course.organizer,
          course.category,
          course.targetAudience,
        ].some(value => safeText(value).includes(query))
      );
    }

    if (filters.categories.length > 0) {
      result = result.filter(course =>
        filters.categories.includes(normalizeCourseCategory(course.category))
      );
    }

    if (filters.districts.length > 0) {
      result = result.filter(course => filters.districts.includes(course.district));
    }

    if (filters.status.length > 0) {
      result = result.filter(course => filters.status.includes(course.status));
    }

    if (filters.showFavoritesOnly) {
      result = result.filter(course => favorites.has(course.id));
    }

    result.sort((a, b) => {
      if (sortBy === 'date-asc') {
        return new Date(a.startDate || '9999-12-31').getTime() - new Date(b.startDate || '9999-12-31').getTime();
      }
      if (sortBy === 'date-desc') {
        return new Date(b.startDate || '0000-01-01').getTime() - new Date(a.startDate || '0000-01-01').getTime();
      }
      if (sortBy === 'availability-desc') {
        return (b.spotsAvailable ?? -1) - (a.spotsAvailable ?? -1);
      }
      return 0;
    });

    return result;
  }, [courses, filters, sortBy, favorites]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
    sourceCourseCount: courses.length,
    totalCount: filteredAndSortedCourses.length,
    filters,
    updateFilter,
    clearFilters,
    sortBy,
    setSortBy,
    favorites,
    toggleFavorite,
    availableCategories,
    availableDistricts,
    availableStatuses,
    syncStatus,
    isLoading,
    loadError,
  };
}
