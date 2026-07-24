import React from "react";
import { Filter } from "lucide-react";

// IRO Staff dashboard greeting and primary actions.
export function DashboardHeader() {
  return (
    <header className="iro-dashboard-header">
      <div className="title-block">
        <h1>Good Morning, Chendy.</h1>
        <p>Here is your operational overview for today. You have 12 unlogged items requiring immediate attention.</p>
      </div>
      <div className="iro-dashboard-actions">
        <button className="outline">
          <Filter size={18} /> Advanced Filters
        </button>
      </div>
    </header>
  );
}
