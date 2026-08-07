import React from "react";

export function DataTable({
  headers = [],
  rows = [],
  meta,
  onPageChange,
  emptyMessage = "No records found.",
}) {
  const currentPage = meta?.current_page ?? 1;
  const lastPage = meta?.last_page ?? 1;

  const from = meta?.from ?? (rows.length ? 1 : 0);
  const to = meta?.to ?? rows.length;
  const total = meta?.total ?? rows.length;

  return (
    <div className="cx-table">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="cx-table-empty"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={
                      cellIndex === row.length - 1
                        ? statusClass(cell)
                        : ""
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <footer className="cx-table-footer">
        <span>
          Showing {from}-{to} of {total}
        </span>

        <div className="cx-pagination">
          <button
            disabled={!onPageChange || currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>

          <span>
            {currentPage} / {lastPage}
          </span>

          <button
            disabled={
              !onPageChange ||
              currentPage >= lastPage
            }
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}

function statusClass(value) {
  if (typeof value !== "string") return "";

  return `badge ${value
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}