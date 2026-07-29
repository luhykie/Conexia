import React from "react";
import { ArrowRight } from "lucide-react";

export function QueuePreview({ documents = [], onViewAll }) {
  return (
    <section className="iro-panel iro-queue-panel">
      <header>
        <div>
          <h2>Oldest Unlogged Queue Preview</h2>
          <p>Submitted records waiting for IRO logging</p>
        </div>

        {onViewAll && (
          <button
            className="text-link"
            type="button"
            onClick={onViewAll}
          >
            View All <ArrowRight size={16} />
          </button>
        )}
      </header>

      {documents.length === 0 ? (
        <p className="empty-state">No pending submissions.</p>
      ) : (
        <div className="iro-queue-table">
          <div className="iro-queue-head">
            <span>Tracking # / Partner</span>
            <span>Department</span>
            <span>Age</span>
            <span>Status</span>
          </div>

          {documents.map((document) => {
            const submittedAt = document.submitted_at
              ? new Date(document.submitted_at)
              : null;
            const age = submittedAt
              ? Math.max(
                  0,
                  Math.floor(
                    (Date.now() - submittedAt.getTime()) /
                      86400000
                  )
                )
              : null;

            return (
              <div className="iro-queue-row" key={document.id}>
                <strong>
                  {document.tracking_number || "No tracking number"}
                  <small>
                    {document.partner_institution ||
                      "Partner not provided"}
                  </small>
                </strong>
                <span>
                  {document.departments?.name ||
                    "Department unavailable"}
                </span>
                <time>
                  {age === null
                    ? "Date unavailable"
                    : `${age} ${age === 1 ? "day" : "days"}`}
                </time>
                <span className="queue-badge awaiting">
                  {document.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
