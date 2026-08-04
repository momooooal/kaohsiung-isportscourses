import React, { useState } from 'react';
import { useCourses } from '@/hooks/use-courses';
import {
  ContentView,
  Course,
  CourseStatus,
  CourseCategoryOption,
  District,
  formatCourseCategories,
} from '@/data/courses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Bookmark,
  BookmarkCheck,
  Activity,
  ArrowUpRight,
  Users,
  AlertCircle,
  Filter,
  Layers3,
  Dumbbell,
} from 'lucide-react';

const isRegistrationClosed = (status: CourseStatus) =>
  /截止|額滿|結束|暫停|取消|停辦/.test(status);

const formatFee = (fee: Course['fee']) => {
  if (fee === null || fee === undefined || fee === '') return '未提供';
  if (fee === '免費') return '免費';
  if (typeof fee === 'number') return `NT$ ${fee}`;
  return String(fee);
};

const formatSyncTime = (value?: string) => {
  if (!value) return '尚無成功同步紀錄';
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
};

const formatDate = (value?: string) => value ? value.replace(/-/g, '/') : '日期詳見官方頁面';

const viewLabels: Record<ContentView, string> = {
  all: '全部資訊',
  'regular-course': '常態課程',
  'series-activity': '系列活動',
};

export default function Home() {
  const {
    courses,
    totalCount,
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
    regularCourseCount,
    seriesActivityCount,
    contentView,
    setContentView,
    syncStatus,
    isLoading,
    loadError,
  } = useCourses();

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const getStatusBadgeVariant = (status: CourseStatus) => {
    if (/報名中|招生中|進行中|辦理中/.test(status)) return 'success';
    if (/即將|尚未/.test(status)) return 'warning';
    if (/額滿|截止|結束|暫停|取消|停辦/.test(status)) return 'secondary';
    return 'default';
  };

  const handleCategoryToggle = (category: CourseCategoryOption) => {
    const current = filters.categories;
    const next = current.includes(category)
      ? current.filter(value => value !== category)
      : [...current, category];
    updateFilter('categories', next);
  };

  const handleDistrictToggle = (district: District) => {
    const current = filters.districts;
    const next = current.includes(district)
      ? current.filter(value => value !== district)
      : [...current, district];
    updateFilter('districts', next);
  };

  const handleStatusToggle = (status: CourseStatus) => {
    const current = filters.status;
    const next = current.includes(status)
      ? current.filter(value => value !== status)
      : [...current, status];
    updateFilter('status', next);
  };

  const switchView = (view: ContentView) => {
    setContentView(view);
    updateFilter('categories', []);
    updateFilter('districts', []);
    updateFilter('status', []);
  };

  const selectedIsSeries = selectedCourse?.itemType === 'series-activity';
  const noun = contentView === 'regular-course' ? '課程' : contentView === 'series-activity' ? '活動' : '筆資料';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-6 w-6" />
            <h1 className="text-xl font-bold tracking-tight">
              高雄運動 i 臺灣<span className="hidden sm:inline">資訊查詢</span>
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateFilter('showFavoritesOnly', !filters.showFavoritesOnly)}
            className={filters.showFavoritesOnly ? 'text-secondary bg-secondary/10' : 'text-slate-600'}
          >
            {filters.showFavoritesOnly
              ? <BookmarkCheck className="h-4 w-4 mr-2" />
              : <Bookmark className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">我的收藏 ({favorites.size})</span>
          </Button>
        </div>
      </header>

      <section className="bg-primary text-white py-12 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
        <div className="max-w-7xl mx-auto relative z-10 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-black mb-3 text-white">找到專屬於你的運動時光</h2>
            <p className="text-primary-foreground/90 text-lg mb-4">
              一次查詢高雄市「運動 i 臺灣」常態課程與系列活動，資訊定時同步自官方平台。
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-primary-foreground/70 bg-black/10 w-fit px-3 py-1.5 rounded-full mx-auto sm:mx-0">
              <AlertCircle className="h-4 w-4" />
              <span>資料最後同步：{formatSyncTime(syncStatus?.lastSuccessfulAt)}（定時同步，非即時）</span>
            </div>
          </div>
          <div className="w-full sm:w-auto relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="搜尋課程、活動、地點或主辦單位..."
              className="pl-10 h-12 rounded-full border-0 shadow-lg text-slate-900 focus-visible:ring-secondary text-base"
              value={filters.search}
              onChange={event => updateFilter('search', event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-2">
          <Button
            variant={contentView === 'all' ? 'default' : 'outline'}
            onClick={() => switchView('all')}
            className="gap-2"
          >
            <Layers3 className="h-4 w-4" /> 全部資訊 ({regularCourseCount + seriesActivityCount})
          </Button>
          <Button
            variant={contentView === 'regular-course' ? 'default' : 'outline'}
            onClick={() => switchView('regular-course')}
            className="gap-2"
          >
            <Dumbbell className="h-4 w-4" /> 常態課程 ({regularCourseCount})
          </Button>
          <Button
            variant={contentView === 'series-activity' ? 'default' : 'outline'}
            onClick={() => switchView('series-activity')}
            className="gap-2"
          >
            <Activity className="h-4 w-4" /> 系列活動 ({seriesActivityCount})
          </Button>
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col md:flex-row gap-8">
        <div className="md:hidden flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <span className="font-medium text-slate-700">找到 {totalCount} {noun}</span>
          <Button variant="outline" size="sm" onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}>
            <Filter className="h-4 w-4 mr-2" /> 篩選
          </Button>
        </div>

        <aside className={`md:w-64 shrink-0 flex flex-col gap-6 ${isMobileFilterOpen ? 'block' : 'hidden md:flex'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-800">進階篩選</h3>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500" onClick={clearFilters}>
              清除全部
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider">辦理／報名狀態</h4>
            <div className="flex flex-col gap-2">
              {availableStatuses.map(status => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status}`}
                    checked={filters.status.includes(status)}
                    onCheckedChange={() => handleStatusToggle(status)}
                  />
                  <Label htmlFor={`status-${status}`} className="font-normal cursor-pointer">{status}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider">運動項目</h4>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2">
              {availableCategories.map(category => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cat-${category}`}
                    checked={filters.categories.includes(category)}
                    onCheckedChange={() => handleCategoryToggle(category)}
                  />
                  <Label htmlFor={`cat-${category}`} className="font-normal cursor-pointer">{category}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider">行政區</h4>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2">
              {availableDistricts.map(district => (
                <div key={district} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dist-${district}`}
                    checked={filters.districts.includes(district)}
                    onCheckedChange={() => handleDistrictToggle(district)}
                  />
                  <Label htmlFor={`dist-${district}`} className="font-normal cursor-pointer">{district}</Label>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="hidden md:flex justify-between items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-slate-800">
              {filters.showFavoritesOnly ? '我的收藏' : viewLabels[contentView]}
              <span className="text-slate-500 text-base font-normal ml-2">共 {totalCount} 筆結果</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">排序方式</span>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[170px] h-9 bg-white">
                  <SelectValue placeholder="選擇排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-asc">開始日期（由近到遠）</SelectItem>
                  <SelectItem value="date-desc">開始日期（由遠到近）</SelectItem>
                  <SelectItem value="availability-desc">剩餘名額（由多到少）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              正在載入最新課程與活動資料…
            </div>
          ) : loadError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">資料載入失敗</h3>
              <p className="text-red-700">{loadError}</p>
            </div>
          ) : totalCount === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center flex flex-col items-center">
              <div className="bg-slate-100 p-4 rounded-full mb-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">找不到符合的資料</h3>
              <p className="text-slate-500 mb-6 max-w-sm">
                目前沒有符合篩選條件的課程或活動，請嘗試放寬條件或搜尋其他關鍵字。
              </p>
              <Button onClick={clearFilters} variant="outline">清除所有篩選</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {courses.map(item => {
                const isFavorite = favorites.has(item.id);
                const isSeries = item.itemType === 'series-activity';
                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden group hover:border-primary/30 hover:shadow-md transition-all cursor-pointer flex flex-col h-full bg-white border-slate-200"
                    onClick={() => setSelectedCourse(item)}
                  >
                    <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant={getStatusBadgeVariant(item.status)} className="font-normal shadow-none">
                            {item.status}
                          </Badge>
                          <Badge variant="outline" className="text-primary bg-primary/5 font-normal shadow-none border-primary/20">
                            {isSeries ? '系列活動' : '常態課程'}
                          </Badge>
                          <Badge variant="outline" className="text-slate-600 bg-slate-50 font-normal shadow-none border-slate-200">
                            {formatCourseCategories(item.category)}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                          {item.title}
                        </CardTitle>
                        <CardDescription className="mt-1.5 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.district} · {item.location}</span>
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`shrink-0 h-8 w-8 rounded-full z-10 ${isFavorite ? 'text-secondary bg-secondary/10 hover:bg-secondary/20' : 'text-slate-400 hover:text-secondary hover:bg-slate-100'}`}
                        onClick={event => {
                          event.stopPropagation();
                          toggleFavorite(item.id);
                        }}
                      >
                        {isFavorite ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      </Button>
                    </CardHeader>
                    <CardContent className="pb-4 text-sm text-slate-600 flex-1">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                          <span>{formatDate(item.startDate)} ~ {formatDate(item.endDate)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                          <span>{item.time}</span>
                        </div>
                      </div>
                    </CardContent>
                    <div className="mt-auto border-t border-slate-100 bg-slate-50/50 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {isSeries
                            ? item.organizer
                            : item.spotsAvailable !== null && item.spotsAvailable !== undefined
                              ? `剩餘 ${item.spotsAvailable} 名額`
                              : item.status}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary shrink-0">{formatFee(item.fee)}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8 text-sm mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Activity className="h-5 w-5" />
            <span className="font-semibold">高雄運動 i 臺灣資訊查詢</span>
          </div>
          <div className="text-center md:text-right">
            <p>資料來源：運動部全民運動署 i運動資訊平台。</p>
            <p className="mt-1">實際課程、活動、名額及報名資訊，請以官方平台與主辦單位公告為準。</p>
          </div>
        </div>
      </footer>

      <Sheet open={!!selectedCourse} onOpenChange={open => !open && setSelectedCourse(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-slate-50 border-l-0">
          {selectedCourse && (
            <>
              <div className="bg-primary px-6 py-8 relative text-white">
                <SheetHeader className="relative z-10 text-left">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-sm">
                      {selectedIsSeries ? '系列活動' : '常態課程'}
                    </Badge>
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-sm">
                      {formatCourseCategories(selectedCourse.category)}
                    </Badge>
                    <Badge variant="outline" className="border-white/40 text-white backdrop-blur-sm">
                      {selectedCourse.status}
                    </Badge>
                  </div>
                  <SheetTitle className="text-2xl font-bold text-white mb-2 leading-tight">
                    {selectedCourse.title}
                  </SheetTitle>
                  <div className="text-primary-foreground/90 flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" /> {selectedCourse.district} · {selectedCourse.location}
                  </div>
                </SheetHeader>
                <div className="absolute inset-0 bg-gradient-to-t from-primary to-primary/80" />
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> {selectedIsSeries ? '活動期間' : '課程期間'}
                      </div>
                      <div className="font-medium text-sm text-slate-900">
                        {formatDate(selectedCourse.startDate)}<br />{formatDate(selectedCourse.endDate)}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {selectedIsSeries ? '活動時間' : '上課時間'}
                      </div>
                      <div className="font-medium text-sm text-slate-900">{selectedCourse.time}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> {selectedIsSeries ? '活動狀態' : '報名狀況'}
                      </div>
                      <div className="font-medium text-sm text-slate-900">
                        {!selectedIsSeries && selectedCourse.spotsAvailable !== null && selectedCourse.spotsAvailable !== undefined ? (
                          <>剩餘 <span className="text-secondary font-bold text-lg">{selectedCourse.spotsAvailable}</span>
                            {selectedCourse.spotsTotal !== null && selectedCourse.spotsTotal !== undefined
                              ? ` / ${selectedCourse.spotsTotal}`
                              : ''}
                          </>
                        ) : selectedCourse.status}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 mb-1">費用</div>
                      <div className="font-medium text-sm text-slate-900">{formatFee(selectedCourse.fee)}</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">
                        {selectedIsSeries ? '活動內容' : '課程簡介'}
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{selectedCourse.description}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">適合對象</h4>
                      <p className="text-sm text-slate-600">{selectedCourse.targetAudience}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">
                        {selectedIsSeries ? '主辦單位／聯絡人' : '辦理單位／教練'}
                      </h4>
                      <p className="text-sm text-slate-600">
                        {selectedCourse.organizer}
                        {selectedIsSeries
                          ? selectedCourse.contactName ? ` · ${selectedCourse.contactName}` : ''
                          : selectedCourse.instructor ? ` · ${selectedCourse.instructor}` : ''}
                      </p>
                      {selectedCourse.contactPhone && (
                        <p className="text-xs text-slate-400 mt-1">聯絡電話：{selectedCourse.contactPhone}</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">
                        {selectedIsSeries ? '活動地點' : '上課地點'}
                      </h4>
                      <p className="text-sm text-slate-600">
                        {selectedCourse.location}<br />
                        <span className="text-slate-400 text-xs">{selectedCourse.address}</span>
                      </p>
                    </div>
                    {selectedCourse.sessions && selectedCourse.sessions.length > 1 && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">
                          {selectedIsSeries ? '活動場次' : '課程場次'}
                        </h4>
                        <div className="space-y-3">
                          {selectedCourse.sessions.map((session, index) => (
                            <div key={`${session.topic}-${index}`} className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                              <p className="font-medium text-slate-800">{session.topic || `第 ${index + 1} 場`}</p>
                              <p>{session.dates}　{session.time}</p>
                              <p className="text-xs text-slate-500 mt-1">{session.location || session.address}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-12 w-12 shrink-0 border-slate-200 ${favorites.has(selectedCourse.id) ? 'text-secondary bg-secondary/5 border-secondary/30' : 'text-slate-500'}`}
                  onClick={() => toggleFavorite(selectedCourse.id)}
                >
                  {favorites.has(selectedCourse.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                </Button>
                <Button
                  className="flex-1 h-12 text-base font-bold bg-secondary hover:bg-secondary/90 text-white"
                  disabled={!selectedIsSeries && isRegistrationClosed(selectedCourse.status)}
                  onClick={() => window.open(selectedCourse.registrationUrl || selectedCourse.detailUrl, '_blank')}
                >
                  {selectedIsSeries
                    ? '前往官方活動頁面'
                    : isRegistrationClosed(selectedCourse.status)
                      ? selectedCourse.status
                      : '前往官方平台報名'}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
