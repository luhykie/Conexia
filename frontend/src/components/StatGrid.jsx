import React from "react";

/**
 * Shared dashboard statistics grid.
 *
 * stats format:
 * [
 *   {
 *     value: "124",
 *     label: "Total Users",
 *     icon: Users,
 *     badge: "+12%",
 *     tone: "success"
 *   }
 * ]
 */
export function StatGrid({ stats = [] }) {
  return (
    <section className="stats-grid">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <article
            key={stat.label}
            className={`stat-card ${stat.tone || ""}`}
          >
            <div className="stat-card__top">
              {Icon && (
                <div className="stat-card__icon">
                  <Icon size={24} />
                </div>
              )}

              {stat.badge && (
                <span className="stat-card__badge">
                  {stat.badge}
                </span>
              )}
            </div>

            <strong>{stat.value}</strong>

            <p>{stat.label}</p>
          </article>
        );
      })}
    </section>
  );
}