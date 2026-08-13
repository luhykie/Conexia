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
export function DashboardView({ roleKey, title, subtitle, action, onAction, refreshKey }) {
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

  const activityRows = (dashboard?.recent_activity ?? []).map((item) => [
    item.tracking_number || "-",
    item.entity_name || item.department?.code || "-",
    item.type || "-",
    formatDateTime(item.timestamp),
    item.status || "-",
  ]);
  const departmentApiUnavailable = roleKey === "department" && Boolean(error);

  return (
    <section className="page">
      <PageTitle title={title} subtitle={subtitle} action={action} onAction={onAction} />
      <StatGrid stats={stats} />
      <div className="dashboard-grid">
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
              headers={["Submission ID", "Entity Name", "Type", "Timestamp", "Status"]}
              rows={activityRows}
            />
          )}
        </Panel>
        <NotificationCenter
          items={dashboard?.notifications ?? []}
          loading={loading}
          error={departmentApiUnavailable ? "" : error}
          offline={departmentApiUnavailable}
        />
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
  const [filters, setFilters] = React.useState({
    expiryWindow: "all",
    agreementType: "all",
    partnershipScope: "all",
    department: "all",
    status: "all",
    search: "",
  });

  React.useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await getExpirySummary({
          page,
          search: filters.search || undefined,
          status: filters.status === "all" ? undefined : filters.status,
          expiry_window:
            filters.expiryWindow === "all" ? undefined : filters.expiryWindow,
          document_type:
            filters.agreementType === "all" ? undefined : filters.agreementType,
          department:
            filters.department === "all" ? undefined : filters.department,
        });

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
  }, [page, filters]);

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
    setPage(1);
  }

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
            className={`expiry-milestone ${milestone.tone} ${
              filters.expiryWindow === milestone.value ? "selected" : ""
            }`}
            key={milestone.label}
            role="button"
            tabIndex={0}
            onClick={() => updateFilter("expiryWindow", milestone.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                updateFilter("expiryWindow", milestone.value);
              }
            }}
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
      <ExpiryFilters filters={filters} updateFilter={updateFilter} />
      <Panel title="Urgent Attention (Next 30 Days)">
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

function ExpiryFilters({ filters, updateFilter }) {
  return (
    <div className="expiry-filter-panel" aria-label="Expiry filters">
      <label>
        Search
        <input
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
          placeholder="Tracking number, partner, or department"
        />
      </label>
      <label>
        Expiry Window
        <select
          value={filters.expiryWindow}
          onChange={(event) => updateFilter("expiryWindow", event.target.value)}
        >
          <option value="all">All</option>
          <option value="120">120 Days</option>
          <option value="90">90 Days</option>
          <option value="60">60 Days</option>
          <option value="30">30 Days</option>
          <option value="expired">Expired</option>
        </select>
      </label>
      <label>
        Agreement Type
        <select
          value={filters.agreementType}
          onChange={(event) => updateFilter("agreementType", event.target.value)}
        >
          <option value="all">All</option>
          <option value="MOA">MOA</option>
          <option value="MOU">MOU</option>
          <option value="MOF">MOF</option>
        </select>
      </label>
      <label>
        Partnership Scope
        <select value={filters.partnershipScope} disabled>
          <option value="all">All</option>
          <option value="Departmental">Departmental</option>
          <option value="Local">Local</option>
          <option value="International">International</option>
        </select>
      </label>
      <label>
        Office / Department
        <select
          value={filters.department}
          onChange={(event) => updateFilter("department", event.target.value)}
        >
          <option value="all">All</option>
          <option value="SCS">SCS</option>
          <option value="SEA">SEA</option>
          <option value="SBM">SBM</option>
          <option value="SAS">SAS</option>
          <option value="SAMS">SAMS</option>
          <option value="SED">SED</option>
          <option value="SOL">SOL</option>
          <option value="ETEEAP">ETEEAP</option>
        </select>
      </label>
      <label>
        Status
        <select
          value={filters.status}
          onChange={(event) => updateFilter("status", event.target.value)}
        >
          <option value="all">All</option>
          <option value="Active">Active</option>
          <option value="Renewal Required">Renewal Required</option>
          <option value="Renewed">Renewed</option>
          <option value="Expired">Expired</option>
        </select>
      </label>
    </div>
  );
}

const expiryMilestones = [
  {
    label: "120 Days",
    detail: "Early watch",
    tone: "early",
    value: "120",
  },
  {
    label: "90 Days",
    detail: "Review window",
    tone: "review",
    value: "90",
  },
  {
    label: "60 Days",
    detail: "Renewal prep",
    tone: "prep",
    value: "60",
  },
  {
    label: "30 Days",
    detail: "Urgent action",
    tone: "urgent",
    value: "30",
  },
  {
    label: "Expired",
    detail: "Overdue",
    tone: "expired",
    value: "expired",
  },
];

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
export function Dropzone({
  label = "Drag and drop file here",
  detail = "PDF, DOCX up to 25MB",
  selectedFile = null,
  disabled = false,
  onFileSelect,
  onRemove,
}) {
  const inputRef = React.useRef(null);
  const canPickFile = typeof onFileSelect === "function";

  function chooseFile(file) {
    if (!file || disabled || !canPickFile) return;
    onFileSelect(file);
  }

  function handleDrop(event) {
    if (!canPickFile) return;

    event.preventDefault();
    chooseFile(event.dataTransfer.files?.[0]);
  }

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
            accept=".pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
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

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024 * 1024) {
    return `${Math.max(bytes / 1024, 1).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ExportButton({ label = "Export" }) {
  return (
    <button className="primary">
      <Download size={18} /> {label}
    </button>
  );
}
