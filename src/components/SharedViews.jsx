import React from "react";
import { ChevronDown, Download, Filter, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "./DataTable";
import { Panel } from "./Panel";
import { PageTitle } from "./PageTitle";
import { StatGrid } from "./StatGrid";
import { dashboardStats, expiryRows, recentActivity } from "../data/mockData";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService";

// Shared dashboard skeleton used by all roles.
export function DashboardView({ roleKey, title, subtitle, action, onAction }) {
  return (
    <section className="page">
      <PageTitle title={title} subtitle={subtitle} action={action} onAction={onAction} />
      <StatGrid stats={dashboardStats[roleKey]} />
      <div className="dashboard-grid">
        <Panel title="Recent Activity">
          <DataTable headers={["Submission ID", "Entity Name", "Type", "Timestamp", "Status"]} rows={recentActivity} />
        </Panel>
        <NotificationCenter />
      </div>
    </section>
  );
}

// Shared notification cards for dashboards.
export function NotificationCenter() {
  const items = [
    ["Validation Required", "Batch #402-A requires urgent validation before the daily cycle cutoff.", "new"],
    ["Task Reassigned", "Submission #IRO-84192 reassigned to Office B.", "info"],
    ["Expiry Alert", "12 files are approaching the 30-day archival threshold.", "warn"],
    ["Report Ready", "Q3 Performance Report is now available.", "ok"],
  ];

  return (
    <Panel title="Notification Center">
      {items.map(([title, detail, tone]) => (
        <div className={`notice ${tone}`} key={title}>
          <b>{title}</b>
          <p>{detail}</p>
          <small>Oct 26, 2023 11:02 AM</small>
        </div>
      ))}
    </Panel>
  );
}

// Shared expiry monitoring table for roles with expiry access.
export function ExpiryView({ title = "Expiry Monitoring", subtitle = "Manage and track agreements nearing expiration.", action }) {
  return (
    <section className="page">
      <PageTitle title={title} subtitle={subtitle} action={action} />
      <StatGrid
        stats={[
          ["18", "Total Expiring Soon", Filter],
          ["5", "Urgent Renewals", Filter, "", "danger"],
          ["12", "Awaiting Dept. Action", Filter],
          ["24", "Renewed (MTD)", Filter],
        ]}
      />
      <Panel title="Urgent Attention (Next 30 Days)" tools={<button className="outline"><Filter size={18} /> Filter</button>}>
        <DataTable headers={["Document Name / ID", "Partner Entity", "Expiry / Days", "Status", "Actions"]} rows={expiryRows} />
      </Panel>
    </section>
  );
}

// Shared notification archive for Department Staff and IRO Admin.
export function NotificationsView({ roleKey }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [markingAll, setMarkingAll] = React.useState(false);

  const loadNotifications = React.useCallback(async () => {
    setError("");
    try {
      const result = await getNotifications();
      setNotifications(result.data ?? []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    window.addEventListener("conexia:workflow-changed", loadNotifications);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("conexia:workflow-changed", loadNotifications);
    };
  }, [loadNotifications]);

  async function openNotification(notification) {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id);
        setNotifications((items) =>
          items.map((item) =>
            item.id === notification.id
              ? { ...item, is_read: true, read_at: new Date().toISOString() }
              : item
          )
        );
        window.dispatchEvent(new CustomEvent("conexia:notifications-changed"));
      }

      if (notification.document_id) {
        const destination = {
          department: "submissions",
          staff: "incoming",
          admin: "manage-submissions",
          legal: "review",
        }[roleKey] || "dashboard";

        navigate(`/app/${destination}?document=${notification.document_id}`);
      }
    } catch (readError) {
      setError(readError.message || "Unable to open notification.");
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError("");
    try {
      await markAllNotificationsRead();
      setNotifications((items) =>
        items.map((item) => ({ ...item, is_read: true }))
      );
      window.dispatchEvent(new CustomEvent("conexia:notifications-changed"));
    } catch (readError) {
      setError(readError.message || "Unable to mark notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <section className="page">
      <PageTitle
        title="Notifications"
        subtitle="Workflow alerts assigned to your authenticated account."
        action="Mark All as Read"
        onAction={markAllRead}
        actionDisabled={markingAll || !notifications.some((item) => !item.is_read)}
      />
      <Panel title="Notification Details">
        {loading && <p className="notification-state">Loading notifications...</p>}
        {!loading && error && (
          <div className="notification-state error">
            <p>{error}</p>
            <button type="button" className="outline" onClick={loadNotifications}>
              Try Again
            </button>
          </div>
        )}
        {!loading && !error && notifications.length === 0 && (
          <p className="notification-state">You have no notifications.</p>
        )}
        {!loading && !error && notifications.length > 0 && (
          <div className="notification-list">
            {notifications.map((notification) => (
              <button
                type="button"
                className={`notification-item ${notification.is_read ? "read" : "unread"}`}
                key={notification.id}
                onClick={() => openNotification(notification)}
              >
                <span className="notification-type">
                  {notification.type.replaceAll("_", " ")}
                </span>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                {notification.document?.tracking_number && (
                  <span className="tracking-number">
                    {notification.document.tracking_number}
                  </span>
                )}
                <time dateTime={notification.created_at}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(notification.created_at))}
                </time>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

// Shared filter strip used by dense list pages.
export function FilterBar({ labels }) {
  return (
    <div className="filter-bar">
      <Filter size={20} />
      {labels.map((label, index) => (
        <button className={index === 0 ? "active-filter" : ""} key={label}>
          {label}
          <ChevronDown size={16} />
        </button>
      ))}
    </div>
  );
}

// Shared upload dropzone used by submission and log/review pages.
export function Dropzone({ label = "Drag and drop file here", detail = "PDF, DOCX up to 25MB" }) {
  return (
    <div className="dropzone">
      <UploadCloud size={42} />
      <b>{label}</b>
      <p>{detail}</p>
    </div>
  );
}

export function ExportButton({ label = "Export" }) {
  return (
    <button className="primary">
      <Download size={18} /> {label}
    </button>
  );
}
