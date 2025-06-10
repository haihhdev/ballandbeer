"use client"
import React from "react";

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  // Helper to generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 py-6 select-none">
      <span className="text-[#5c3613] text-base mr-2">
        Page {currentPage} of {totalPages}
      </span>
      {/* Previous button */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={`rounded-full border px-3 py-1 text-base font-medium transition-colors duration-200
          ${currentPage === 1
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-[#5c3613] border-[#f1c43e] hover:bg-[#f1c43e] hover:text-[#5c3613]'}
        `}
        aria-label="Previous page"
      >
        &laquo;
      </button>
      {/* Page numbers */}
      {getPageNumbers().map((page, idx) =>
        page === '...' ? (
          <span key={idx} className="px-3 py-1 text-base text-[#5c3613]">...</span>
        ) : (
          <button
            key={idx}
            onClick={() => onPageChange(page)}
            className={`rounded-full border px-3 py-1 text-base font-medium transition-colors duration-200
              ${currentPage === page
                ? 'bg-[#f09627] text-white border-[#f09627]'
                : 'bg-white text-[#5c3613] border-[#f1c43e] hover:bg-[#f1c43e] hover:text-[#5c3613]'}
            `}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}
      {/* Next button */}
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className={`rounded-full border px-3 py-1 text-base font-medium transition-colors duration-200
          ${currentPage === totalPages
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-[#5c3613] border-[#f1c43e] hover:bg-[#f1c43e] hover:text-[#5c3613]'}
        `}
        aria-label="Next page"
      >
        &raquo;
      </button>
    </div>
  );
} 