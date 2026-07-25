import React from "react";

export function RouteDropdown({ value = "iro_admin", onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    >
      <option value="iro_admin">IRO Admin</option>
    </select>
  );
}

export default RouteDropdown;