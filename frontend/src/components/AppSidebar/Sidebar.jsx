/**
 * Component: Application Sidebar
 *
 * Responsibility:
 * - Shows role-specific navigation
 * - Marks the active page
 * - Handles navigation only
 *
 * Styles:
 * ./Sidebar.css
 */

import React from "react";
import { NavLink } from "react-router-dom";
import {
  Settings,
  LogOut,
} from "lucide-react";

import { getAllowedNavItems } from "../../auth/rbac";
import { roles } from "../../data/roles";
import "./Sidebar.css";

export function Sidebar({
  roleKey,
  onLogout,
}) {
  const role = roles[roleKey] || roles.department;
  const items = getAllowedNavItems(roleKey).map(
    ([key, label, Icon]) => ({
      key,
      label,
      icon: Icon,
      to: `/app/${key}`,
    }),
  );

  if (!items.some((item) => item.key === "settings")) {
    items.push({
      key: "settings",
      label: "Settings",
      icon: Settings,
      to: "/app/settings",
    });
  }

  return (
    <aside className="cx-sidebar">
      <div className="cx-sidebar__brand">
        <div className="cx-sidebar__brand-mark">
          C
        </div>

        <div>
          <strong>CONEXIA</strong>
          <span>{role.theme}</span>
        </div>
      </div>

      <nav className="cx-sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) =>
                [
                  "cx-sidebar__link",
                  isActive
                    ? "cx-sidebar__link--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <button
        type="button"
        className="cx-sidebar__logout"
        onClick={onLogout}
      >
        <LogOut size={19} />
        Logout
      </button>
    </aside>
  );
}
