import React from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
} from "lucide-react";
import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notificationService";
import { reportClientError } from "../utils/reportClientError";

export function NotificationsPage() {
  const [notifications, setNotifications] =
    React.useState([]);

  const [loading, setLoading] =
    React.useState(true);

  const [error, setError] =
    React.useState("");

  const [processingId, setProcessingId] =
    React.useState(null);
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  async function loadNotifications() {
    setLoading(true);
    setError("");

    try {
      const response = await getNotifications({ page });

      setNotifications(
        response.notifications ??
          response.data ??
          []
      );
      setMeta(response.meta ?? null);
    } catch (requestError) {
      reportClientError(
        "Unable to load notifications:",
        requestError
      );

      setError(requestError.message);
      setNotifications([]);
    }

    setLoading(false);
  }

  React.useEffect(() => {
    loadNotifications();
  }, [page]);

  async function markAsRead(notificationId) {
    setProcessingId(notificationId);
    setError("");

    try {
      const response =
        await markNotificationAsRead(
          notificationId
        );

      const updatedNotification =
        response.notification ??
        response.data;

      const readAt =
        updatedNotification?.read_at ||
        new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                ...updatedNotification,
                is_read: true,
                read_at: readAt,
              }
            : notification
        )
      );
    } catch (requestError) {
      reportClientError(
        "Unable to mark notification as read:",
        requestError
      );

      setError(requestError.message);
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
  }

  async function markAllAsRead() {
    setError("");

    const unreadIds = notifications
      .filter(
        (notification) => !notification.is_read
      )
      .map((notification) => notification.id);

    if (!unreadIds.length) return;

    setProcessingId("all");

    try {
      await markAllNotificationsAsRead();
    } catch (requestError) {
      reportClientError(
        "Unable to mark all notifications as read:",
        requestError
      );

      setError(requestError.message);
      setProcessingId(null);
      return;
    }

    const readAt = new Date().toISOString();

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
        read_at:
          notification.read_at || readAt,
      }))
    );

    setProcessingId(null);
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  return (
    <section className="page notifications-page">
      <PageTitle
        title="Notifications"
        subtitle="View document assignments and workflow updates."
      />

      <Panel
        title={`${unreadCount} Unread Notification${
          unreadCount === 1 ? "" : "s"
        }`}
        tools={
          <button
            type="button"
            className="table-action"
            disabled={
              unreadCount === 0 ||
              processingId === "all"
            }
            onClick={markAllAsRead}
          >
            <CheckCheck size={16} />

            {processingId === "all"
              ? "Updating..."
              : "Mark All as Read"}
          </button>
        }
      >
        {loading && (
          <p>Loading notifications...</p>
        )}

        {error && (
          <p className="auth-error">{error}</p>
        )}

        {!loading &&
          !error &&
          notifications.length === 0 && (
            <p>You have no notifications.</p>
          )}

        {!loading &&
          notifications.length > 0 && (
            <div className="notification-list">
              {notifications.map(
                (notification) => (
                  <article
                    key={notification.id}
                    className={`notification-card ${
                      notification.is_read
                        ? "read"
                        : "unread"
                    }`}
                  >
                    <div className="notification-icon">
                      {notification.is_read ? (
                        <Bell size={20} />
                      ) : (
                        <BellRing size={20} />
                      )}
                    </div>

                    <div className="notification-content">
                      <div className="notification-heading">
                        <h3>
                          {notification.title}
                        </h3>

                        {!notification.is_read && (
                          <span className="badge pending">
                            New
                          </span>
                        )}
                      </div>

                      <p>
                        {notification.message}
                      </p>

                      {notification.documents && (
                        <div className="notification-document">
                          <b>
                            {
                              notification.documents
                                .tracking_number
                            }
                          </b>

                          <span>
                            {
                              notification.documents
                                .title
                            }
                          </span>

                          <span
                            className="badge active"
                          >
                            {
                              notification.documents
                                .status
                            }
                          </span>
                        </div>
                      )}

                      <small>
                        {notification.created_at
                          ? new Date(
                              notification.created_at
                            ).toLocaleString()
                          : "-"}
                      </small>
                    </div>

                    {!notification.is_read && (
                      <button
                        type="button"
                        className="table-action"
                        disabled={
                          processingId ===
                          notification.id
                        }
                        onClick={() =>
                          markAsRead(
                            notification.id
                          )
                        }
                      >
                        {processingId ===
                        notification.id
                          ? "Updating..."
                          : "Mark as Read"}
                      </button>
                    )}
                  </article>
                )
              )}
            </div>
          )}
        {!loading &&
          !error &&
          notifications.length > 0 &&
          meta && (
            <div className="table">
              <footer>
                Showing {meta.from || 0}-{meta.to || 0} of {meta.total} records
                <div>
                  <button
                    disabled={meta.current_page <= 1}
                    onClick={() => setPage(meta.current_page - 1)}
                  >
                    &lt;
                  </button>
                  <button className="active-page">
                    {meta.current_page}
                  </button>
                  <button
                    disabled={meta.current_page >= meta.last_page}
                    onClick={() => setPage(meta.current_page + 1)}
                  >
                    &gt;
                  </button>
                </div>
              </footer>
            </div>
          )}
      </Panel>
    </section>
  );
}
