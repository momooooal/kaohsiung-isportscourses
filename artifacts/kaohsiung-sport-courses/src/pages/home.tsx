import React, { useState } from 'react';
import { useCourses } from '@/hooks/use-courses';
import {
  Course,
  CourseStatus,
  CourseCategoryGroup,
  District,
  normalizeCourseCategory,
} from '@/data/courses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Search, MapPin, Calendar, Clock, Bookmark, BookmarkCheck,
  Activity, ArrowUpRight, Users, ChevronRight, X, AlertCircle, Filter
} from 'lucide-react';

const DISTRICTS: District[] = ['鳳山區', '左營區', '鼓山區', '三民區', '苓雅區', '前鎮區', '楠梓區'];
const STATUSES: CourseStatus[] = ['報名中', '即將開始', '已額滿'];

export default function Home() {
  const {
    courses, totalCount, filters, updateFilter, clearFilters,
    sortBy, setSortBy, favorites, toggleFavorite, availableCategories
  } = useCourses();

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const getStatusBadgeVariant = (status: CourseStatus) => {
    switch (status) {
      case '報名中': return 'success';
      case '即將開始': return 'warning';
      case '已額滿': return 'secondary';
      default: return 'default';
    }
  };

  const handleCategoryToggle = (category: CourseCategoryGroup) => {
    const current = filters.categories;
    const next = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    updateFilter('categories', next);
  };

  const handleDistrictToggle = (district: District) => {
    const current = filters.districts;
    const next = current.includes(district)
      ? current.filter(d => d !== district)
      : [...current, district];
    updateFilter('districts', next);
  };

  const handleStatusToggle = (status: CourseStatus) => {
    const current = filters.status;
    const next = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    updateFilter('status', next);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-6 w-6" />
            <h1 className="text-xl font-bold tracking-tight">高雄運動 i 臺灣<span className="hidden sm:inline">課程查詢</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter('showFavoritesOnly', !filters.showFavoritesOnly)}
              className={filters.showFavoritesOnly ? "text-secondary bg-secondary/10" : "text-slate-600"}
            >
              {filters.showFavoritesOnly ? <BookmarkCheck className="h-4 w-4 mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
              <span className="hidden sm:inline">我的收藏 ({favorites.size})</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-primary text-white py-12 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
        <div className="max-w-7xl mx-auto relative z-10 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-black mb-3 text-white">找到專屬於你的運動時光</h2>
            <p className="text-primary-foreground/90 text-lg mb-4">
              探索高雄在地優質運動課程，促進身心健康。所有資訊皆來自「運動 i 臺灣」計畫。
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-primary-foreground/70 bg-black/10 w-fit px-3 py-1.5 rounded-full mx-auto sm:mx-0">
              <AlertCircle className="h-4 w-4" />
              <span>資料最後同步：2023-10-25 10:00 (非即時)</span>
            </div>
          </div>
          <div className="w-full sm:w-auto relative max-w-md flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="搜尋課程名稱或地點..."
                className="pl-10 h-12 rounded-full border-0 shadow-lg text-slate-900 focus-visible:ring-secondary text-base"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col md:flex-row gap-8">
        
        {/* Mobile Filter Toggle */}
        <div className="md:hidden flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <span className="font-medium text-slate-700">找到 {totalCount} 堂課程</span>
          <Button variant="outline" size="sm" onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}>
            <Filter className="h-4 w-4 mr-2" /> 篩選
          </Button>
        </div>

        {/* Sidebar Filters */}
        <aside className={`md:w-64 shrink-0 flex flex-col gap-6 ${isMobileFilterOpen ? 'block' : 'hidden md:flex'}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-800">進階篩選</h3>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500" onClick={clearFilters}>
              清除全部
            </Button>
          </div>

          {/* Status Filter */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider">報名狀態</h4>
            <div className="flex flex-col gap-2">
              {STATUSES.map(status => (
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

          {/* Category Filter */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider">運動項目</h4>
            <div className="flex flex-col gap-2">
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

          {/* District Filter */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider">行政區</h4>
            <div className="flex flex-col gap-2">
              {DISTRICTS.map(district => (
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

        {/* Results */}
        <div className="flex-1 min-w-0">
          <div className="hidden md:flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              {filters.showFavoritesOnly ? '我的收藏' : '課程列表'} <span className="text-slate-500 text-base font-normal ml-2">共 {totalCount} 筆結果</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">排序方式</span>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[160px] h-9 bg-white">
                  <SelectValue placeholder="選擇排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-asc">開課日期 (由近到遠)</SelectItem>
                  <SelectItem value="date-desc">開課日期 (由遠到近)</SelectItem>
                  <SelectItem value="availability-desc">剩餘名額 (由多到少)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalCount === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-xl p-12 text-center flex flex-col items-center">
              <div className="bg-slate-100 p-4 rounded-full mb-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">找不到符合的課程</h3>
              <p className="text-slate-500 mb-6 max-w-sm">
                目前沒有符合您篩選條件的課程，請嘗試放寬篩選條件或搜尋其他關鍵字。
              </p>
              <Button onClick={clearFilters} variant="outline">
                清除所有篩選
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {courses.map(course => {
                const isFavorite = favorites.has(course.id);
                return (
                  <Card key={course.id} className="overflow-hidden group hover:border-primary/30 hover:shadow-md transition-all cursor-pointer flex flex-col h-full bg-white border-slate-200" onClick={() => setSelectedCourse(course)}>
                    <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant={getStatusBadgeVariant(course.status)} className="font-normal shadow-none">
                            {course.status}
                          </Badge>
                          <Badge variant="outline" className="text-slate-600 bg-slate-50 font-normal shadow-none border-slate-200">
                            {normalizeCourseCategory(course.category)}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
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
                        className={`shrink-0 h-8 w-8 rounded-full z-10 ${isFavorite ? 'text-secondary bg-secondary/10 hover:bg-secondary/20' : 'text-slate-400 hover:text-secondary hover:bg-slate-100'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(course.id);
                        }}
                      >
                        {isFavorite ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      </Button>
                    </CardHeader>
                    <CardContent className="pb-4 text-sm text-slate-600 flex-1">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                          <span>{course.startDate.replace(/-/g, '/')} ~ {course.endDate.replace(/-/g, '/')}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                          <span>{course.time}</span>
                        </div>
                      </div>
                    </CardContent>
                    <div className="mt-auto border-t border-slate-100 bg-slate-50/50 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">
                          {course.status === '已額滿' ? '名額已滿' : `剩餘 ${course.spotsAvailable} 名額`}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {course.fee === '免費' ? '免費' : `NT$ ${course.fee}`}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-sm mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Activity className="h-5 w-5" />
            <span className="font-semibold">高雄運動 i 臺灣課程查詢</span>
          </div>
          <div className="text-center md:text-right">
            <p>本平台資訊整理自教育部體育署「運動 i 臺灣」計畫。</p>
            <p className="mt-1">實際報名狀況與詳細資訊，請以官方報名平台為準。</p>
          </div>
        </div>
      </footer>

      {/* Detail Sheet */}
      <Sheet open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-slate-50 border-l-0">
          {selectedCourse && (
            <>
              <div className="bg-primary px-6 py-8 relative text-white">
                <SheetHeader className="relative z-10 text-left">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-sm">
                      {selectedCourse.category}
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
                  {/* Quick Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5"/> 課程期間</div>
                      <div className="font-medium text-sm text-slate-900">{selectedCourse.startDate} <br/> {selectedCourse.endDate}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> 上課時間</div>
                      <div className="font-medium text-sm text-slate-900">{selectedCourse.time}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Users className="h-3.5 w-3.5"/> 報名狀況</div>
                      <div className="font-medium text-sm text-slate-900">
                        剩餘 <span className="text-secondary font-bold text-lg">{selectedCourse.spotsAvailable}</span> / {selectedCourse.spotsTotal}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">費用</div>
                      <div className="font-medium text-sm text-slate-900">
                        {selectedCourse.fee === '免費' ? '免費' : `NT$ ${selectedCourse.fee}`}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">課程簡介</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{selectedCourse.description}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">適合對象</h4>
                      <p className="text-sm text-slate-600">{selectedCourse.targetAudience}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">指導單位 / 教練</h4>
                      <p className="text-sm text-slate-600">{selectedCourse.organizer} · {selectedCourse.instructor}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">上課地點</h4>
                      <p className="text-sm text-slate-600">{selectedCourse.location} <br/><span className="text-slate-400 text-xs">{selectedCourse.address}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
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
                  disabled={selectedCourse.status === '已額滿'}
                  onClick={() => window.open(selectedCourse.registrationUrl, '_blank')}
                >
                  {selectedCourse.status === '已額滿' ? '報名已截止' : '前往官方平台報名'}
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
