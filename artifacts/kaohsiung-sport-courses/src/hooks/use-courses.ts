import { useState, useMemo, useEffect } from 'react';
import {
  Course,
  MOCK_COURSES,
  COURSE_CATEGORY_GROUPS,
  CourseCategoryGroup,
  District,
  CourseStatus,
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

export function useCourses() {
  const [courses] = useState<Course[]>(MOCK_COURSES);
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
      } catch (e) {
        console.error('Failed to parse favorites');
      }
    }
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

  const filteredAndSortedCourses = useMemo(() => {
    let result = courses;

    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(
        c => c.title.toLowerCase().includes(query) || c.location.toLowerCase().includes(query)
      );
    }

    if (filters.categories.length > 0) {
      result = result.filter(c => filters.categories.includes(normalizeCourseCategory(c.category)));
    }

    if (filters.districts.length > 0) {
      result = result.filter(c => filters.districts.includes(c.district));
    }

    if (filters.status.length > 0) {
      result = result.filter(c => filters.status.includes(c.status));
    }

    if (filters.showFavoritesOnly) {
      result = result.filter(c => favorites.has(c.id));
    }

    result.sort((a, b) => {
      if (sortBy === 'date-asc') {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      } else if (sortBy === 'date-desc') {
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      } else if (sortBy === 'availability-desc') {
        return b.spotsAvailable - a.spotsAvailable;
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
    totalCount: filteredAndSortedCourses.length,
    filters,
    updateFilter,
    clearFilters,
    sortBy,
    setSortBy,
    favorites,
    toggleFavorite,
    availableCategories,
  };
}
