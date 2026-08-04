import React from "react";
import { FileText, LogOut, Settings } from "lucide-react";
import { getAllowedNavItems } from "../auth/rbac";

// Role-aware sidebar renders only RBAC-approved links.
export function Sidebar({ role, roleKey, page, setPage, onLogout }) {
  const hidesNotificationLink = ["staff", "admin"].includes(roleKey);
  const hidesInactiveSettings = ["staff", "admin"].includes(roleKey);
  const navigationItems = getAllowedNavItems(roleKey).filter(
    ([id]) => !(hidesNotificationLink && id === "notifications")
  );

  return (
    <aside className="sidebar">
      <div className="brand-mark">
        <div className="seal">
          <FileText size={34} />
        </div>
        <h1>CONEXIA</h1>
        <p>{role.theme}</p>
      </div>
      <nav>
        {navigationItems.map(([id, label, Icon]) => (
          <button type="button" className={page === id ? "active" : ""} onClick={() => setPage(id)} key={id}>
            <Icon size={23} /> {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        {!hidesInactiveSettings && (
          <button type="button">
            <Settings size={22} /> Settings
          </button>
        )}
        <button type="button" onClick={onLogout}>
          <LogOut size={22} /> Logout
        </button>
      </div>
    </aside>
  );
}
