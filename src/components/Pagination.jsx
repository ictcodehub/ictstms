import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable Pagination Component
 * Displays chevron navigation with page indicator for all screen sizes
 */
export default function Pagination({ currentPage, totalPages, onPageChange }) {
    return (
        <div className="flex items-center gap-2 justify-center md:justify-end">
            {/* Previous Button */}
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                aria-label="Previous page"
            >
                <ChevronLeft className="h-5 w-5 text-slate-700" />
            </button>

            {/* Page Indicator */}
            <div className="px-4 py-2 text-sm font-semibold text-slate-700 min-w-[80px] text-center">
                {currentPage} / {totalPages}
            </div>

            {/* Next Button */}
            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                aria-label="Next page"
            >
                <ChevronRight className="h-5 w-5 text-slate-700" />
            </button>
        </div>
    );
}
