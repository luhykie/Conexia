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
  Archive,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  FileText,
  Folder,
  Gauge,
  Gavel,
  Handshake,
  History,
  LayoutDashboard,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  LogOut,
} from "lucide-react";

import conexiaLogo from "../../assets/conexia-logo.png";
import "./Sidebar.css";

export function Sidebar({
  roleKey,
  onLogout,
}) {
  const roleTheme =
    roleKey === "super"
      ? "SUPER ADMIN"
      : roleKey === "admin"
        ? "IRO ADMIN"
        : roleKey === "staff"
          ? "IRO STAFF PORTAL"
          : roleKey === "legal"
            ? "LEGAL COUNSEL"
            : "Institutional Repository";
  const navMap = {
    department: [
      ["dashboard", "Dashboard", LayoutDashboard],
      ["submission", "Submission", FilePlus2],
      ["submissions", "My Submissions", FileText],
      ["engagements", "Engagements", Handshake],
      ["expiry", "Expiry", CalendarClock],
    ],
    staff: [
      ["dashboard", "Dashboard", LayoutDashboard],
      ["incoming", "Incoming Submissions", Folder],
      ["status", "Status Tracker", Gauge],
      ["expiry", "Expiry", CalendarClock],
    ],
    admin: [
      ["dashboard", "Dashboard", LayoutDashboard],
      ["log-review", "Log & Review Form", FileText],
      ["validation", "Validation Queue", ClipboardCheck],
      ["reassign", "Reassign Submissions", RefreshCw],
      ["reports", "Performance Reports", Gauge],
      ["archive", "Archive", Archive],
      ["engagements", "Engagements", Handshake],
      ["expiry", "Expiry", CalendarClock],
    ],
    legal: [
      ["dashboard", "Dashboard", LayoutDashboard],
      ["review", "Review Queue", ClipboardCheck],
      ["notarization", "Notarization Tracker", FileText],
      ["expiry", "Expiry", CalendarClock],
      ["history", "My Action History", History],
    ],
    super: [
      ["dashboard", "Dashboard", LayoutDashboard],
      ["users", "User Management", Users],
      ["roles", "Role Management", Shield],
      ["departments", "Department Management", Building2],
      ["monitoring", "System Monitoring", Gauge],
      ["audit", "Audit Logs", ClipboardCheck],
    ],
  };

  const items = (navMap[roleKey] || navMap.department).map(
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
          <img src={conexiaLogo} alt="CONEXIA" />
        </div>

        <div>
          <strong>CONEXIA</strong>
          <span>{roleTheme}</span>
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
