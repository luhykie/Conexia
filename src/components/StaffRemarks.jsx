import React from "react";

export function StaffRemarks({ placeholder = "Add administrative notes..." }) {
  return (
    <div className="staff-remarks">
      <label className="sr-only">Staff Remarks</label>
      <textarea placeholder={placeholder} rows={6}></textarea>
    </div>
  );
}

export default StaffRemarks;
