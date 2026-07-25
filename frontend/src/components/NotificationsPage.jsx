import React from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
} from "lucide-react";
import { supabase } from "../supabaseConfig";
import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";

export function NotificationsPage() {
  const [notifications, setNotifications] =
    React.useState([]);

  const [loading, setLoading] =
    React.useState(true);

  const [error, setError] =
    React.useState("");

  const [processingId, setProcessingId] =
    React.useState(null);

  async function loadNotifications() {
    setLoading(true);
    setError("");

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError(
        authError?.message ||
          "Unable to identify the signed-in user."
      );

      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data, error: queryError } =
      await supabase
        .from("notifications")
        .select(`
          id,
          title,
          message,
          notification_type,
          is_read,
          created_at,
          read_at,
          document_id,
          documents (
            tracking_number,
            title,
            status
          )
        `)
        .eq("user_id", authData.user.id)
        .order("created_at", {
          ascending: false,
        });

    if (queryError) {
      console.error(
        "Unable to load notifications:",
        queryError
      );

      setError(queryError.message);
      setNotifications([]);
    } else {
      setNotifications(data ?? []);
    }

    setLoading(false);
  }

  React.useEffect(() => {
    loadNotifications();
  }, []);

  async function markAsRead(notificationId) {
    setProcessingId(notificationId);
    setError("");

    const readAt = new Date().toISOString();

    const { error: updateError } =
      await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: readAt,
        })
        .eq("id", notificationId)
        .eq("is_read", false);

    if (updateError) {
      console.error(
        "Unable to mark notification as read:",
        updateError
      );

      setError(updateError.message);
      setProcessingId(null);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              is_read: true,
              read_at: readAt,
            }
          : notification
      )
    );

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

    const readAt = new Date().toISOString();

    const { error: updateError } =
      await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: readAt,
        })
        .in("id", unreadIds);

    if (updateError) {
      console.error(
        "Unable to mark all notifications as read:",
        updateError
      );

      setError(updateError.message);
      setProcessingId(null);
      return;
    }

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
      </Panel>
    </section>
  );
}