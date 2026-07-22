import React from "react";
import { Check, FilePlus2, Gavel, RotateCcw } from "lucide-react";

const activities = [
  {
    title: "Submission #84920 Approved",
    detail: "Partner: Horizon Media",
    time: "Today, 10:45 AM",
    tone: "success",
    icon: Check,
  },
  {
    title: "Sent back for Completeness",
    detail: "Ref: #72314-B (Missing Annex C)",
    time: "Today, 09:12 AM",
    tone: "warn",
    icon: RotateCcw,
  },
  {
    title: "Routed to Legal Review",
    detail: "Submission: Vanguard Assets",
    time: "Oct 26, 04:30 PM",
    tone: "success",
    icon: Gavel,
  },
  {
    title: "New Submission Received",
    detail: "Queue: IRO General Log",
    time: "Oct 26, 03:15 PM",
    tone: "info",
    icon: FilePlus2,
  },
];

// Timeline-style recent workflow activity panel.
export function WorkflowActivity() {
  return (
    <aside className="iro-panel iro-activity-panel">
      <header>
        <div>
          <h2>Recent Workflow Activity</h2>
          <p>Real-time status updates</p>
        </div>
      </header>
      <div className="iro-activity-list">
        {activities.map(({ title, detail, time, tone, icon: Icon }) => (
          <article className="iro-activity-item" key={title}>
            <span className={`activity-dot ${tone}`}>
              <Icon size={13} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
              <time>{time}</time>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
