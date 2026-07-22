import React from "react";
import { ArrowRight } from "lucide-react";

const queueRows = [
  ["Global Logistics Corp", "School of Art and Sciences", "2023-10-24", "Urgent"],
  ["FinTech Solutions", "School of Computer Studies", "2023-10-25", "Pending"],
  ["EcoPower Systems", "School of Engineering", "2023-10-25", "Awaiting"],
  ["BlueWater Shipping", "School of Education", "2023-10-26", "Pending"],
  ["Apex Tech Ltd", "School of Computer Studies", "2023-10-26", "Awaiting"],
];

// Compact queue table showing the oldest unlogged submissions.
export function QueuePreview() {
  return (
    <section className="iro-panel iro-queue-panel">
      <header>
        <div>
          <h2>Oldest Unlogged Queue Preview</h2>
          <p>Priority items pending data entry</p>
        </div>
        <button className="text-link">
          View All <ArrowRight size={16} />
        </button>
      </header>
      <div className="iro-queue-table">
        <div className="iro-queue-head">
          <span>Partner</span>
          <span>Department</span>
          <span>Date Submitted</span>
          <span>Status</span>
        </div>
        {queueRows.map(([partner, department, date, status]) => (
          <div className="iro-queue-row" key={`${partner}-${date}`}>
            <strong>{partner}</strong>
            <span>{department}</span>
            <time>{date}</time>
            <span className={`queue-badge ${status.toLowerCase()}`}>{status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
