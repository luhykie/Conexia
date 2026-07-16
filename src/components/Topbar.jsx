import React from "react";
import { Bell, Search, Settings } from "lucide-react";

// Shared top navigation with search and role profile context.
export function Topbar({ role, account }) {
  const displayName = account?.fullName || role.user;
  const title = account?.role || role.title;

  return (
    <header className="topbar">
      <div className="search">
        <Search size={24} />
        <input placeholder="Search tracking ID, partner, or department..." />
      </div>
      <Bell size={24} />
      <Settings size={24} />
      <div className="profile">
        <div>
          {displayName}
          <small>{title}</small>
        </div>
        <div className="avatar">{displayName[0]}</div>
      </div>
    </header>
  );
}
