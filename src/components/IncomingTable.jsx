import React from "react";
import IncomingRow from "./IncomingRow";

export function IncomingTable({ rows }) {
  return (
    <div className="incoming-table panel-block">
      <table>
        <thead>
          <tr>
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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default IncomingTable;