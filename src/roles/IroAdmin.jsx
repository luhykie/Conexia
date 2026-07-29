import React from "react";
import {
  CalendarClock,
  FileCheck2,
  Folder,
  Gauge,
  ShieldCheck,
} from "lucide-react";

import { DataTable } from "../components/DataTable";
import ManageSubmissions from "../components/ManageSubmissions";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { NotificationsView } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { getIroAdminOverview } from "../services/documentService";

export function IroAdmin({ page, account }) {
  if (page === "manage-submissions") return <ManageSubmissions account={account} />;
  if (page === "reassign") return <ReassignSubmissions />;
  if (page === "distribution-lists") return <DistributionLists />;
  if (page === "reports") return <PerformanceReports />;
  if (page === "archive") return <ArchivePage />;
  if (page === "expiry") return <AdminExpiryPage />;
  if (page === "notifications") return <NotificationsView roleKey="admin" />;

  return <IroAdminDashboard />;
}

function useAdminOverview() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getIroAdminOverview());
    } catch (loadError) {
      setError(loadError.message || "Unable to load IRO Admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    window.addEventListener("conexia:workflow-changed", refresh);
    return () =>
      window.removeEventListener("conexia:workflow-changed", refresh);
  }, [refresh]);

  return { data, loading, error, refresh };
}

function DataState({ loading, error, onRetry, children }) {
  if (loading) return <p className="notification-state">Loading current data...</p>;
  if (error) {
    return (
      <div className="notification-state error">
        <p>{error}</p>
        <button className="outline" type="button" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }
  return children;
}

function IroAdminDashboard() {
  const { data, loading, error, refresh } = useAdminOverview();
  const stats = data?.stats;
  const cards = stats
    ? [
        [String(stats.totalSubmissions), "Total Submissions", Folder],
        [String(stats.pendingValidation), "Pending Validation", CalendarClock, "", "warn"],
        [
          stats.averageTurnaroundHours === null
            ? "No data"
            : `${stats.averageTurnaroundHours} hrs`,
          "Completed Turnaround Avg.",
          Gauge,
        ],
        [String(stats.notarizedThisMonth), "Notarized This Month", FileCheck2, "", "dark"],
      ]
    : [];
  const activityRows = (data?.activities || []).map((event) => [
    event.document?.tracking_number || "Unavailable",
    event.document?.partner_institution || "Unavailable",
    event.event_type.replaceAll("_", " "),
    formatDateTime(event.created_at),
    event.to_status,
  ]);

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Office Overview"
        subtitle="Live institutional submission and workflow data."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <StatGrid stats={cards} />
        <Panel title="Recent Workflow Activity">
          {activityRows.length ? (
            <DataTable
              headers={["Tracking #", "Partner", "Event", "Timestamp", "Result"]}
              rows={activityRows}
            />
          ) : (
            <p className="notification-state">No workflow activity has been recorded.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function ReassignSubmissions() {
  const { data, loading, error, refresh } = useAdminOverview();
  const rows = (data?.assignedSubmissions || []).map((document) => [
    document.tracking_number,
    document.partner_institution,
    document.assigned_iro_staff_profile?.full_name ||
      document.assigned_iro_staff_profile?.email ||
      "Profile unavailable",
    document.status,
  ]);

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Reassign Submissions"
        subtitle="Current assigned workload from the database."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <Panel title="Assigned Submissions">
          {rows.length ? (
            <DataTable
              headers={["Tracking #", "Partner", "Current Assignee", "Status"]}
              rows={rows}
            />
          ) : (
            <p className="notification-state">No active assigned submissions.</p>
          )}
        </Panel>
        <Panel title="Active IRO Staff">
          {(data?.activeIroStaff || []).length ? (
            <DataTable
              headers={["Name", "Email"]}
              rows={data.activeIroStaff.map((staff) => [
                staff.full_name || "Name unavailable",
                staff.email,
              ])}
            />
          ) : (
            <p className="notification-state">No active IRO Staff profiles found.</p>
          )}
          <p className="notification-state">
            Reassignment actions will be enabled when the reassignment history API is implemented.
          </p>
        </Panel>
      </DataState>
    </section>
  );
}

function DistributionLists() {
  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Distribution Lists"
        subtitle="Recipients configured for MOA, MOU, and MOF distribution."
      />
      <Panel title="Distribution Recipients">
        <p className="notification-state">
          No distribution-list records are configured. The former prototype recipients were removed.
        </p>
      </Panel>
    </section>
  );
}

function PerformanceReports() {
  const { data, loading, error, refresh } = useAdminOverview();
  const report = data?.reports;
  const stats = report
    ? [
        [String(report.reviewed), "Review Forms Validated", FileCheck2],
        [String(report.returned), "Returned for Corrections", CalendarClock, "", "danger"],
        [String(report.approved), "Approved", ShieldCheck],
        [String(report.notarized), "Notarized", FileCheck2],
      ]
    : [];
  const stageLabels = {
    submissionToLogging: "Submission to logging",
    loggingToValidation: "Logging to validation",
    validationToLegalDecision: "Validation to legal decision",
    approvalToNotarization: "Approval to notarization",
  };

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Institutional Performance Reports"
        subtitle="Metrics calculated from current documents and workflow events."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <StatGrid stats={stats} />
        <Panel title="Average Time per Workflow Stage">
          {Object.entries(report?.averageStageHours || {}).map(([key, hours]) => (
            <div className="bar-row" key={key}>
              <span>{stageLabels[key] || key}</span>
              <b>{hours === null ? "Insufficient data" : `${hours} hours`}</b>
            </div>
          ))}
        </Panel>
        <Panel title="Departmental Breakdown">
          {(report?.departments || []).length ? (
            <DataTable
              headers={["Department", "Total", "Approved", "Returned"]}
              rows={report.departments.map((row) => [
                row.department,
                String(row.total),
                String(row.approved),
                String(row.returned),
              ])}
            />
          ) : (
            <p className="notification-state">No departmental report data available.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function ArchivePage() {
  const { data, loading, error, refresh } = useAdminOverview();
  const rows = (data?.archivedDocuments || []).map((document) => [
    document.tracking_number,
    document.partner_institution,
    document.document_type,
    formatDateTime(document.archived_at),
    document.status,
  ]);

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Records Archive"
        subtitle="Records with persisted archive timestamps."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <Panel title="Archive Records">
          {rows.length ? (
            <DataTable
              headers={["Tracking ID", "Partner", "Type", "Archived At", "Status"]}
              rows={rows}
            />
          ) : (
            <p className="notification-state">No records have been archived.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function AdminExpiryPage() {
  const { data, loading, error, refresh } = useAdminOverview();
  const rows = (data?.expiringDocuments || []).map((document) => [
    document.tracking_number,
    document.partner_institution,
    document.document_type,
    formatDate(document.expiry_date),
    expiryState(document.expiry_date),
  ]);

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Agreement Expiry Tracking"
        subtitle="Documents with persisted expiry dates."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <Panel title="Expiry Records">
          {rows.length ? (
            <DataTable
              headers={["Tracking #", "Partner", "Type", "Expiry Date", "State"]}
              rows={rows}
            />
          ) : (
            <p className="notification-state">No documents have an expiry date.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString();
}

function expiryState(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return "Expires today";
  return `${days} days remaining`;
}

export default IroAdmin;
