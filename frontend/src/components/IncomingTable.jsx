import React, { useState } from "react";
import IncomingRow from "./IncomingRow";

export function IncomingTable({ rows, roleKey }) {
  const [openingId, setOpeningId] = useState(null);

  return (
    <div className="incoming-table panel-block">
      <table>
        <thead>
          <tr>
            <th>Tracking #</th>
            <th>Department</th>
            <th>Partner</th>
            <th>Type</th>
            <th>Date Submitted</th>
            <th>Days Waiting</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <IncomingRow
              key={row.id}
              row={row}
              roleKey={roleKey}
              opening={openingId === row.id}
              onOpening={() => setOpeningId(row.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default IncomingTable;
