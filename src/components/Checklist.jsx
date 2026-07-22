import React from "react";

export function Checklist({ items = [] }) {
  return (
    <div className="checklist">
      {items.map((label) => (
        <label className="checkline" key={label}>
          <input type="checkbox" />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export default Checklist;
