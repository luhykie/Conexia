// [FEATURE: Shared/Utility] - provides shared application infrastructure and reusable interface behavior.
import React from "react";

// Coordinates table within the shared application infrastructure and reusable interface behavior workflow.
export function DataTable({
  headers = [],
  rows = [],
  meta,
  onPageChange,
  emptyMessage = "No records found.",
  columnClasses = [],
  statusColumnIndex,
  rowClasses = [],
}) {
  const currentPage = toFiniteNumber(meta?.current_page, 1);
  const lastPage = toFiniteNumber(meta?.last_page, 1);
  const perPage = toFiniteNumber(meta?.per_page, rows.length || 1);
  const total = toFiniteNumber(meta?.total, rows.length);
  const from = rows.length
    ? ((currentPage - 1) * perPage) + 1
    : 0;
  const to = rows.length
    ? from + rows.length - 1
    : 0;

  return (
    <div className="cx-table">
      <table>
        <thead>
          <tr>
            {headers.map((header, headerIndex) => (
              <th key={header} className={columnClasses[headerIndex] || ""}>{header}</th>
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
              <tr key={rowIndex} className={rowClasses[rowIndex] || ""}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={[
                      columnClasses[cellIndex] || "",
                      statusColumnIndex === undefined && cellIndex === row.length - 1
                        ? statusClass(cell)
                        : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {cellIndex === statusColumnIndex
                      ? <span className={statusClass(cell)}>{cell}</span>
                      : cell}
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

// Coordinates class within the shared application infrastructure and reusable interface behavior workflow.
function statusClass(value) {
  if (typeof value !== "string") return "";

  return `badge ${value
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}
