import React from "react";
import {
  FileText,
  LogOut,
  Settings,
} from "lucide-react";
import { getAllowedNavItems } from "../auth/rbac";
import { supabase } from "../supabaseConfig";

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

    let notificationChannel;
    let componentActive = true;

    async function loadUnreadCount() {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        !authData.user ||
        !componentActive
      ) {
        if (authError) {
          console.error(
            "Unable to identify user:",
            authError
          );
        }

        return;
      }

      const { count, error: countError } =
        await supabase
          .from("notifications")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("user_id", authData.user.id)
          .eq("is_read", false);

      if (countError) {
        console.error(
          "Unable to load unread notification count:",
          countError
        );

        return;
      }

      if (componentActive) {
        setUnreadCount(count ?? 0);
      }
    }

    async function subscribeToNotifications() {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        !authData.user ||
        !componentActive
      ) {
        return;
      }

      notificationChannel = supabase
        .channel(
          `sidebar-notifications-${authData.user.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${authData.user.id}`,
          },
          () => {
            loadUnreadCount();
          }
        )
        .subscribe();
    }

    loadUnreadCount();
    subscribeToNotifications();

    return () => {
      componentActive = false;

      if (notificationChannel) {
        supabase.removeChannel(
          notificationChannel
        );
      }
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