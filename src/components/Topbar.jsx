import React from "react";
import { Bell, Search } from "lucide-react";
import { getUnreadNotificationCount } from "../services/notificationService";

// Shared top navigation with search and role profile context.
export function Topbar({ role, account, onOpenNotifications }) {
  const displayName = account?.fullName || role.user;
  const title = account?.role || role.title;
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    if (!onOpenNotifications) return undefined;

    let active = true;

    async function refreshCount() {
      try {
        const count = await getUnreadNotificationCount();
        if (active) setUnreadCount(count);
      } catch (error) {
        console.error("Unable to load notification count:", error);
      }
    }

    refreshCount();
    const timer = window.setInterval(refreshCount, 30000);
    window.addEventListener("conexia:workflow-changed", refreshCount);
    window.addEventListener("conexia:notifications-changed", refreshCount);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("conexia:workflow-changed", refreshCount);
      window.removeEventListener("conexia:notifications-changed", refreshCount);
    };
  }, [account?.id]);

  return (
    <header className="topbar">
      <div className="search">
        <Search size={24} />
        <input placeholder="Search tracking ID, partner, or department..." />
      </div>
      {onOpenNotifications && (
        <button
          className="notification-bell"
          type="button"
          aria-label={`${unreadCount} unread notifications`}
          onClick={onOpenNotifications}
        >
          <Bell size={24} />
          {unreadCount > 0 && (
            <span>{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>
      )}
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
