import React from "react";
import { Plus } from "lucide-react";

// Shared page heading with an optional action button.
export function PageTitle({ title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && (
        <button className="primary">
          <Plus size={20} /> {action}
        </button>
      )}
    </div>
  );
}
