import React from "react";
import { Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getUnreadNotificationCount } from "../services/notificationService";

// Shared top navigation with search and role profile context.
export function Topbar({ role, roleKey, account, onOpenNotifications }) {
  const navigate = useNavigate();
  const displayName = account?.fullName || role.user;
  const title = account?.role || role.title;
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [documentSearch, setDocumentSearch] = React.useState("");

  function handleDocumentSearch(event) {
    event.preventDefault();
    const query = documentSearch.trim();
    const destination = roleKey === "admin"
      ? "/app/manage-submissions"
      : "/app/incoming";
    navigate(
      query
        ? `${destination}?search=${encodeURIComponent(query)}`
        : destination
    );
  }

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
      {["staff", "admin"].includes(roleKey) && (
        <form
          className="search topbar-search"
          role="search"
          onSubmit={handleDocumentSearch}
        >
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor={`${roleKey}-document-search`}>
            Search documents
          </label>
          <input
            id={`${roleKey}-document-search`}
            type="search"
            value={documentSearch}
            onChange={(event) => setDocumentSearch(event.target.value)}
            placeholder="Search documents..."
          />
        </form>
      )}
      <div className="topbar-spacer" aria-hidden="true" />
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
