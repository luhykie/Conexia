import React from "react";
import { CheckCircle2, Clock3, Download, FileText, Folder, Gauge } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { DashboardView, Dropzone, ExpiryView, ExportButton, FilterBar } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { incomingRows } from "../data/mockData";

// Routes all IRO Staff pages through one role-owned component.
export function IroStaff({ page }) {
  if (page === "incoming") return <IncomingSubmissions />;
  if (page === "log-review") return <LogReview />;
  if (page === "status") return <StatusTracker />;
  if (page === "expiry") return <ExpiryView title="Global Expiry List" action="Bulk Notify Offices" />;

  return (
    <DashboardView
      roleKey="staff"
      title="Dashboard Overview"
      subtitle="Real-time tracking of institutional relations workflow."
      action="Process Now"
    />
  );
}

// Shows all newly received submissions requiring IRO Staff processing.
function IncomingSubmissions() {
  return (
    <section className="page iro-staff-page">
      <PageTitle title="Incoming Queue" subtitle="Receive, filter, and export department submissions." />
      <StatGrid stats={[
        ["42", "Total Pending", Folder, "+12 New"],
        ["18", "Under Review", FileText, "Avg 2.4d", "warn"],
      ]} />
      <FilterBar labels={["All Departments", "College of Law", "Engineering", "Business School", "Medicine"]} />
      <Panel title="Active Submissions" tools={<ExportButton label="Export CSV" />}>
        <DataTable headers={["Tracking #", "Department", "Document Type", "Date Submitted", "Status"]} rows={incomingRows} />
      </Panel>
    </section>
  );
}

// Gives IRO Staff a document preview plus administrative completeness checklist.
function LogReview() {
  return (
    <section className="page iro-staff-page">
      <PageTitle title="Log & Review Form" subtitle="Verify incoming submission data before routing to Legal." action="Mark as Logged" />
      <div className="two-col">
        <div>
          <Panel title="Document Preview: DRAFT_MOA_V2.1.PDF">
            <div className="doc-preview">
              <h3>MEMORANDUM OF AGREEMENT</h3>
              <p>Standard Institutional Template v4.0</p>
              <p>KNOW ALL MEN BY THESE PRESENTS:</p>
              <p>This Agreement made and entered into this 24th day of October 2023 by and between the Department of Institutional Relations and Global Logistics Solutions Inc.</p>
            </div>
          </Panel>
        </div>
        <aside className="review-sidebar">
          <h2>Completeness Check</h2>
          {["Partner Details Verified", "Signatory Identified", "Standard Template Used"].map((item) => (
            <label className="checkline" key={item}><input type="checkbox" /> {item}</label>
          ))}
          <label>Internal Staff Notes<textarea placeholder="Any initial observations for the reviewer..." /></label>
          <Panel title="Routing & Automation">
            <button className="primary wide-inline">Auto-Generate Review Form</button>
            <Dropzone label="Attach supporting document" detail="Optional supporting PDF or DOCX" />
          </Panel>
        </aside>
      </div>
    </section>
  );
}

// Tracks submission stage history from receipt through legal review.
function StatusTracker() {
  return (
    <section className="page split-page iro-staff-page">
      <div>
        <PageTitle title="Submission Progression" subtitle="Real-time status of active institutional agreements." />
        {[
          ["CTX-9902", "Pacific Global University", "2d 14h", true],
          ["CTX-9884", "Nautical Research Institute", "14h 22m", false],
          ["CTX-9871", "Vanguard Medical College", "5d 02h", true],
        ].map(([id, name, time, complete]) => (
          <article className="status-card" key={id}>
            <span className="badge active">ID: {id}</span>
            <h2>{name}</h2>
            <div className="progress-steps">
              <span className="done">Submitted</span>
              <span className="done">Logged</span>
              <span className={complete ? "done" : ""}>Under Review</span>
            </div>
            <footer><span>MOA (Institutional)</span><span>Engineering Dept.</span><b>Time in Current Status {time}</b></footer>
          </article>
        ))}
      </div>
      <aside className="detail-drawer">
        <h2>Audit Trail</h2>
        {["Status Changed to Under Review", "Logged & Verified", "Initial Submission"].map((entry) => (
          <div className="timeline-item" key={entry}>
            <b>{entry}</b>
            <p>Submission lifecycle event recorded for export and audit.</p>
            <small>OCT 14, 11:30</small>
          </div>
        ))}
        <button className="primary wide-inline"><Download size={18} /> Generate Export Log</button>
      </aside>
    </section>
  );
}
