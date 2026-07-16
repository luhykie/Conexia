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
        Showing 1-{rows.length} of 128 records
        <div>
          <button>&lt;</button>
          <button className="active-page">1</button>
          <button>2</button>
          <button>&gt;</button>
        </div>
      </footer>
    </div>
  );
}

function statusClass(value) {
  return `badge ${String(value).toLowerCase().replaceAll(" ", "-")}`;
}
