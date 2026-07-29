import React from "react";

// Reusable fixed-grid table for tabular data.
export function DataTable({ headers, rows, meta, onPageChange }) {
  const currentPage = meta?.current_page ?? 1;
  const lastPage = meta?.last_page ?? 1;
  const from = meta?.from ?? (rows.length === 0 ? 0 : 1);
  const to = meta?.to ?? rows.length;
  const total = meta?.total ?? rows.length;

  return (
    <div className="table" style={{ "--cols": headers.length }}>
      <div className="thead">
        {headers.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>
      {rows.map((row, rowIndex) => (
        <div className="tr" key={`${row[0]}-${rowIndex}`}>
          {row.map((cell, cellIndex) => (
            <span key={`${cell}-${cellIndex}`} className={cellIndex === row.length - 1 ? statusClass(cell) : ""}>
              {cell}
            </span>
          ))}
        </div>
      ))}
      <footer>
        Showing {from || 0}-{to || 0} of {total} records
        <div>
          <button
            disabled={!onPageChange || currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            &lt;
          </button>
          <button className="active-page">{currentPage}</button>
          <button
            disabled={!onPageChange || currentPage >= lastPage}
            onClick={() => onPageChange(currentPage + 1)}
          >
            &gt;
          </button>
        </div>
      </footer>
    </div>
  );
}

function statusClass(value) {
  return `badge ${String(value).toLowerCase().replaceAll(" ", "-")}`;
}
