import React from "react";

/**
 * Shared content panel.
 *
 * Used by:
 * - Tables
 * - Forms
 * - Dashboard sections
 * - Settings sections
 *
 * Styles:
 * frontend/src/styles/globals.css
 */
export function Panel({
  title,
  subtitle,
  children,
  tools,
  className = "",
  noPadding = false,
}) {
  return (
    <section
      className={[
        "panel",
        noPadding ? "panel--no-padding" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {(title || subtitle || tools) && (
        <header className="panel__header">
          <div className="panel__heading">
            {title && <h2>{title}</h2>}

            {subtitle && <p>{subtitle}</p>}
          </div>

          {tools && (
            <div className="panel__tools">
              {tools}
            </div>
          )}
        </header>
      )}

      <div className="panel__body">
        {children}
      </div>
    </section>
  );
}