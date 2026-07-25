import React from "react";
import { useNavigate } from "react-router-dom";

function Badge({ children, className = "" }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function IncomingRow({ row }) {
  const navigate = useNavigate();

  // Data from Supabase
  const department = row.departments?.name || "N/A";
  const partner = row.partner_institution;
  const type = row.document_type;

  // Format submitted date
  const submittedDate = new Date(row.submitted_at);
  const dateSubmitted = submittedDate.toLocaleDateString();

  // Compute days waiting
  const daysWaiting = Math.floor(
    (new Date() - submittedDate) / (1000 * 60 * 60 * 24)
  );

  const typeClass = type
    ? type.toLowerCase().replace(/[^a-z0-9]+/g, "")
    : "";

  function handleStartLogging() {
    navigate("/app/log-review", {
      state: {
        documentId: row.id,
      },
    });
  }

  function handleViewDetails() {
    navigate("/app/log-review", {
      state: {
        documentId: row.id,
      },
    });
  }

  return (
    <tr>
      <td className="dept-cell">
        <span className="dot" aria-hidden="true" />
        {department}
      </td>

      <td>{partner}</td>

      <td>
        <Badge className={`doc-type ${typeClass}`}>
          {type}
        </Badge>
      </td>

      <td>{dateSubmitted}</td>

      <td>
        <Badge
          className={
            daysWaiting > 7
              ? "danger"
              : daysWaiting > 3
              ? "warn"
              : ""
          }
        >
          {daysWaiting} Days
        </Badge>
      </td>

      <td className="actions">
        <button
          className="btn small"
          onClick={handleViewDetails}
        >
          View Details
        </button>

        <button
          className="btn primary small"
          onClick={handleStartLogging}
        >
          Start Logging
        </button>
      </td>
    </tr>
  );
}

export default IncomingRow;