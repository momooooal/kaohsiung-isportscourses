import { useState } from 'react';
import { useCourses } from '@/hooks/use-courses';
import type { Course, CourseCategory, CourseStatus, District } from '@/data/courses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Clock,
  Filter,
  LoaderCircle,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

function formatDate(value?: string) {
  if (!value) return '未提供';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return '尚未成功同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function statusVariant(status: string): 'success' | 'warning' | 'secondary' | 'destructive' | 'default' {
  if (/報名中|開放|招生中/.test(status)) return 'success';
  if (/即將|尚未/.test(status)) return 'warning';
  if (/額滿|截止|結束/.test(status)) return 'secondary';
  if (/取消|停辦/.test(status)) return 'destructive';
  return 'default';
}

function FilterGroup<T extends string>({
  title,
  values,
  selected,
  onToggle,
  prefix,
}: {
  title: string;
  values: T[];
  selected: T[];
  onToggle: (value: T) => void;
  prefix: string;
}) {
  if (values.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium uppercase tracking-wider text-slate-500">{title}</h4>
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
        {values.map((value) => {
          const id = `${prefix}-${value}`;
          return (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={id}
                checked={selected.includes(value)}
                onCheckedChange={() => onToggle(value)}
              />
              <Label htmlFor={id} className="cursor-pointer font-normal">
                {value}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const {
    courses,
    totalCount,
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
  } = useCourses();

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const toggleCategory = (category: CourseCategory) => {
    updateFilter(
      'categories',
      filters.categories.includes(category)
        ? filters.categories.filter((item) => item !== category)
        : [...filters.categories, category],
    );
  };

  const toggleDistrict = (district: District) => {
    updateFilter(
      'districts',
      filters.districts.includes(district)
        ? filters.districts.filter((item) => item !== district)
        : [...filters.districts, district],
    );
  };

  const toggleStatus = (status: CourseStatus) => {
    updateFilter(
      'status',
      filters.status.includes(status)
        ? filters.status.filter((item) => item !== status)
        : [...filters.status, status],
    );
  };

  const syncFailed = syncStatus.status === 'failed';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-6 w-6" />
            <h1 className="text-xl font-bold tracking-tight">
              高雄運動 i 臺灣<span className="hidden sm:inline">課程查詢</span>
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateFilter('showFavoritesOnly', !filters.showFavoritesOnly)}
            className={filters.showFavoritesOnly ? 'bg-secondary/10 text-secondary' : 'text-slate-600'}
          >
            {filters.showFavoritesOnly ? (
              <BookmarkCheck className="mr-2 h-4 w-4" />
            ) : (
              <Bookmark className="mr-2 h-4 w-4" />
            )}
            <span className="hidden sm:inline">我的收藏 ({favorites.size})</span>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-primary px-4 py-12 text-white sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent opacity-10" />
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center justify-center gap-2 sm:justify-start">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-medium">僅顯示已核對為高雄市「運動i臺灣計畫」的常態性課程</span>
            </div>
            <h2 className="mb-3 text-3xl font-black text-white sm:text-4xl">找到專屬於你的運動時光</h2>
            <p className="mb-4 text-lg text-primary-foreground/90">
              自動整合官方「運動課程」與「常態性課程」，不必再到兩個頁面交叉查找。
            </p>
            <div
              className={`mx-auto flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm sm:mx-0 ${
                syncFailed ? 'bg-red-950/30 text-red-50' : 'bg-black/10 text-primary-foreground/80'
              }`}
            >
              <AlertCircle className="h-4 w-4" />
              <span>
                {syncFailed ? '同步異常，顯示最近一次成功資料：' : '資料最後成功同步：'}
                {formatDateTime(syncStatus.lastSuccessfulAt)}
              </span>
            </div>
          </div>
          <div className="w-full max-w-md flex-1 sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="搜尋課程、行政區、地點或主辦單位..."
                className="h-12 rounded-full border-0 pl-10 text-base text-slate-900 shadow-lg focus-visible:ring-secondary"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 md:flex-row lg:px-8">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:hidden">
          <span className="font-medium text-slate-700">找到 {totalCount} 堂課程</span>
          <Button variant="outline" size="sm" onClick={() => setIsMobileFilterOpen((value) => !value)}>
            <Filter className="mr-2 h-4 w-4" />篩選
          </Button>
        </div>

        <aside className={`shrink-0 flex-col gap-6 md:flex md:w-64 ${isMobileFilterOpen ? 'flex' : 'hidden'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">進階篩選</h3>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500" onClick={clearFilters}>
              清除全部
            </Button>
          </div>
          <FilterGroup
            title="課程辦理情形"
            values={filterOptions.statuses}
            selected={filters.status}
            onToggle={toggleStatus}
            prefix="status"
          />
          <FilterGroup
            title="運動項目"
            values={filterOptions.categories}
            selected={filters.categories}
            onToggle={toggleCategory}
            prefix="category"
          />
          <FilterGroup
            title="行政區"
            values={filterOptions.districts}
            selected={filters.districts}
            onToggle={toggleDistrict}
            prefix="district"
          />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 hidden items-center justify-between md:flex">
            <h2 className="text-xl font-bold text-slate-800">
              {filters.showFavoritesOnly ? '我的收藏' : '課程列表'}
              <span className="ml-2 text-base font-normal text-slate-500">共 {totalCount} 筆結果</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">排序方式</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="h-9 w-[185px] bg-white">
                  <SelectValue placeholder="選擇排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-asc">最近開課</SelectItem>
                  <SelectItem value="date-desc">較晚開課</SelectItem>
                  <SelectItem value="registration-end-asc">最近截止報名</SelectItem>
                  <SelectItem value="title-asc">課程名稱</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
              <LoaderCircle className="mb-3 h-8 w-8 animate-spin text-primary" />
              <p className="text-slate-600">正在讀取最新課程資料…</p>
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
              <AlertCircle className="mx-auto mb-3 h-8 w-8" />
              <h3 className="mb-2 font-bold">無法讀取課程資料</h3>
              <p>{loadError}</p>
            </div>
          ) : totalCount === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <div className="mb-4 rounded-full bg-slate-100 p-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-800">目前沒有符合條件的課程</h3>
              <p className="mb-6 max-w-lg text-slate-500">
                {syncStatus.status === 'waiting'
                  ? '網站正在等待第一次 GitHub Actions 同步。上傳到 GitHub 後，工作流程會自動執行。'
                  : syncStatus.message || '請放寬篩選條件，或稍後再查看官方新增的課程。'}
              </p>
              <Button onClick={clearFilters} variant="outline">清除所有篩選</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {courses.map((course) => {
                const isFavorite = favorites.has(course.id);
                return (
                  <Card
                    key={course.id}
                    className="group flex h-full cursor-pointer flex-col overflow-hidden border-slate-200 bg-white transition-all hover:border-primary/30 hover:shadow-md"
                    onClick={() => setSelectedCourse(course)}
                  >
                    <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <Badge variant={statusVariant(course.status)} className="font-normal shadow-none">
                            {course.status}
                          </Badge>
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 font-normal text-slate-600 shadow-none">
                            {course.category}
                          </Badge>
                          <Badge variant="success" className="font-normal shadow-none">
                            來源已核對
                          </Badge>
                        </div>
                        <CardTitle className="text-lg leading-tight transition-colors group-hover:text-primary">
                          {course.title}
                        </CardTitle>
                        <CardDescription className="mt-1.5 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{course.district} · {course.location}</span>
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={isFavorite ? '取消收藏' : '加入收藏'}
                        className={`z-10 h-8 w-8 shrink-0 rounded-full ${
                          isFavorite
                            ? 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-secondary'
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite(course.id);
                        }}
                      >
                        {isFavorite ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      </Button>
                    </CardHeader>
                    <CardContent className="flex-1 pb-4 text-sm text-slate-600">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{formatDate(course.startDate)} ～ {formatDate(course.endDate)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{course.time}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{course.targetAudience}</span>
                        </div>
                      </div>
                    </CardContent>
                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 text-sm">
                      <span className="truncate pr-3 text-slate-600">{course.organizer}</span>
                      <span className="shrink-0 font-medium text-primary">查看詳情</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="mt-auto bg-slate-900 py-8 text-sm text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2 text-slate-300">
            <Activity className="h-5 w-5" />
            <span className="font-semibold">高雄運動 i 臺灣課程查詢</span>
          </div>
          <div className="max-w-2xl text-center md:text-right">
            <p>資料來源：運動部全民運動署 i運動資訊平台。</p>
            <p className="mt-1">本網站提供整合查詢；實際課程、名額、辦理情形及報名資訊，以官方平台及主辦單位公告為準。</p>
          </div>
        </div>
      </footer>

      <Sheet open={Boolean(selectedCourse)} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <SheetContent side="right" className="flex w-full flex-col border-l-0 bg-slate-50 p-0 sm:max-w-xl">
          {selectedCourse && (
            <>
              <div className="relative bg-primary px-6 py-8 text-white">
                <SheetHeader className="relative z-10 text-left">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="border-none bg-white/20 text-white hover:bg-white/30">
                      {selectedCourse.category}
                    </Badge>
                    <Badge variant="outline" className="border-white/40 text-white">
                      {selectedCourse.status}
                    </Badge>
                    <Badge variant="success">運動i臺灣來源已核對</Badge>
                  </div>
                  <SheetTitle className="mb-2 text-2xl font-bold leading-tight text-white">
                    {selectedCourse.title}
                  </SheetTitle>
                  <div className="flex items-center gap-2 text-sm text-primary-foreground/90">
                    <MapPin className="h-4 w-4" />
                    {selectedCourse.district} · {selectedCourse.location}
                  </div>
                </SheetHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Calendar className="h-3.5 w-3.5" />課程期間</div>
                      <div className="text-sm font-medium text-slate-900">{formatDate(selectedCourse.startDate)}<br />{formatDate(selectedCourse.endDate)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" />上課時間</div>
                      <div className="text-sm font-medium text-slate-900">{selectedCourse.time}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />招生人數</div>
                      <div className="text-sm font-medium text-slate-900">{selectedCourse.spotsTotal ?? '官方未提供'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Calendar className="h-3.5 w-3.5" />報名期間</div>
                      <div className="text-sm font-medium text-slate-900">{formatDate(selectedCourse.registrationStartDate)}<br />{formatDate(selectedCourse.registrationEndDate)}</div>
                    </div>
                  </div>

                  <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <section>
                      <h4 className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">課程簡介</h4>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{selectedCourse.description}</p>
                    </section>
                    <section>
                      <h4 className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">適合對象</h4>
                      <p className="text-sm text-slate-600">{selectedCourse.targetAudience}</p>
                    </section>
                    <section>
                      <h4 className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">辦理單位與講師</h4>
                      <p className="text-sm text-slate-600">{selectedCourse.organizer}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedCourse.instructor}</p>
                    </section>
                    <section>
                      <h4 className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">上課地點</h4>
                      <p className="text-sm text-slate-600">{selectedCourse.location}</p>
                      <p className="mt-1 text-xs text-slate-400">{selectedCourse.address || '完整地址請參閱官方頁面'}</p>
                    </section>
                    {(selectedCourse.contactName || selectedCourse.contactPhone) && (
                      <section>
                        <h4 className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">聯絡資訊</h4>
                        <p className="flex items-center gap-2 text-sm text-slate-600"><Phone className="h-4 w-4" />{selectedCourse.contactName} {selectedCourse.contactPhone}</p>
                      </section>
                    )}
                    {selectedCourse.activityName && (
                      <section>
                        <h4 className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">所屬運動i臺灣活動</h4>
                        <p className="text-sm text-slate-600">{selectedCourse.activityName}</p>
                        <p className="mt-1 text-xs text-slate-400">配對依據：{selectedCourse.matchReasons?.join('、') || '官方資料交叉核對'}</p>
                      </section>
                    )}
                    {selectedCourse.sessions.length > 0 && (
                      <section>
                        <h4 className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">課程場次</h4>
                        <div className="space-y-3">
                          {selectedCourse.sessions.map((session, index) => (
                            <div key={`${session.topic}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                              <p className="font-medium text-slate-800">{session.topic}</p>
                              <p className="mt-1">{session.dates}｜{session.time}</p>
                              <p className="mt-1 text-xs text-slate-500">{session.location} · {session.address}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>

              <div className="z-20 flex items-center gap-3 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-12 w-12 shrink-0 border-slate-200 ${favorites.has(selectedCourse.id) ? 'border-secondary/30 bg-secondary/5 text-secondary' : 'text-slate-500'}`}
                  onClick={() => toggleFavorite(selectedCourse.id)}
                >
                  {favorites.has(selectedCourse.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                </Button>
                <Button
                  className="h-12 flex-1 bg-secondary text-base font-bold text-white hover:bg-secondary/90"
                  onClick={() => window.open(selectedCourse.registrationUrl || selectedCourse.detailUrl, '_blank', 'noopener,noreferrer')}
                >
                  前往官方課程頁面<ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
