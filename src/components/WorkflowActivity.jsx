import React from "react";
import {
  Check,
  FilePlus2,
  Gavel,
  RotateCcw,
  ClipboardCheck,
} from "lucide-react";

const EVENT_DISPLAY = {
  document_submitted: {
    title: "New Submission Received",
    tone: "info",
    icon: FilePlus2,
  },
  document_logged: {
    title: "Document Logged",
    tone: "success",
    icon: ClipboardCheck,
  },
  routed_to_legal: {
    title: "Routed to Legal Review",
    tone: "success",
    icon: Gavel,
  },
  legal_approved: {
    title: "Approved by Legal Counsel",
    tone: "success",
    icon: Check,
  },
  corrections_requested: {
    title: "Corrections Requested",
    tone: "warn",
    icon: RotateCcw,
  },
};

export function WorkflowActivity({ activities = [] }) {
  return (
    <aside className="iro-panel iro-activity-panel">
      <header>
        <div>
          <h2>Recent Workflow Activity</h2>
          <p>Persisted document status events</p>
        </div>
      </header>

      {activities.length === 0 ? (
        <p className="empty-state">No workflow activity yet.</p>
      ) : (
        <div className="iro-activity-list">
          {activities.map((activity) => {
            const display =
              EVENT_DISPLAY[activity.event_type] ||
              EVENT_DISPLAY.document_submitted;
            const Icon = display.icon;

            return (
              <article
                className="iro-activity-item"
                key={activity.id}
              >
                <span className={`activity-dot ${display.tone}`}>
                  <Icon size={13} />
                </span>
                <div>
                  <h3>{display.title}</h3>
                  <p>
                    {activity.document?.tracking_number ||
                      "Document"}{" "}
                    —{" "}
                    {activity.document?.partner_institution ||
                      "Partner unavailable"}
                  </p>
                  <time>
                    {activity.created_at
                      ? new Date(
                          activity.created_at
                        ).toLocaleString()
                      : "Time unavailable"}
                  </time>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}
