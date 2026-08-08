import React from "react";
import { RefreshCw, Search } from "lucide-react";

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
}) {
  return (
    <div className="incoming-filters" role="search" aria-label="Incoming submission filters">
      <div className="filters-left">
        <label className="incoming-search">
          <span className="sr-only">Search incoming submissions</span>
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

        <label className="incoming-filter-field department-filter">
          <span className="sr-only">Department</span>
          <select className="select" value={department} onChange={(event) => onDepartmentChange(event.target.value)}>
            <option value="All">All Departments</option>
            {departments.map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
        </label>

        <label className="incoming-filter-field partner-filter">
          <span className="sr-only">Partner</span>
          <select className="select" value={partner} onChange={(event) => onPartnerChange(event.target.value)}>
            <option value="All">All Partners</option>
            {partners.map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
        </label>

        <label className="incoming-filter-field type-filter">
          <span className="sr-only">Document type</span>
          <select className="select" value={documentType} onChange={(event) => onDocumentTypeChange(event.target.value)}>
            <option value="All">All Types</option>
            {documentTypes.map((type) => <option value={type} key={type}>{type}</option>)}
          </select>
        </label>
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
      </div>
    </div>
  );
}
