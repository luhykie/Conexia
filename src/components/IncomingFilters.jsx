import React from "react";
import { RefreshCw, Download, Sliders } from "lucide-react";

export function IncomingFilters() {
  return (
    <section className="advanced-filters panel" aria-label="Advanced Filters">
      <header className="panel-header">
        <h2>Advanced Filters</h2>
        <p className="muted">Filter submissions, workflow status, departments, and agreement details to quickly locate records within the institutional repository.</p>
      </header>

      <div className="filter-block">
        <h3>📄 SUBMISSION INFORMATION</h3>

        <div className="form-row">
          <label className="form-label">Document Type</label>
          <div className="form-controls inline-controls">
            <label><input type="radio" name="docType" value="MOA" /> MOA</label>
            <label><input type="radio" name="docType" value="MOU" /> MOU</label>
            <label><input type="radio" name="docType" value="MOF" /> MOF</label>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Collaboration Type</label>
          <div className="form-controls inline-controls">
            <label><input type="radio" name="collab" value="Local" /> Local</label>
            <label><input type="radio" name="collab" value="International" /> International</label>
          </div>
        </div>
      </div>

      <div className="filter-block">
        <h3>🔄 WORKFLOW STATUS</h3>
        <div className="checkbox-grid">
          <label><input type="checkbox" name="status" value="unlogged" /> Unlogged</label>
          <label><input type="checkbox" name="status" value="logged" /> Logged</label>
          <label><input type="checkbox" name="status" value="awaiting" /> Awaiting Completeness Check</label>
          <label><input type="checkbox" name="status" value="ready-legal" /> Ready for Legal Review</label>
          <label><input type="checkbox" name="status" value="returned" /> Returned for Revision</label>
          <label><input type="checkbox" name="status" value="approved" /> Approved</label>
          <label><input type="checkbox" name="status" value="notarized" /> Notarized</label>
        </div>
      </div>

      <div className="filter-block">
        <h3>🏢 DEPARTMENT & PARTNER</h3>
        <div className="form-row">
          <label className="form-label">Department</label>
          <select className="select"><option>All Departments</option><option>School of Education</option><option>College of Law</option></select>
        </div>

        <div className="form-row">
          <label className="form-label">Partner Institution</label>
          <input className="input" type="search" placeholder="🔍 Search institution..." />
        </div>

        <div className="form-row">
          <label className="form-label">Reference ID</label>
          <input className="input" type="text" placeholder="LEX-2024-XXXX" />
        </div>
      </div>

      <div className="filter-block">
        <h3>📋 DOCUMENT COMPLETENESS</h3>
        <div className="checkbox-grid">
          <label><input type="checkbox" name="completeness" value="complete" /> Complete</label>
          <label><input type="checkbox" name="completeness" value="missing" /> Missing Requirements</label>
          <label><input type="checkbox" name="completeness" value="correction" /> Needs Correction</label>
        </div>
      </div>

      <div className="filter-block">
        <h3>⚡ PRIORITY</h3>
        <div className="form-controls inline-controls">
          <label><input type="radio" name="priority" value="urgent" /> Urgent</label>
          <label><input type="radio" name="priority" value="high" /> High</label>
          <label><input type="radio" name="priority" value="normal" /> Normal</label>
          <label><input type="radio" name="priority" value="low" /> Low</label>
        </div>
      </div>

      <div className="filter-block">
        <h3>📅 SUBMISSION DATE</h3>
        <div className="form-row date-range">
          <input type="date" className="input" />
          <span className="range-sep">to</span>
          <input type="date" className="input" />
        </div>
      </div>

      <footer className="filter-actions">
        <button className="btn outline">Reset Filters</button>
        <button className="btn primary">Apply Filters</button>
      </footer>
    </section>
  );
}
