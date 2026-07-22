import React from "react";
import { CheckCircle2, ClipboardList, FileInput, Gavel } from "lucide-react";

const stats = [
  { value: "12", label: "Unlogged", detail: "+2 since yesterday", icon: FileInput },
  { value: "09", label: "Logged Today", detail: "Target:15", icon: CheckCircle2 },
  { value: "03", label: "Awaiting Check", detail: "Completeness focus", icon: ClipboardList },
  { value: "24", label: "Routed to Legal", detail: "External Review", icon: Gavel, dark: true },
];

// Figma-aligned dashboard KPI card row.
export function DashboardStats() {
  return (
    <div className="iro-stat-grid">
      {stats.map(({ value, label, detail, icon: Icon, dark }) => (
        <article className={`iro-stat-card ${dark ? "dark" : ""}`} key={label}>
          <Icon size={24} />
          <span>{label}</span>
          <strong>{value}</strong>
          <p>{detail}</p>
        </article>
      ))}
    </div>
  );
}
