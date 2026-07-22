import React from "react";

function Badge({ children, className = "" }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function IncomingRow({ row }) {
  const { department, partner, type, dateSubmitted, daysWaiting } = row;
  const typeClass = type ? type.toLowerCase().replace(/[^a-z0-9]+/g, "") : ""; // moa, mou, mof -> classes

  return (
    <tr>
      <td className="dept-cell"><span className="dot" aria-hidden="true" />{department}</td>
      <td>{partner}</td>
      <td><Badge className={`doc-type ${typeClass}`}>{type}</Badge></td>
      <td>{dateSubmitted}</td>
      <td><Badge className={daysWaiting > 7 ? "danger" : daysWaiting > 3 ? "warn" : ""}>{daysWaiting} Days</Badge></td>
      <td className="actions">
        <button className="btn small">View Details</button>
        <button className="btn primary small">Start Logging</button>
      </td>
    </tr>
  );
}

export default IncomingRow;
