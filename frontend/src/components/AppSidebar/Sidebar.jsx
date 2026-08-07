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
  LayoutDashboard,
  Users,
  Shield,
  Building2,
  MonitorCog,
  ScrollText,
  Settings,
  LogOut,
} from "lucide-react";

import "./Sidebar.css";

const superAdminItems = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/app/dashboard",
  },
  {
    key: "users",
    label: "User Management",
    icon: Users,
    to: "/app/users",
  },
  {
    key: "roles",
    label: "Role Management",
    icon: Shield,
    to: "/app/roles",
  },
  {
    key: "departments",
    label: "Department Management",
    icon: Building2,
    to: "/app/departments",
  },
  {
    key: "monitoring",
    label: "System Monitoring",
    icon: MonitorCog,
    to: "/app/monitoring",
  },
  {
    key: "audit",
    label: "Audit Logs",
    icon: ScrollText,
    to: "/app/audit",
  },
  {
    key: "settings",
    label: "System Settings",
    icon: Settings,
    to: "/app/settings",
  },
];

export function Sidebar({
  roleKey,
  onLogout,
}) {
  const items =
    roleKey === "super"
      ? superAdminItems
      : [];

  return (
    <aside className="cx-sidebar">
      <div className="cx-sidebar__brand">
        <div className="cx-sidebar__brand-mark">
          C
        </div>

        <div>
          <strong>CONEXIA</strong>
          <span>Partnership Management</span>
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