import React from 'react';
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  totalPages?: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
  showAllOption?: boolean;
}

export function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, 200],
  itemLabel = 'سجل',
  className = '',
  showAllOption = true,
}: TablePaginationProps) {
  // If totalItems is 0, render a light empty summary
  if (totalItems === 0) {
    return null;
  }

  // Treat pageSize <= 0 as "All"
  const isShowAll = pageSize >= totalItems || pageSize >= 999999;
  const effectivePageSize = isShowAll ? totalItems : Math.max(1, pageSize);
  const totalPages = isShowAll ? 1 : Math.ceil(totalItems / effectivePageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = isShowAll ? 1 : (safeCurrentPage - 1) * effectivePageSize + 1;
  const endItem = isShowAll ? totalItems : Math.min(safeCurrentPage * effectivePageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    if (safeCurrentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (safeCurrentPage < totalPages - 2) {
      pages.push('...');
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== safeCurrentPage) {
      onPageChange(p);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    onPageSizeChange(val);
    onPageChange(1); // Reset to page 1 on page size change
  };

  return (
    <div
      dir="rtl"
      className={`p-3 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none ${className}`}
    >
      {/* Left / Start: Rows-per-page selector & item count stats */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        {/* Page size selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs">
          <label htmlFor="pageSizeSelect" className="text-slate-600 font-bold whitespace-nowrap text-[11px]">
            عدد الأسطر:
          </label>
          <select
            id="pageSizeSelect"
            value={isShowAll ? 999999 : pageSize}
            onChange={handlePageSizeChange}
            className="bg-white border border-slate-300 text-slate-800 font-black rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            {showAllOption && (
              <option value={999999}>
                الكل ({totalItems})
              </option>
            )}
          </select>
        </div>

        {/* Total & Range items text */}
        <div className="text-slate-500 font-medium text-[11px] whitespace-nowrap">
          عرض <strong className="font-black text-slate-800">{startItem}</strong> -{' '}
          <strong className="font-black text-slate-800">{endItem}</strong> من أصل{' '}
          <strong className="font-black text-indigo-700">{totalItems}</strong> {itemLabel}
        </div>
      </div>

      {/* Right / End: Pagination Navigation */}
      <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
        {/* First Page (RTL: ChevronsRight goes to page 1) */}
        <button
          type="button"
          onClick={() => handlePageChange(1)}
          disabled={safeCurrentPage <= 1 || isShowAll}
          title="الصفحة الأولى"
          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors cursor-pointer"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page (RTL: ChevronRight goes to previous) */}
        <button
          type="button"
          onClick={() => handlePageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1 || isShowAll}
          title="الصفحة السابقة"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-xs transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px]">السابق</span>
        </button>

        {/* Numeric Page Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold text-xs select-none">
                  ...
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === safeCurrentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => handlePageChange(pageNum)}
                disabled={isShowAll}
                className={`min-w-[28px] h-7 px-1.5 rounded-lg font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200 border border-indigo-600'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page (RTL: ChevronLeft goes to next) */}
        <button
          type="button"
          onClick={() => handlePageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages || isShowAll}
          title="الصفحة التالية"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-xs transition-colors cursor-pointer"
        >
          <span className="hidden md:inline text-[11px]">التالي</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Last Page (RTL: ChevronsLeft goes to last page) */}
        <button
          type="button"
          onClick={() => handlePageChange(totalPages)}
          disabled={safeCurrentPage >= totalPages || isShowAll}
          title="الصفحة الأخيرة"
          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors cursor-pointer"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
