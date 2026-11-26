// [FEATURE: Shared/Utility] - provides shared application infrastructure and reusable interface behavior.
import React from "react";
import {
  CalendarClock,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Folder,
  Gauge,
  Gavel,
  Grid2X2,
  Eye,
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
import {
  getExpirySummary,
  requestDocumentRenewal,
} from "../services/workflowSummaryService";
import { reportClientError } from "../utils/reportClientError";
import { departmentStatusBadgeClass } from "../utils/departmentStatus";
import {
  documentTableFilterDefinitions,
  documentTableHeaders,
  documentTableValues,
  iroDocumentTableFilterDefinitions,
} from "../utils/documentTable";

const dashboardLoaders = {
  // Shared dashboard loaders ni for Department and Legal; each role gets its own API summary.
  department: getDepartmentDashboard,
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
    ["pending_archival", "Pending Archival", FileCheck2, "Approved"],
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
export function DashboardView({
  roleKey,
  title,
  subtitle,
  action,
  onAction,
  refreshKey,
  className = "",
  hideNotifications = false,
  onViewDocument,
}) {
  // Shared dashboard view ni; Department shows tracking activity, while Legal shows review workload.
  const [dashboard, setDashboard] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;

    // Loads dashboard within the shared application infrastructure and reusable interface behavior workflow.
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
  }, [roleKey, refreshKey]);

  const stats = dashboardCards[roleKey].map(
    ([key, label, Icon, tag, tone]) => ({
      value: formatCount(dashboard?.stats?.[key] ?? 0),
      label,
      icon: Icon,
      badge: tag,
      tone,
    }),
  );

  const documentDashboard = ["department", "admin", "legal"].includes(roleKey);
  const activityRows = (dashboard?.recent_activity ?? []).map((item) =>
    documentDashboard
      ? [
          ...documentTableValues(item),
          roleKey === "admin"
            ? item.status || "—"
            : <span className={departmentStatusBadgeClass(item.status)}>
                {item.status || "—"}
              </span>,
          <button
            type="button"
            className={roleKey === "admin"
              ? "iro-dashboard-view-action"
              : "table-action table-action--icon"}
            key={`view-${item.id || item.tracking_number}`}
            aria-label={roleKey === "admin"
              ? `View ${item.tracking_number || "document"}`
              : "View Submission"}
            title={roleKey === "admin" ? "View document" : "View Submission"}
            onClick={() => onViewDocument?.(item)}
          >
            <Eye size={roleKey === "department" ? 18 : 16} aria-hidden="true" />
          </button>,
        ]
      : [
          item.tracking_number || "-",
          ...(roleKey === "admin" ? [item.title || "-"] : [item.entity_name || item.department?.code || "-"]),
          item.type || "-",
          formatDateTime(item.timestamp),
          item.status || "-",
        ],
  );
  const departmentApiUnavailable = roleKey === "department" && Boolean(error);

  return (
    <section className={["page", className].filter(Boolean).join(" ")}>
      <PageTitle title={title} subtitle={subtitle} action={action} onAction={onAction} />
      <StatGrid stats={stats} />
      <div className={`dashboard-grid${hideNotifications ? " dashboard-grid--single" : ""}`}>
        <Panel title="Recent Activity">
          {loading && <p>Loading dashboard activity...</p>}
          {departmentApiUnavailable && (
            <p className="dashboard-offline-message">
              Dashboard activity will appear when the local API is connected. You can still start a new submission and preview a selected document.
            </p>
          )}
          {error && !departmentApiUnavailable && <p className="auth-error">{error}</p>}
          {!loading && !error && activityRows.length === 0 && (
            <p>No recent activity is available.</p>
          )}
          {!loading && !error && activityRows.length > 0 && (
            <DataTable
              headers={documentDashboard
                ? [...documentTableHeaders, "Action"]
                : [
                    "Submission ID",
                    "Entity Name",
                    "Type",
                    "Timestamp",
                    "Status",
                  ]}
              rows={activityRows}
              columnClasses={roleKey === "admin"
                ? [
                    "iro-dashboard-column--tracking",
                    "",
                    "",
                    "iro-dashboard-column--partner",
                    "iro-dashboard-column--center",
                    "iro-dashboard-column--center",
                    "iro-dashboard-column--center iro-dashboard-column--status",
                    "iro-dashboard-column--center iro-dashboard-column--action",
                  ]
                : []}
              statusColumnIndex={roleKey === "admin" ? 6 : undefined}
              filterDefinitions={documentDashboard
                ? roleKey === "admin"
                  ? iroDocumentTableFilterDefinitions
                  : documentTableFilterDefinitions
                : undefined}
            />
          )}
        </Panel>
        {!hideNotifications && (
          <NotificationCenter
            items={dashboard?.notifications ?? []}
            loading={loading}
            error={departmentApiUnavailable ? "" : error}
            offline={departmentApiUnavailable}
          />
        )}
      </div>
    </section>
  );
}

