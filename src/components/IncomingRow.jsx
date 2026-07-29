import React from "react";
import { useNavigate } from "react-router-dom";

function Badge({ children, className = "" }) {
  return (
    <span className={`badge ${className}`}>
      {children}
    </span>
  );
}

export function IncomingRow({
  row,
  roleKey,
  opening,
  onOpening,
}) {
  const navigate = useNavigate();

  const partner = row.partner_institution || "Not provided";
  const type = row.document_type || "N/A";
  const department =
    row.department?.name ||
    row.departments?.name ||
    row.department_name ||
    row.department_id ||
    "Unknown department";

  const submittedDate = row.submitted_at
    ? new Date(row.submitted_at)
    : null;

  const validSubmittedDate =
    submittedDate &&
    !Number.isNaN(submittedDate.getTime());

  const dateSubmitted = validSubmittedDate
    ? submittedDate.toLocaleDateString()
    : "Not available";

  const daysWaiting = validSubmittedDate
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - submittedDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const typeClass = type
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  function handleStartLogging() {
    onOpening?.();
    navigate("/app/log-review", {
      state: {
        documentId: row.id,
      },
    });
  }

  return (
    <tr>
      <td className="tracking-cell">
        {row.tracking_number || "Not available"}
      </td>

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
            daysWaiting !== null && daysWaiting > 7
              ? "danger"
              : daysWaiting !== null && daysWaiting > 3
                ? "warn"
                : ""
          }
        >
          {daysWaiting === null
            ? "Not available"
            : `${daysWaiting} ${
                daysWaiting === 1 ? "Day" : "Days"
              }`}
        </Badge>
      </td>

      <td className="actions">
        {["staff", "admin"].includes(roleKey) ? (
          <>
            <button
              className="btn small"
              type="button"
              onClick={handleStartLogging}
              disabled={opening}
            >
              View Details
            </button>

            <button
              className="btn primary small"
              type="button"
              onClick={handleStartLogging}
              disabled={opening}
            >
              {opening ? "Opening..." : "Start Logging"}
            </button>
          </>
        ) : (
          <span className="muted-text">IRO Staff action</span>
        )}
      </td>
    </tr>
  );
}

export default IncomingRow;
