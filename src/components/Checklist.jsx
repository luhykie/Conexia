import React from "react";

export function Checklist({
  items = [],
  values = {},
  onChange,
  disabled = false,
}) {
  return (
    <div className="checklist">
      {items.map((item) => (
        <label className="checkline" key={item.key || item}>
          <input
            type="checkbox"
            checked={Boolean(values[item.key || item])}
            onChange={() => onChange?.(item.key || item)}
            disabled={disabled}
          />
          <span>{item.label || item}</span>
        </label>
      ))}
    </div>
  );
}

export default Checklist;
