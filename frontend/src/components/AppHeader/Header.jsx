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
  CheckCheck,
  Search,
} from "lucide-react";

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../services/notificationService";
import { reportClientError } from "../../utils/reportClientError";
import "./Header.css";

export function Header({
  account,
}) {
  const panelRef = React.useRef(null);
  const [isNotificationsOpen, setIsNotificationsOpen] =
    React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [processingId, setProcessingId] = React.useState(null);

  const initials = getInitials(
    account?.fullName ||
      account?.name ||
      "User",
  );

  async function loadUnreadCount() {
    try {
      const response = await getUnreadNotificationCount();
      const count =
        response.count ??
        response.unread_count ??
        response.data?.count ??
        response.data?.unread_count ??
        (typeof response.data === "number" ? response.data : undefined) ??
        0;

      setUnreadCount(Number(count) || 0);
    } catch (requestError) {
      reportClientError(
        "Unable to load unread notifications:",
        requestError,
      );
    }
  }

  async function loadNotifications() {
    setLoading(true);
    setError("");

    try {
      const response = await getNotifications({
        page: 1,
        per_page: 8,
      });

      setNotifications(
        response.notifications ??
          response.data ??
          [],
      );
    } catch (requestError) {
      reportClientError(
        "Unable to load notifications:",
        requestError,
      );
      setError(requestError.message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadUnreadCount();
  }, [account?.id]);

  React.useEffect(() => {
    if (isNotificationsOpen) {
      loadNotifications();
    }
  }, [isNotificationsOpen]);

  React.useEffect(() => {
    if (!isNotificationsOpen) return undefined;

    function handlePointerDown(event) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target)
      ) {
        setIsNotificationsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNotificationsOpen]);

  async function markAsRead(notificationId) {
    setProcessingId(notificationId);
    setError("");

    try {
      const response = await markNotificationAsRead(notificationId);
      const updatedNotification = response.notification ?? response.data;
      const readAt = updatedNotification?.read_at || new Date().toISOString();

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                ...updatedNotification,
                is_read: true,
                read_at: readAt,
              }
            : notification,
        ),
      );
      await loadUnreadCount();
    } catch (requestError) {
      reportClientError("Unable to mark notification as read:", requestError);
      setError(requestError.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function markAllAsRead() {
    setProcessingId("all");
    setError("");

    try {
      await markAllNotificationsAsRead();
      const readAt = new Date().toISOString();

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at || readAt,
        })),
      );
      setUnreadCount(0);
    } catch (requestError) {
      reportClientError("Unable to mark all notifications as read:", requestError);
      setError(requestError.message);
    } finally {
      setProcessingId(null);
    }
  }

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

      <div className="cx-header__actions" ref={panelRef}>
        <button
          type="button"
          className="cx-header__icon-button"
          aria-label="Notifications"
          aria-expanded={isNotificationsOpen}
          onClick={() =>
            setIsNotificationsOpen((isOpen) => !isOpen)
          }
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="cx-header__notification-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {isNotificationsOpen && (
          <section className="cx-notification-panel" aria-label="Notifications">
            <header className="cx-notification-panel__header">
              <div>
                <strong>Notification Center</strong>
                <span>{unreadCount} unread</span>
              </div>

              <button
                type="button"
                disabled={unreadCount === 0 || processingId === "all"}
                onClick={markAllAsRead}
              >
                <CheckCheck size={14} />
                {processingId === "all" ? "Updating..." : "Mark all as read"}
              </button>
            </header>

            <div className="cx-notification-panel__body">
              {loading && <p>Loading notifications...</p>}
              {error && <p className="cx-notification-panel__error">{error}</p>}
              {!loading && !error && notifications.length === 0 && (
                <p>No notifications yet.</p>
              )}

              {!loading &&
                !error &&
                notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={`cx-notification-item ${
                      isNotificationRead(notification) ? "is-read" : "is-unread"
                    }`}
                  >
                    <div>
                      <header>
                        <strong>{notification.title}</strong>
                        {!isNotificationRead(notification) && <span>New</span>}
                      </header>

                      <p>{notification.message}</p>

                      <time>
                        {notification.created_at
                          ? new Date(notification.created_at).toLocaleString()
                          : "-"}
                      </time>
                    </div>

                    {!isNotificationRead(notification) && (
                      <button
                        type="button"
                        disabled={processingId === notification.id}
                        onClick={() => markAsRead(notification.id)}
                      >
                        {processingId === notification.id
                          ? "Updating..."
                          : "Mark as read"}
                      </button>
                    )}
                  </article>
                ))}
            </div>
          </section>
        )}

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

function isNotificationRead(notification) {
  return Boolean(notification?.is_read || notification?.read_at);
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
