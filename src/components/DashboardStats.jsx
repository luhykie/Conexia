import React from "react";
import { CheckCircle2, ClipboardList, FileInput, Gavel } from "lucide-react";

// Figma-aligned dashboard KPI card row.
export function DashboardStats({ stats = {}, onCardClick }) {
  const cards = [
    {
      value: stats.incoming ?? 0,
      label: "Unlogged",
      detail: "+2 since yesterday",
      icon: FileInput,
    },
    {
      value: stats.loggedToday ?? 0,
      label: "Logged Today",
      detail: "+1 since yesterday",
      icon: CheckCircle2,
    },
    {
      value: stats.awaitingCheck ?? 0,
      label: "Awaiting Check",
      detail: "Completeness focus",
      icon: ClipboardList,
    },
    {
      value: stats.routedToLegal ?? 0,
      label: "Routed to Legal",
      detail: "External Review",
      icon: Gavel,
      dark: true,
    },
  ];

  return (
    <div className="iro-stat-grid">
      {cards.map(({ value, label, detail, icon: Icon, dark }) => (
        <article
          key={label}
          className={`iro-stat-card ${dark ? "dark" : ""}`}
          onClick={() => onCardClick?.(label)}
          style={{ cursor: "pointer" }}
        >
          <Icon size={24} />
          <span>{label}</span>
          <strong>{value}</strong>
          <p>{detail}</p>
        </article>
      ))}
    </div>
  );
}