import { useEffect, useMemo, useState } from 'react';
import {
  ContentView,
  Course,
  CourseCategoryOption,
  District,
  CourseStatus,
  KAOHSIUNG_DISTRICT_ORDER,
  SyncStatus,
  getCourseCategoryOptions,
} from '../data/courses';

export interface FilterState {
  search: string;
  categories: CourseCategoryOption[];
  districts: District[];
  status: CourseStatus[];
  showFavoritesOnly: boolean;
}

type SortOption = 'active-first' | 'date-asc' | 'date-desc' | 'availability-desc';

const safeText = (value: unknown) => String(value ?? '').toLowerCase();

const normalizeItem = (item: Partial<Course>, fallbackType: Course['itemType']): Course => ({
  id: String(item.id ?? ''),
  itemType: item.itemType ?? fallbackType,
  title: String(item.title ?? '未命名'),
  category: String(item.category ?? '未分類'),
  location: String(item.location ?? '地點詳見官方頁面'),
  district: String(item.district ?? '行政區待確認'),
  districts: Array.isArray(item.districts) ? item.districts : undefined,
  address: String(item.address ?? ''),
  time: String(item.time ?? '時間詳見官方頁面'),
  startDate: String(item.startDate ?? ''),
  endDate: String(item.endDate ?? ''),
  status: String(item.status ?? '狀態未提供'),
  spotsTotal: typeof item.spotsTotal === 'number' ? item.spotsTotal : null,
  spotsAvailable: typeof item.spotsAvailable === 'number' ? item.spotsAvailable : null,
  fee: item.fee ?? '未提供',
  instructor: String(item.instructor ?? ''),
  description: String(item.description ?? '內容請參閱官方頁面。'),
  registrationUrl: String(item.registrationUrl ?? item.detailUrl ?? ''),
  organizer: String(item.organizer ?? '未提供'),
  targetAudience: String(item.targetAudience ?? '未提供'),
  ...item,
  itemType: item.itemType ?? fallbackType,
} as Course);

export function useCourses() {
  const [allItems, setAllItems] = useState<Course[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contentView, setContentView] = useState<ContentView>('all');
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    categories: [],
    districts: [],
    status: [],
    showFavoritesOnly: false,
  });
  const [sortBy, setSortBy] = useState<SortOption>('active-first');
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
    const cacheBuster = `v=${Date.now()}`;

    async function loadData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [coursesResponse, seriesResponse, statusResponse] = await Promise.all([
          fetch(`${base}courses.json?${cacheBuster}`, {
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch(`${base}series-activities.json?${cacheBuster}`, {
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch(`${base}sync-status.json?${cacheBuster}`, {
            cache: 'no-store',
            signal: controller.signal,
          }),
        ]);

        if (!coursesResponse.ok) {
          throw new Error(`常態課程資料讀取失敗（HTTP ${coursesResponse.status}）`);
        }

        const loadedCourses: unknown = await coursesResponse.json();
        if (!Array.isArray(loadedCourses)) {
          throw new Error('常態課程資料格式不正確');
        }

        let loadedSeries: unknown = [];
        if (seriesResponse.ok) {
          loadedSeries = await seriesResponse.json();
          if (!Array.isArray(loadedSeries)) {
            throw new Error('系列活動資料格式不正確');
          }
        }

        const regularItems = loadedCourses.map(item =>
          normalizeItem(item as Partial<Course>, 'regular-course')
        );
        const seriesItems = (loadedSeries as Partial<Course>[]).map(item =>
          normalizeItem(item, 'series-activity')
        );
        setAllItems([...regularItems, ...seriesItems]);

        if (statusResponse.ok) {
          setSyncStatus((await statusResponse.json()) as SyncStatus);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error(error);
        setAllItems([]);
        setLoadError(error instanceof Error ? error.message : '資料讀取失敗');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
    return () => controller.abort();
  }, []);

  const toggleFavorite = (itemId: string) => {
    setFavorites(previous => {
      const next = new Set(previous);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      localStorage.setItem('ks-sport-favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const contextItems = useMemo(() => {
    if (contentView === 'all') return allItems;
    return allItems.filter(item => item.itemType === contentView);
  }, [allItems, contentView]);

  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    contextItems.forEach(item => {
      getCourseCategoryOptions(item.category).forEach(category => {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      });
    });

    return Array.from(counts.keys()).sort((a, b) => {
      const countDifference = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
      return countDifference !== 0 ? countDifference : a.localeCompare(b, 'zh-Hant');
    });
  }, [contextItems]);

  const availableDistricts = useMemo(() => {
    const districts = new Set<string>();
    contextItems.forEach(item => {
      const itemDistricts = item.districts?.length ? item.districts : [item.district];
      itemDistricts.filter(Boolean).forEach(district => districts.add(district));
    });
    const ordered = KAOHSIUNG_DISTRICT_ORDER.filter(district => districts.has(district));
    const remaining = Array.from(districts)
      .filter(district => !ordered.includes(district as (typeof KAOHSIUNG_DISTRICT_ORDER)[number]))
      .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    return [...ordered, ...remaining] as District[];
  }, [contextItems]);

  const availableStatuses = useMemo(() => {
    return Array.from(new Set<string>(contextItems.map(item => item.status).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, 'zh-Hant')
    );
  }, [contextItems]);

  const filteredAndSortedCourses = useMemo(() => {
    let result = [...contextItems];

    if (filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      result = result.filter(item =>
        [
          item.title,
          item.location,
          item.address,
          item.district,
          ...(item.districts ?? []),
          item.organizer,
          item.category,
          item.targetAudience,
          item.activityName,
          item.description,
          ...(item.topics ?? []),
        ].some(value => safeText(value).includes(query))
      );
    }

    if (filters.categories.length > 0) {
      result = result.filter(item => {
        const itemCategories = getCourseCategoryOptions(item.category);
        return filters.categories.some(category => itemCategories.includes(category));
      });
    }

    if (filters.districts.length > 0) {
      result = result.filter(item => {
        const itemDistricts = item.districts?.length ? item.districts : [item.district];
        return filters.districts.some(district => itemDistricts.includes(district));
      });
    }

    if (filters.status.length > 0) {
      result = result.filter(item => filters.status.includes(item.status));
    }

    if (filters.showFavoritesOnly) {
      result = result.filter(item => favorites.has(item.id));
    }

    result.sort((a, b) => {
      if (sortBy === 'active-first') {
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
        const getRank = (item: Course) => {
          if (/暫停|取消|停辦/.test(item.status)) return 3;
          if (item.endDate && item.endDate < today) return 2;
          if (item.startDate && item.startDate > today) return 1;
          return 0;
        };
        const rankDifference = getRank(a) - getRank(b);
        if (rankDifference !== 0) return rankDifference;
        return new Date(a.endDate || '9999-12-31').getTime() - new Date(b.endDate || '9999-12-31').getTime();
      }
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
  }, [contextItems, filters, sortBy, favorites]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(previous => ({ ...previous, [key]: value }));
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

  const regularCourseCount = allItems.filter(item => item.itemType === 'regular-course').length;
  const seriesActivityCount = allItems.filter(item => item.itemType === 'series-activity').length;

  return {
    courses: filteredAndSortedCourses,
    sourceCourseCount: regularCourseCount,
    regularCourseCount,
    seriesActivityCount,
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
    contentView,
    setContentView,
    syncStatus,
    isLoading,
    loadError,
  };
}
