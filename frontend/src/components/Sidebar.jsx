import React from "react";
import {
  FileText,
  LogOut,
  Settings,
} from "lucide-react";
import { getAllowedNavItems } from "../auth/rbac";
import { getUnreadNotificationCount } from "../services/notificationService";
import { reportClientError } from "../utils/reportClientError";

// Role-aware sidebar renders only RBAC-approved links.
export function Sidebar({
  role,
  roleKey,
  page,
  setPage,
  onLogout,
}) {
  const [unreadCount, setUnreadCount] =
    React.useState(0);

  const navigationItems =
    getAllowedNavItems(roleKey);

  const hasNotificationsPage =
    navigationItems.some(
      ([id]) => id === "notifications"
    );

  React.useEffect(() => {
    if (!hasNotificationsPage) {
      setUnreadCount(0);
      return undefined;
    }

    let componentActive = true;

    async function loadUnreadCount() {
      try {
        const response =
          await getUnreadNotificationCount();

        if (componentActive) {
          setUnreadCount(
            response.count ??
              response.data?.count ??
              0
          );
        }
      } catch (requestError) {
        reportClientError(
          "Unable to load unread notification count:",
          requestError
        );
      }
    }

    loadUnreadCount();
    const refreshTimer =
      window.setInterval(loadUnreadCount, 30000);

    return () => {
      componentActive = false;
      window.clearInterval(refreshTimer);
    };
  }, [hasNotificationsPage, roleKey]);

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
        {navigationItems.map(
          ([id, label, Icon]) => (
            <button
              type="button"
              className={
                page === id ? "active" : ""
              }
              onClick={() => setPage(id)}
              key={id}
            >
              <Icon size={23} />

              <span className="sidebar-label">
                {label}
              </span>

              {id === "notifications" &&
                unreadCount > 0 && (
                  <span
                    className="sidebar-notification-badge"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 99
                      ? "99+"
                      : unreadCount}
                  </span>
                )}
            </button>
          )
        )}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={
            page === "settings"
              ? "active"
              : ""
          }
          onClick={() => setPage("settings")}
        >
          <Settings size={22} />
          Settings
        </button>

        <button
          type="button"
          onClick={onLogout}
        >
          <LogOut size={22} />
          Logout
        </button>
      </div>
    </aside>
  );
}
