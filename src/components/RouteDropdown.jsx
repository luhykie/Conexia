import React from "react";

export function RouteDropdown({ value = "Legal Counsel" }) {
  return (
    <div className="route-dropdown">
      <label className="sr-only">Route To</label>
      <select defaultValue={value} className="select">
        <option>IRO Admin</option>
        <option>Compliance</option>
        <option>Finance</option>
        <option>Department Staff</option>
      </select>
    </div>
  );
}

export default RouteDropdown;
