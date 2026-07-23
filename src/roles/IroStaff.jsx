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
import LogReviewPage from "../components/LogReviewPage";
import { useNavigate, useLocation } from "react-router-dom";


// Routes all IRO Staff pages through one role-owned component.
export function IroStaff({ page }) {
  if (page === "incoming") return <IncomingSubmissions />;
  if (page === "log-review") return <LogReview />;
  if (page === "status") return <StatusTracker />;
  if (page === "expiry")
    return (
      <ExpiryView
        title="Global Expiry List"
        action="Bulk Notify Offices"
      />
    );

  if (page === "notifications") return <NotificationsView />;

  // Default page = Dashboard
  return <IroStaffDashboard />;
}

function IroStaffDashboard() {
  const navigate = useNavigate();

  const stats = {
    incoming: 12,
    loggedToday: 9,
    awaitingCheck: 3,
    routedToLegal: 24,
  };

  function handleCardClick(label){
    switch (label) {
      case "Unlogged":
        navigate("/app/incoming");
        break;

      case "Logged Today":
        navigate("/app/log-review");
        break;

      case "Awaiting Check":
        // Navigate to Log & Review and request filter for awaiting completeness check
        navigate("/app/log-review", { state: { filterStatus: "awaiting" } });
        break;

      case "Routed to Legal":
        // Navigate to Status Tracker and request filter for routed items
        navigate("/app/status", { state: { filterStatus: "routed" } });
        break;

      default:
        break;
    }
  }

  return (
    <section className="page iro-staff-dashboard">
      <DashboardHeader />

      <DashboardStats stats={stats}
      onCardClick={handleCardClick}/>

      <div className="iro-dashboard-grid">
        <QueuePreview />
        <WorkflowActivity />
      </div>
    </section>
  );
}

// Gives IRO Staff a document preview plus administrative completeness checklist.
function LogReview() {
  return <LogReviewPage />;
}

// Tracks submission stage history from receipt through legal review.
function StatusTracker() {
  const location = useLocation();
  const filterStatus = location?.state?.filterStatus || null;

  const items = [
    { id: "CTX-9902", name: "Pacific Global University", time: "2d 14h", status: "routed", complete: true },
    { id: "CTX-9884", name: "Nautical Research Institute", time: "14h 22m", status: "under-review", complete: false },
    { id: "CTX-9871", name: "Vanguard Medical College", time: "5d 02h", status: "routed", complete: true },
  ];

  const visible = filterStatus ? items.filter((i) => {
    if (filterStatus === "routed") return i.status === "routed";
    return true;
  }) : items;

  return (
    <section className="page split-page iro-staff-page">
      <div>
        <PageTitle title="Submission Progression" subtitle="Real-time status of active institutional agreements." />
        {visible.map(({ id, name, time, complete }) => (
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
