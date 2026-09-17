import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TablePaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  pageSizeOptions = [8, 15, 25, 50],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, 5, -1, totalPages];
    if (safePage >= totalPages - 2) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, -1, safePage - 1, safePage, safePage + 1, -1, totalPages];
  }, [safePage, totalPages]);

  return (
    <div
      className={`shrink-0 flex flex-col gap-3.5 border-t border-[#ECE7DC] bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between xl:px-8 xl:py-5 ${className}`}
    >
      {/* Left: Summary Count & Page Size Dropdown */}
      <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm xl:text-[15px] text-slate-600">
        <p role="status">
          Showing <strong className="font-bold text-[#101A2E] tabular-nums">{totalItems === 0 ? 0 : start + 1}</strong> to{' '}
          <strong className="font-bold text-[#101A2E] tabular-nums">{Math.min(start + pageSize, totalItems)}</strong> of{' '}
          <strong className="font-bold text-[#101A2E] tabular-nums">{totalItems}</strong> {itemLabel}
        </p>

        <div className="flex items-center gap-2 pl-3 border-l border-[#E7E2DC]">
          <span className="text-slate-500 text-xs sm:text-sm xl:text-[15px]">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="rounded-lg border border-[#E7E2DC] bg-white px-2.5 py-1 text-xs sm:text-sm xl:text-[15px] font-semibold text-[#101A2E] focus:border-[#8C592B] focus:outline-none focus:ring-1 focus:ring-[#8C592B] transition-colors"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Previous / Clickable Page Numbers / Next */}
      <nav aria-label={`${itemLabel} pagination`} className="flex items-center gap-1.5 xl:gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          aria-label="Previous page"
          className="flex h-9 w-9 xl:h-10 xl:w-10 cursor-pointer items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:border-[#8C592B] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4 xl:h-5 xl:w-5" />
        </button>

        {pageNumbers.map((n, i) =>
          n === -1 ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm xl:text-base text-slate-400 select-none">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              aria-current={n === safePage ? 'page' : undefined}
              className={`h-9 min-w-9 xl:h-10 xl:min-w-10 cursor-pointer rounded-xl border px-3 text-xs sm:text-sm xl:text-[15px] font-bold transition-all ${
                n === safePage
                  ? 'border-[#8C592B] bg-[#8C592B] text-white shadow-2xs'
                  : 'border-[#E2E8F0] bg-white text-slate-700 hover:border-[#8C592B] hover:bg-[#FAF8F5]'
              }`}
            >
              {n}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          aria-label="Next page"
          className="flex h-9 w-9 xl:h-10 xl:w-10 cursor-pointer items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:border-[#8C592B] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4 xl:h-5 xl:w-5" />
        </button>
      </nav>
    </div>
  );
};
