import React from "react";
import { RefreshCw, Download, Sliders } from "lucide-react";

export function IncomingFilters() {
  return (
    <div className="incoming-filters">
      <div className="filters-left">
        <button className="icon-btn"><Sliders size={18} /></button>

        <select aria-label="Department" className="select">
          <option>All Departments</option>
          <option>School of Education</option>
          <option>School of Law</option>
          <option>School of Engineering and Architecture</option>
          <option>School of Business and Management</option>
          <option>School of Arts and Sciences</option>
          <option>School of Allied and Medical Sciences</option>
          <option>Expanded Tertiary Education Equivalency and Accreditation Program</option>
        </select>

        <select aria-label="Partner" className="select">
          <option>All Partners</option>
          <option>Global Relief Initiative</option>
          <option>Vertex Logistics Corp.</option>
        </select>

        <select aria-label="Submission Type" className="select">
          <option>All Types</option>
          <option>MOA</option>
          <option>MOU</option>
          <option>MOF</option>
        </select>
      </div>

      <div className="filters-right">
        <button className="btn ghost"><RefreshCw size={16} /> Refresh Queue</button>
        <button className="btn outline"><Download size={16} /> Export CSV</button>
      </div>
    </div>
  );
}
