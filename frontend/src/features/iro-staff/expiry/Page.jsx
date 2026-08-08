import React from "react";
import {
  AlertCircle,
  Bell,
  CalendarClock,
} from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { StatGrid } from "../../../components/StatGrid";
import { getExpirySummary } from "../../../services/workflowSummaryService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroStaffExpiryPage() {
  const [records, setRecords] = React.useState([]);
  const [stats, setStats] = React.useState({});
  const [meta, setMeta] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [filters, setFilters] = React.useState({
    expiryWindow: "all",
    agreementType: "all",
    partnershipScope: "all",
    department: "all",
    status: "all",
    search: "",
  });

  async function loadExpiry() {
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

      setRecords(response.records ?? response.data?.records ?? []);
      setStats(response.stats ?? response.data?.stats ?? {});
      setMeta(response.meta ?? response.data?.meta ?? null);
    } catch (requestError) {
      reportClientError("Unable to load expiry reminders:", requestError);
      setError(requestError.message);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadExpiry();
  }, [page, filters]);

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
    setPage(1);
  }

  const rows = records.map((record) => [
    record.tracking_number,
    departmentName(record),
    formatDate(record.expiry_date),
    record.expiry || "-",
    statusBadge(record),
    <span key={`action-${record.id}`} className="badge active">
      Remind IRO Admin
    </span>,
  ]);

  return (
    <section className="page iro-staff-page iro-staff-expiry-page">
      <PageTitle
        title="Expiry Reminders"
        subtitle="Monitor renewal timing for IRO Admin follow-up."
      />

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
            value: String(stats.total_expiring_soon ?? 0).padStart(2, "0"),
            label: "Expiring Soon",
            icon: CalendarClock,
            badge: "Monitor",
          },
          {
            value: String(stats.expired ?? 0).padStart(2, "0"),
            label: "Expired",
            icon: AlertCircle,
            badge: "Urgent",
            tone: "danger",
          },
          {
            value: String(stats.urgent_renewals ?? 0).padStart(2, "0"),
            label: "Renewal Follow-up",
            icon: Bell,
            badge: "Reminder",
            tone: "warn",
          },
        ]}
      />

      <ExpiryFilters filters={filters} updateFilter={updateFilter} />

      <Panel title="Reminder-Level Expiry List">
        {loading && <p>Loading expiry reminders...</p>}
        {error && <p className="auth-error">{error}</p>}

        {!loading && !error && records.length === 0 && (
          <p>No expiry reminders are available.</p>
        )}

        {!loading && records.length > 0 && (
          <DataTable
            headers={[
              "Tracking #",
              "Submitting Office",
              "Expiry Date",
              "Timing",
              "Status",
              "Action",
            ]}
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

function departmentName(record) {
  return record.department?.code || record.department?.name || "-";
}

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";
}

function statusBadge(record) {
  return (
    <span
      key={`status-${record.id}`}
      className={`badge ${
        record.classification === "expired"
          ? "danger"
          : record.classification === "expiring_soon"
            ? "pending"
            : "active"
      }`}
    >
      {record.status || "-"}
    </span>
  );
}
