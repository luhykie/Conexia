import React from "react";
import { Plus } from "lucide-react";

export function PageTitle({
  title,
  subtitle,
  action,
  onAction,
  actionIcon = <Plus size={18} />,
  actionDisabled = false,
  children,
}) {
  return (
    <header className="page-title">
      <div className="page-title__content">
        <h1>{title}</h1>

        {subtitle && (
          <p>{subtitle}</p>
        )}
      </div>

      <div className="page-title__actions">
        {children}

        {action && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionIcon}
            <span>{action}</span>
          </button>
        )}
      </div>
    </header>
  );
}