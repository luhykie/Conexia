import React from "react";
import { Download, FileText, Folder } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { DashboardHeader } from "../components/DashboardHeader";
import { DashboardStats } from "../components/DashboardStats";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { Dropzone, ExpiryView, ExportButton, FilterBar, NotificationsView } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { QueuePreview } from "../components/QueuePreview";
import { WorkflowActivity } from "../components/WorkflowActivity";
import IncomingSubmissions from "../components/IncomingSubmissions";
import { incomingRows } from "../data/mockData";

// Routes all IRO Staff pages through one role-owned component.
export function IroStaff({ page }) {
  if (page === "incoming") return <IncomingSubmissions />;
  if (page === "log-review") return <LogReview />;
  if (page === "status") return <StatusTracker />;
  if (page === "expiry") return <ExpiryView title="Global Expiry List" action="Bulk Notify Offices" />;
  if (page === "notifications") return <NotificationsView />;

  return <IroStaffDashboard />;
}

function IroStaffDashboard() {
  return (
    <section className="page iro-staff-dashboard">
      <DashboardHeader />
      <DashboardStats />
      <div className="iro-dashboard-grid">
        <QueuePreview />
        <WorkflowActivity />
      </div>
    </section>
  );
}

// IncomingSubmissions moved to components/IncomingSubmissions.jsx

import LogReviewPage from "../components/LogReviewPage";

// Gives IRO Staff a document preview plus administrative completeness checklist.
function LogReview() {
  return <LogReviewPage />;
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
