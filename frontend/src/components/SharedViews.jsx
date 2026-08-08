import React from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Folder,
  Gauge,
  Gavel,
  Grid2X2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { DataTable } from "./DataTable";
import { Panel } from "./Panel";
import { PageTitle } from "./PageTitle";
import { StatGrid } from "./StatGrid";
import {
  getDepartmentDashboard,
  getIroDashboard,
  getLegalDashboard,
} from "../services/dashboardService";
import { getNotifications } from "../services/notificationService";
import {
  getExpirySummary,
  requestDocumentRenewal,
} from "../services/workflowSummaryService";
import { reportClientError } from "../utils/reportClientError";

const dashboardLoaders = {
  department: getDepartmentDashboard,
  staff: getIroDashboard,
  admin: getIroDashboard,
  legal: getLegalDashboard,
};

const dashboardCards = {
  department: [
    ["active_submissions", "Active Submissions", Grid2X2, "Own Office"],
    [
      "pending_corrections",
      "Pending Corrections",
      CalendarClock,
      "Requires Action",
      "warn",
    ],
    ["approved_documents", "Approved", ShieldCheck],
    ["notarized_documents", "Notarized", Gavel],
  ],
  staff: [
    ["incoming_submissions", "Unlogged", CalendarClock, "Needs Action"],
    ["under_review", "Under Review", CheckCircle2],
    ["pending_notarization", "Awaiting Check", ClipboardCheck],
    ["assigned_to_legal", "Routed To Legal", Gavel],
  ],
  admin: [
    ["total_submissions", "Total Submissions", Folder],
    [
      "incoming_submissions",
      "Pending Validation",
      CalendarClock,
      "Review Required",
      "warn",
    ],
    ["under_review", "Under Review", Gauge, "Active"],
    ["completed", "Completed", FileCheck2, "Workflow"],
  ],
  legal: [
    [
      "pending_legal_reviews",
      "Pending Review",
      CalendarClock,
      "Priority",
      "warn",
    ],
    [
      "pending_notarization",
      "Pending Notarization",
      Gavel,
      "Staged",
      "blue",
    ],
    ["approved", "Approved", ShieldCheck, "Complete"],
    [
      "corrections_needed",
      "Corrections Sent",
      FileText,
      "Action Req",
      "danger",
    ],
  ],
};

// Shared dashboard skeleton used by all roles.
export function DashboardView({ roleKey, title, subtitle, action }) {
  const [dashboard, setDashboard] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const response = await dashboardLoaders[roleKey]();
        const loadedDashboard =
          response.dashboard ??
          response.data?.dashboard ??
          response.data ??
          {};

        if (active) {
          setDashboard(loadedDashboard);
        }
      } catch (requestError) {
        reportClientError("Unable to load dashboard:", requestError);

        if (active) {
          setError(requestError.message);
          setDashboard(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [roleKey]);

  const stats = dashboardCards[roleKey].map(
    ([key, label, Icon, tag, tone]) => ({
      value: formatCount(dashboard?.stats?.[key] ?? 0),
      label,
      icon: Icon,
      badge: tag,
      tone,
    }),
  );

  const activityRows = (dashboard?.recent_activity ?? []).map((item) => [
    item.tracking_number || "-",
    item.entity_name || item.department?.code || "-",
    item.type || "-",
    formatDateTime(item.timestamp),
    item.status || "-",
  ]);

  return (
    <section className="page">
      <PageTitle title={title} subtitle={subtitle} action={action} />
      <StatGrid stats={stats} />
      <div className="dashboard-grid">
        <Panel title="Recent Activity">
          {loading && <p>Loading dashboard activity...</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && !error && activityRows.length === 0 && (
            <p>No recent activity is available.</p>
          )}
          {!loading && !error && activityRows.length > 0 && (
            <DataTable
              headers={["Submission ID", "Entity Name", "Type", "Timestamp", "Status"]}
              rows={activityRows}
            />
          )}
        </Panel>
        <NotificationCenter
          items={dashboard?.notifications ?? []}
          loading={loading}
          error={error}
        />
      </div>
    </section>
  );
}

// Shared notification cards for dashboards.
export function NotificationCenter({ items = [], loading = false, error = "" }) {
  return (
    <Panel title="Notification Center">
      {loading && <p>Loading notifications...</p>}
      {error && <p className="auth-error">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p>No dashboard notifications are available.</p>
      )}
      {!loading && !error && items.map((item) => (
        <div className={`notice ${item.tone || "info"}`} key={`${item.title}-${item.timestamp}`}>
          <b>{item.title}</b>
          <p>{item.detail}</p>
          <small>{formatDateTime(item.timestamp)}</small>
        </div>
      ))}
    </Panel>
  );
}

function formatCount(value) {
  return String(Number(value) || 0).padStart(2, "0");
}

function formatDateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString();
}

// Shared expiry monitoring table for roles with expiry access.
export function ExpiryView({ title = "Expiry Monitoring", subtitle = "Manage and track agreements nearing expiration.", action }) {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [processingId, setProcessingId] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await getExpirySummary({ page });

        if (active) {
          setSummary(response.data ?? {});
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load expiry records:", requestError);

        if (active) {
          setError(requestError.message);
          setSummary(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [page]);

  async function requestRenewal(record) {
    if (!record?.id) return;

    setProcessingId(record.id);
    setError("");
    setSuccess("");

    try {
      await requestDocumentRenewal(record.id);
      setSuccess("Renewal request recorded.");
      const response = await getExpirySummary({ page });
      setSummary(response.data ?? {});
      setMeta(response.meta ?? null);
    } catch (requestError) {
      reportClientError("Unable to request renewal:", requestError);
      setError(requestError.message);
    } finally {
      setProcessingId(null);
    }
  }

  const stats = summary?.stats ?? {};
  const rows = (summary?.records ?? []).map((record) => [
    record.document_name || record.tracking_number || "-",
    record.partner_institution || "-",
    record.expiry || "-",
    record.status || "-",
    record.action === "Initiate Renewal" ? (
      <button
        type="button"
        className="table-action"
        disabled={
          processingId === record.id ||
          record.renewal_status === "renewal_requested"
        }
        onClick={() => requestRenewal(record)}
      >
        {processingId === record.id
          ? "Requesting..."
          : record.renewal_status === "renewal_requested"
            ? "Renewal Requested"
            : "Initiate Renewal"}
      </button>
    ) : (
      record.action || "-"
    ),
  ]);

  return (
    <section className="page expiry-page">
      <PageTitle title={title} subtitle={subtitle} action={action} />
      <div className="expiry-milestone-strip" aria-label="Expiry reminder windows">
        {expiryMilestones.map((milestone) => (
          <span
            className={`expiry-milestone ${milestone.tone}`}
            key={milestone.label}
          >
            <strong>{milestone.label}</strong>
            <small>{milestone.detail}</small>
          </span>
        ))}
      </div>
      <StatGrid
        stats={[
          {
            value: formatCount(stats.total_expiring_soon),
            label: "Total Expiring Soon",
            icon: Filter,
          },
          {
            value: formatCount(stats.urgent_renewals),
            label: "Urgent Renewals",
            icon: Filter,
            tone: "danger",
          },
          {
            value: formatCount(stats.awaiting_department_action),
            label: "Awaiting Dept. Action",
            icon: Filter,
          },
          {
            value: formatCount(stats.renewed_month_to_date),
            label: "Renewed (MTD)",
            icon: Filter,
          },
        ]}
      />
      <Panel title="Urgent Attention (Next 30 Days)" tools={<button className="outline"><Filter size={18} /> Filter</button>}>
        {loading && <p>Loading expiry records...</p>}
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        {!loading && !error && rows.length === 0 && (
          <p>No expiry records are available.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={["Document Name / ID", "Partner Entity", "Expiry / Days", "Status", "Actions"]}
            rows={rows}
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>
    </section>
  );
}

const expiryMilestones = [
  {
    label: "120 Days",
    detail: "Early watch",
    tone: "early",
  },
  {
    label: "90 Days",
    detail: "Review window",
    tone: "review",
  },
  {
    label: "60 Days",
    detail: "Renewal prep",
    tone: "prep",
  },
  {
    label: "30 Days",
    detail: "Urgent action",
    tone: "urgent",
  },
  {
    label: "Expired",
    detail: "Overdue",
    tone: "expired",
  },
];

// Shared notification archive for Department Staff and IRO Admin.
export function NotificationsView() {
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    async function loadNotifications() {
      setLoading(true);
      setError("");

      try {
        const response = await getNotifications({ page });

        if (active) {
          setNotifications(
            response.notifications ?? response.data ?? [],
          );
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load notifications:", requestError);

        if (active) {
          setError(requestError.message);
          setNotifications([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadNotifications();

    return () => {
      active = false;
    };
  }, [page]);

  const rows = notifications.map((notification) => [
    notification.notification_type || "-",
    notification.message || notification.title || "-",
    formatDateTime(notification.created_at),
  ]);

  return (
    <section className="page">
      <PageTitle title="Notifications Archive" subtitle="Detailed chronological record of all alerts and submission updates." action="Mark All as Read" />
      <FilterBar labels={["All", "Submissions", "System", "Security", "Oct 01 - Oct 24"]} />
      <Panel title="Notification Details">
        {loading && <p>Loading notifications...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p>No notifications are available.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={["Type", "Notification Details", "Timestamp"]}
            rows={rows}
            meta={meta}
            onPageChange={setPage}
          />
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
