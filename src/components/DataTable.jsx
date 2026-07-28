import React from "react";

// Reusable fixed-grid table for prototype data.
export function DataTable({ headers, rows, emptyMessage = "No records found." }) {
  return (
    <div className="table" style={{ "--cols": headers.length }}>
      <div className="thead">
        {headers.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>
      {rows.length ? rows.map((row, rowIndex) => (
        <div className="tr" key={`${row[0]}-${rowIndex}`}>
          {row.map((cell, cellIndex) => (
            <span key={`${rowIndex}-${cellIndex}`} className={cellClass(cell, cellIndex, row.length)}>
              {cell}
            </span>
          ))}
        </div>
      )) : (
        <div className="table-empty">{emptyMessage}</div>
      )}
      <footer>
        Showing 1-{rows.length} of {rows.length} records
        <div>
          <button>&lt;</button>
          <button className="active-page">1</button>
          <button disabled>2</button>
          <button>&gt;</button>
        </div>
      </footer>
    </div>
  );
}

function cellClass(value, cellIndex, rowLength) {
  const classes = [];

  if (cellIndex === 0) {
    classes.push("table-first-cell");
  }

  if (cellIndex === rowLength - 1) {
    classes.push("table-last-cell");
    if (!React.isValidElement(value)) {
      classes.push(`badge ${String(value).toLowerCase().replaceAll(" ", "-")}`);
    }
  }

  return classes.join(" ").trim();
}
