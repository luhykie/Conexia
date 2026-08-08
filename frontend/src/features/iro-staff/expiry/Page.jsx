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

  async function loadExpiry() {
    setLoading(true);
    setError("");

    try {
      const response = await getExpirySummary({ page });

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
  }, [page]);

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
