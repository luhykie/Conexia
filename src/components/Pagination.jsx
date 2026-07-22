import React from "react";

export function Pagination() {
  return (
    <div className="pagination">
      <div className="results-summary">Showing 1–5 of 428 results</div>
      <nav className="page-controls">
        <button className="page-btn">&lt;</button>
        <button className="page-btn active">1</button>
        <button className="page-btn">2</button>
        <button className="page-btn">3</button>
        <span className="dots">...</span>
        <button className="page-btn">86</button>
        <button className="page-btn">&gt;</button>
      </nav>
    </div>
  );
}

export default Pagination;
