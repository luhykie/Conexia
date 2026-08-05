import React from "react";

export function StaffRemarks({
  placeholder = "Add administrative notes...",
  value = "",
  onChange,
  disabled = false,
}) {
  return (
    <div className="staff-remarks">
      <label className="sr-only">Staff Remarks</label>
      <textarea
        placeholder={placeholder}
        rows={6}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

export default StaffRemarks;
