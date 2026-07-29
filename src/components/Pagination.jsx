import React from "react";

function pageRange(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const result = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      result.push(`ellipsis-${page}`);
    }
    result.push(page);
  });

  return result;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalRecords,
  onPageChange,
}) {
  const startRecord =
    totalRecords === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(
    currentPage * pageSize,
    totalRecords
  );

  return (
    <div className="pagination">
      <div className="results-summary">
        Showing {startRecord}–{endRecord} of {totalRecords} results
      </div>

      {totalPages > 1 && (
        <nav className="page-controls" aria-label="Pagination">
          <button
            className="page-btn"
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous page"
          >
            &lt;
          </button>

          {pageRange(currentPage, totalPages).map((item) =>
            typeof item === "string" ? (
              <span className="dots" key={item}>
                …
              </span>
            ) : (
              <button
                className={`page-btn ${
                  item === currentPage ? "active" : ""
                }`}
                type="button"
                key={item}
                onClick={() => onPageChange(item)}
                aria-current={
                  item === currentPage ? "page" : undefined
                }
              >
                {item}
              </button>
            )
          )}

          <button
            className="page-btn"
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
          >
            &gt;
          </button>
        </nav>
      )}
    </div>
  );
}

export default Pagination;
