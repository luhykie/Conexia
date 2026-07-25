import React from "react";
import { useNavigate } from "react-router-dom";

function Badge({ children, className = "" }) {
  return (
    <span className={`badge ${className}`}>
      {children}
    </span>
  );
}

export function IncomingRow({ row }) {
  const navigate = useNavigate();

  const partner = row.partner_institution || "Not provided";
  const type = row.document_type || "N/A";
  const department =
    row.departments?.name ||
    row.department_name ||
    row.department_id ||
    "Unknown department";

  const submittedDate = row.submitted_at
    ? new Date(row.submitted_at)
    : null;

  const dateSubmitted = submittedDate
    ? submittedDate.toLocaleDateString()
    : "N/A";

  const daysWaiting = submittedDate
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - submittedDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const typeClass = type
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  function handleStartLogging() {
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
          type="button"
          onClick={handleStartLogging}
        >
          View Details
        </button>

        <button
          className="btn primary small"
          type="button"
          onClick={handleStartLogging}
        >
          Start Logging
        </button>
      </td>
    </tr>
  );
}

export default IncomingRow;