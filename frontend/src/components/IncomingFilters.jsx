import React from "react";
import { RefreshCw, Download, Search } from "lucide-react";

export function IncomingFilters({
  searchTerm,
  onSearchChange,
  department,
  onDepartmentChange,
  departments,
  partner,
  onPartnerChange,
  partners,
  documentType,
  onDocumentTypeChange,
  documentTypes,
  onRefresh,
  refreshing,
  onExport,
  canExport,
}) {
  return (
    <div className="incoming-filters">
      <div className="filters-left">
        <label className="incoming-search">
          <Search size={17} />
          <input
            id="incoming-search"
            type="search"
            value={searchTerm}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Search tracking number, partner, or department..."
          />
        </label>

        <select
          aria-label="Department"
          className="select"
          value={department}
          onChange={(event) =>
            onDepartmentChange(event.target.value)
          }
        >
          <option value="All">All Departments</option>
          {departments.map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          aria-label="Partner"
          className="select"
          value={partner}
          onChange={(event) =>
            onPartnerChange(event.target.value)
          }
        >
          <option value="All">All Partners</option>
          {partners.map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          aria-label="Submission Type"
          className="select"
          value={documentType}
          onChange={(event) =>
            onDocumentTypeChange(event.target.value)
          }
        >
          <option value="All">All Types</option>
          {documentTypes.map((type) => (
            <option value={type} key={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="filters-right">
        <button
          className="btn ghost"
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={16} />
          {refreshing ? "Refreshing..." : "Refresh Queue"}
        </button>
        <button
          className="btn outline"
          type="button"
          onClick={onExport}
          disabled={!canExport}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>
    </div>
  );
}
