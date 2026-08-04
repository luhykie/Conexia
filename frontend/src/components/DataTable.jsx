import React from "react";

// Reusable fixed-grid table for tabular data.
export function DataTable({
  headers = [],
  rows = [],
  meta = null,
  onPageChange = null,
}) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  const currentPage = meta?.current_page ?? 1;
  const lastPage = meta?.last_page ?? 1;
  const from = meta?.from ?? (safeRows.length === 0 ? 0 : 1);
  const to = meta?.to ?? safeRows.length;
  const total = meta?.total ?? safeRows.length;

  return (
    <div
      className="table"
      style={{ "--cols": Math.max(safeHeaders.length, 1) }}
    >
      <div className="thead">
        {safeHeaders.map((header, index) => (
          <span key={`${header}-${index}`}>{header}</span>
        ))}
      </div>

      {safeRows.length === 0 ? (
        <div className="tr empty-row">
          <span style={{ gridColumn: "1 / -1" }}>
            No records found.
          </span>
        </div>
      ) : (
        safeRows.map((row, rowIndex) => {
          const safeRow = Array.isArray(row) ? row : [];

          return (
            <div
              className="tr"
              key={`${safeRow[0] ?? "row"}-${rowIndex}`}
            >
              {safeRow.map((cell, cellIndex) => (
                <span
                  key={`${String(cell)}-${cellIndex}`}
                  className={
                    cellIndex === safeRow.length - 1
                      ? statusClass(cell)
                      : ""
                  }
                >
                  {cell ?? ""}
                </span>
              ))}
            </div>
          );
        })
      )}

      <footer>
        Showing {from || 0}-{to || 0} of {total} records

        <div>
          <button
            type="button"
            disabled={!onPageChange || currentPage <= 1}
            onClick={() => onPageChange?.(currentPage - 1)}
          >
            &lt;
          </button>

          <button type="button" className="active-page">
            {currentPage}
          </button>

          <button
            type="button"
            disabled={!onPageChange || currentPage >= lastPage}
            onClick={() => onPageChange?.(currentPage + 1)}
          >
            &gt;
          </button>
        </div>
      </footer>
    </div>
  );
}

function statusClass(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return "";
  }

  return `badge ${String(value)
    .toLowerCase()
    .replaceAll(" ", "-")}`;
}