// Shared notification cards for dashboards.
export function NotificationCenter({ items = [], loading = false, error = "", offline = false }) {
  return (
    <Panel title="Notification Center">
      {loading && <p>Loading notifications...</p>}
      {offline && <p className="dashboard-offline-message">Notifications will appear when the local API is connected.</p>}
      {error && <p className="auth-error">{error}</p>}
      {!loading && !error && !offline && items.length === 0 && (
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

// Formats count within the shared application infrastructure and reusable interface behavior workflow.
function formatCount(value) {
  return String(Number(value) || 0).padStart(2, "0");
}

// Formats date time within the shared application infrastructure and reusable interface behavior workflow.
function formatDateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString();
}

// Shared expiry monitoring table for roles with expiry access.
export function ExpiryView({
  title = "Expiry Monitoring",
  subtitle = "Manage and track agreements nearing expiration.",
  action,
  documentNameHeader = "Document Name / ID",
}) {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [processingId, setProcessingId] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    // Loads the operation within the shared application infrastructure and reusable interface behavior workflow.
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

  // Coordinates renewal within the shared application infrastructure and reusable interface behavior workflow.
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
    ...documentTableValues(record),
    record.status || "—",
    record.expiry || "—",
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
      <Panel title="Urgent Attention (Next 30 Days)">
        {loading && <p>Loading expiry records...</p>}
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        {!loading && !error && rows.length === 0 && (
          <p>No expiry records are available.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={[...documentTableHeaders, "Expiry / Days", "Actions"]}
            rows={rows}
            meta={meta}
            onPageChange={setPage}
            statusColumnIndex={6}
            filterDefinitions={[
              {
                columnIndex: 1,
                label: documentNameHeader,
                getValue: (row) => row[1] === "—" ? row[0] : row[1],
              },
              { columnIndex: 3, label: "Partner Entity" },
              { columnIndex: 7, label: "Expiry / Days" },
              { columnIndex: 6, label: "Status" },
            ]}
          />
        )}
      </Panel>
    </section>
  );
}


// Shared upload dropzone used by submission and log/review pages.
export function Dropzone({
  label = "Drag and drop file here",
  detail = "PDF, DOCX up to 25MB",
  accept = ".pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text",
  selectedFile = null,
  disabled = false,
  onFileSelect,
  onRemove,
}) {
  const inputRef = React.useRef(null);
  const canPickFile = typeof onFileSelect === "function";

  // Coordinates file within the shared application infrastructure and reusable interface behavior workflow.
  function chooseFile(file) {
    if (!file || disabled || !canPickFile) return;
    onFileSelect(file);
  }

  // Handles drop within the shared application infrastructure and reusable interface behavior workflow.
  function handleDrop(event) {
    if (!canPickFile) return;

    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0]);
  }

  // Handles drag over within the shared application infrastructure and reusable interface behavior workflow.
  function handleDragOver(event) {
    if (canPickFile) {
      event.preventDefault();
    }
  }

  return (
    <div
      className={`dropzone ${canPickFile ? "dropzone--interactive" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <UploadCloud size={42} />
      <b>{selectedFile?.name || label}</b>
      {canPickFile && !selectedFile && <span>or</span>}
      {canPickFile && (
        <>
          <input
            ref={inputRef}
            className="visually-hidden-file"
            type="file"
            accept={accept}
            disabled={disabled}
            onChange={(event) =>
              chooseFile(event.target.files?.[0])
            }
          />
          <button
            type="button"
            className="outline"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {selectedFile ? "Replace file" : "Browse files"}
          </button>
        </>
      )}
      <p>{selectedFile ? formatFileSize(selectedFile.size) : detail}</p>
      {selectedFile && onRemove && (
        <button
          type="button"
          className="table-action"
          disabled={disabled}
          onClick={onRemove}
        >
          Remove
        </button>
      )}
    </div>
  );
}

// Formats file size within the shared application infrastructure and reusable interface behavior workflow.
function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024 * 1024) {
    return `${Math.max(bytes / 1024, 1).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Coordinates button within the shared application infrastructure and reusable interface behavior workflow.
export function ExportButton({ label = "Export" }) {
  return (
    <button className="primary">
      <Download size={18} /> {label}
    </button>
  );
}
