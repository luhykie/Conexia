import React from "react";
import { FileInput, ClipboardList, Gavel } from "lucide-react";

// Compact workflow summary chips for Incoming Submissions list
export default function IncomingSummary({ stats = {} }) {
  const { incoming = 0, awaitingCheck = 0, routedToLegal = 0 } = stats;

  return (
    <div className="incoming-summary" role="region" aria-label="Incoming workflow summary">
      <div className="chip" title="Unlogged submissions">
        <span className="icon" aria-hidden>
          <FileInput size={16} />
        </span>
        <span className="label">Unlogged</span>
        <span className="value" aria-live="polite">{incoming}</span>
      </div>

      <div className="chip" title="Awaiting completeness check">
        <span className="icon" aria-hidden>
          <ClipboardList size={16} />
        </span>
        <span className="label">Awaiting Check</span>
        <span className="value" aria-live="polite">{awaitingCheck}</span>
      </div>

      <div className="chip" title="Routed to legal review">
        <span className="icon" aria-hidden>
          <Gavel size={16} />
        </span>
        <span className="label">Routed to Legal</span>
        <span className="value" aria-live="polite">{routedToLegal}</span>
      </div>
    </div>
  );
}
