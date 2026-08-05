import React from "react";

// Reusable fixed-grid table for prototype data.
export function DataTable({ headers, rows }) {
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
        Showing {rows.length} {rows.length === 1 ? "record" : "records"}
      </footer>
    </div>
  );
}

function statusClass(value) {
  return `badge ${String(value).toLowerCase().replaceAll(" ", "-")}`;
}
