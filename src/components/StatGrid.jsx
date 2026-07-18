import React from "react";

// Reusable dashboard stat card grid.
export function StatGrid({ stats, onCardClick }) {
  return (
    <div className="stats-grid">
      {stats.map(([value, label, Icon, tag, tone]) => {
        const handleClick = onCardClick ? () => onCardClick(label) : undefined;

        return (
          <article
            className={`stat-card ${tone || ""} ${onCardClick ? "clickable" : ""}`}
            key={label}
            onClick={handleClick}
            role={onCardClick ? "button" : undefined}
            tabIndex={onCardClick ? 0 : undefined}
            onKeyDown={onCardClick
              ? (event) => {
                  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                    event.preventDefault();
                    handleClick();
                  }
                }
              : undefined}
          >
            <Icon size={34} />
            {tag && <span>{tag}</span>}
            <strong>{value}</strong>
            <p>{label}</p>
          </article>
        );
      })}
    </div>
  );
}
