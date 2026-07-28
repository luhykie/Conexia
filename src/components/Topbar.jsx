import React from "react";
import { Bell, Search } from "lucide-react";

// Shared top navigation with search and role profile context.
export function Topbar({ role, account, onToggleNotifications, onToggleProfile, unreadCount = 0 }) {
  const displayName = account?.fullName || role.user;
  const title = account?.role || role.title;

  return (
    <header className="topbar">
      <div className="search">
        <Search size={18} />
        <input placeholder="Search agreements, partners, or IDs..." />
      </div>
      <button className="topbar-icon" type="button" onClick={onToggleNotifications} aria-label="Notifications">
        <Bell size={18} />
        {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
      </button>
      <button className="profile" type="button" onClick={onToggleProfile}>
        <div>
          {displayName}
          <small>{title}</small>
        </div>
        <div className="avatar">{displayName[0]}</div>
      </button>
    </header>
  );
}
