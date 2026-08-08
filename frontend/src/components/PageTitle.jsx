import React from "react";
import { Plus } from "lucide-react";

// Shared page heading with an optional action button.
export function PageTitle({
  title,
  subtitle,
  action,
  onAction,
  actionDisabled = false,
  actionIcon: ActionIcon = Plus,
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && (
        <button
          className="primary"
          onClick={onAction}
          type="button"
          disabled={actionDisabled}
        >
          <ActionIcon size={20} aria-hidden="true" /> {action}
        </button>
      )}
    </div>
  );
}
