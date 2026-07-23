import React from "react";
import { RefreshCw, Download, Sliders } from "lucide-react";

import React, { useState } from "react";

export function IncomingFilters({ onApply, onReset, initial = {} }) {
  const [docType, setDocType] = useState(initial.docType || "");
  const [collab, setCollab] = useState(initial.collab || "");
  const [statuses, setStatuses] = useState(initial.statuses || []);
  const [department, setDepartment] = useState(initial.department || "All Departments");
  const [partner, setPartner] = useState(initial.partner || "");
  const [referenceId, setReferenceId] = useState(initial.referenceId || "");
  const [completeness, setCompleteness] = useState(initial.completeness || []);
  const [priority, setPriority] = useState(initial.priority || "");
  const [dateFrom, setDateFrom] = useState(initial.dateFrom || "");
  const [dateTo, setDateTo] = useState(initial.dateTo || "");

  function toggleArray(stateSetter, stateArray, value) {
    if (stateArray.includes(value)) {
      stateSetter(stateArray.filter((v) => v !== value));
    } else {
      stateSetter([...stateArray, value]);
    }
  }

  function handleApply(e) {
    e.preventDefault();
    const filters = { docType, collab, statuses, department, partner, referenceId, completeness, priority, dateFrom, dateTo };
    onApply?.(filters);
  }

  function handleReset(e) {
    e?.preventDefault();
    setDocType("");
    setCollab("");
    setStatuses([]);
    setDepartment("All Departments");
    setPartner("");
    setReferenceId("");
    setCompleteness([]);
    setPriority("");
    setDateFrom("");
    setDateTo("");
    onReset?.();
  }

  return (
    <form className="advanced-filters panel" aria-label="Advanced Filters" onSubmit={handleApply}>
      <header className="panel-header">
        <h2>Advanced Filters</h2>
        <p className="muted">Filter submissions, workflow status, departments, and agreement details to quickly locate records within the institutional repository.</p>
      </header>

      <div className="filter-block">
        <h3>📄 SUBMISSION INFORMATION</h3>

        <div className="form-row">
          <label className="form-label">Document Type</label>
          <div className="form-controls inline-controls">
            <label><input type="radio" name="docType" value="MOA" checked={docType === 'MOA'} onChange={() => setDocType('MOA')} /> MOA</label>
            <label><input type="radio" name="docType" value="MOU" checked={docType === 'MOU'} onChange={() => setDocType('MOU')} /> MOU</label>
            <label><input type="radio" name="docType" value="MOF" checked={docType === 'MOF'} onChange={() => setDocType('MOF')} /> MOF</label>
            <label><input type="radio" name="docType" value="" checked={docType === ''} onChange={() => setDocType('')} /> Any</label>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Collaboration Type</label>
          <div className="form-controls inline-controls">
            <label><input type="radio" name="collab" value="Local" checked={collab === 'Local'} onChange={() => setCollab('Local')} /> Local</label>
            <label><input type="radio" name="collab" value="International" checked={collab === 'International'} onChange={() => setCollab('International')} /> International</label>
            <label><input type="radio" name="collab" value="" checked={collab === ''} onChange={() => setCollab('')} /> Any</label>
          </div>
        </div>
      </div>

      <div className="filter-block">
        <h3>🔄 WORKFLOW STATUS</h3>
        <div className="checkbox-grid">
          <label><input type="checkbox" name="status_unlogged" checked={statuses.includes('unlogged')} onChange={() => toggleArray(setStatuses, statuses, 'unlogged')} /> Unlogged</label>
          <label><input type="checkbox" name="status_logged" checked={statuses.includes('logged')} onChange={() => toggleArray(setStatuses, statuses, 'logged')} /> Logged</label>
          <label><input type="checkbox" name="status_awaiting" checked={statuses.includes('awaiting')} onChange={() => toggleArray(setStatuses, statuses, 'awaiting')} /> Awaiting Completeness Check</label>
          <label><input type="checkbox" name="status_ready" checked={statuses.includes('ready-legal')} onChange={() => toggleArray(setStatuses, statuses, 'ready-legal')} /> Ready for Legal Review</label>
          <label><input type="checkbox" name="status_returned" checked={statuses.includes('returned')} onChange={() => toggleArray(setStatuses, statuses, 'returned')} /> Returned for Revision</label>
          <label><input type="checkbox" name="status_approved" checked={statuses.includes('approved')} onChange={() => toggleArray(setStatuses, statuses, 'approved')} /> Approved</label>
          <label><input type="checkbox" name="status_notarized" checked={statuses.includes('notarized')} onChange={() => toggleArray(setStatuses, statuses, 'notarized')} /> Notarized</label>
        </div>
      </div>

      <div className="filter-block">
        <h3>🏢 DEPARTMENT & PARTNER</h3>
        <div className="form-row">
          <label className="form-label">Department</label>
          <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option>All Departments</option>
            <option>School of Education</option>
            <option>College of Law</option>
            <option>School of Engineering and Architecture</option>
            <option>School of Business and Management</option>
          </select>
        </div>

        <div className="form-row">
          <label className="form-label">Partner Institution</label>
          <input className="input" type="search" placeholder="🔍 Search institution..." value={partner} onChange={(e) => setPartner(e.target.value)} />
        </div>

        <div className="form-row">
          <label className="form-label">Reference ID</label>
          <input className="input" type="text" placeholder="LEX-2024-XXXX" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
        </div>
      </div>

      <div className="filter-block">
        <h3>📋 DOCUMENT COMPLETENESS</h3>
        <div className="checkbox-grid">
          <label><input type="checkbox" name="comp_complete" checked={completeness.includes('complete')} onChange={() => toggleArray(setCompleteness, completeness, 'complete')} /> Complete</label>
          <label><input type="checkbox" name="comp_missing" checked={completeness.includes('missing')} onChange={() => toggleArray(setCompleteness, completeness, 'missing')} /> Missing Requirements</label>
          <label><input type="checkbox" name="comp_correction" checked={completeness.includes('correction')} onChange={() => toggleArray(setCompleteness, completeness, 'correction')} /> Needs Correction</label>
        </div>
      </div>

      <div className="filter-block">
        <h3>⚡ PRIORITY</h3>
        <div className="form-controls inline-controls">
          <label><input type="radio" name="priority" value="urgent" checked={priority === 'urgent'} onChange={() => setPriority('urgent')} /> Urgent</label>
          <label><input type="radio" name="priority" value="high" checked={priority === 'high'} onChange={() => setPriority('high')} /> High</label>
          <label><input type="radio" name="priority" value="normal" checked={priority === 'normal'} onChange={() => setPriority('normal')} /> Normal</label>
          <label><input type="radio" name="priority" value="low" checked={priority === 'low'} onChange={() => setPriority('low')} /> Low</label>
          <label><input type="radio" name="priority" value="" checked={priority === ''} onChange={() => setPriority('')} /> Any</label>
        </div>
      </div>

      <div className="filter-block">
        <h3>📅 SUBMISSION DATE</h3>
        <div className="form-row date-range">
          <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="range-sep">to</span>
          <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <footer className="filter-actions">
        <button className="btn outline" onClick={handleReset} type="button">Reset Filters</button>
        <button className="btn primary" type="submit">Apply Filters</button>
      </footer>
    </form>
  );
}
