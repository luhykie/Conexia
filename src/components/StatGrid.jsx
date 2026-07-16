import React from "react";

// Reusable dashboard stat card grid.
export function StatGrid({ stats }) {
  return (
    <div className="stats-grid">
      {stats.map(([value, label, Icon, tag, tone]) => (
        <article className={`stat-card ${tone || ""}`} key={label}>
          <Icon size={34} />
          {tag && <span>{tag}</span>}
          <strong>{value}</strong>
          <p>{label}</p>
        </article>
      ))}
    </div>
  );
}
