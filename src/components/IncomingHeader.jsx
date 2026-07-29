import React from "react";
import { Filter } from "lucide-react";

export function IncomingHeader({ onAdvancedFilters }) {
  return (
    <header className="incoming-header">
      <div className="title-block">
        <h1>INCOMING SUBMISSIONS</h1>
        <p className="subtitle">Manage and review incoming partnership documents. Prioritize high-waiting items to maintain departmental KPIs.</p>
      </div>

      <div className="header-actions">
        <button
          className="outline"
          type="button"
          onClick={onAdvancedFilters}
        >
          <Filter size={16} /> Advanced Filters
        </button>
      </div>
    </header>
  );
}
