/**
 * Component: Application Header
 *
 * Responsibility:
 * - Shows page context
 * - Shows notifications
 * - Shows authenticated account summary
 *
 * Styles:
 * ./Header.css
 */

import React from "react";
import {
  Bell,
  ChevronDown,
  Search,
} from "lucide-react";

import "./Header.css";

export function Header({
  account,
}) {
  const initials = getInitials(
    account?.fullName ||
      account?.name ||
      "User",
  );

  return (
    <header className="cx-header">
      <div className="cx-header__search">
        <Search size={18} />

        <input
          type="search"
          placeholder="Search CONEXIA"
          aria-label="Search CONEXIA"
        />
      </div>

      <div className="cx-header__actions">
        <button
          type="button"
          className="cx-header__icon-button"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span />
        </button>

        <button
          type="button"
          className="cx-header__profile"
        >
          <span className="cx-header__avatar">
            {initials}
          </span>

          <span className="cx-header__profile-copy">
            <strong>
              {account?.fullName ||
                account?.name ||
                "CONEXIA User"}
            </strong>

            <small>
              {formatRole(
                account?.role,
                account?.roleKey,
              )}
            </small>
          </span>

          <ChevronDown size={17} />
        </button>
      </div>
    </header>
  );
}

function getInitials(name) {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatRole(role, roleKey) {
  if (roleKey === "admin") {
    return "IRO Admin";
  }

  if (roleKey === "staff") {
    return "IRO Staff";
  }

  if (roleKey === "legal") {
    return "Legal Counsel";
  }

  if (roleKey === "super") {
    return "Super Admin";
  }

  if (!role) {
    return "User";
  }

  return role
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}
