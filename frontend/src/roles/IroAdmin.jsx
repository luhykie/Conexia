import React from "react";
import { Archive, CalendarClock, CheckCircle2, FileCheck2, Info, RefreshCw, Shield } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { DashboardView, Dropzone, ExpiryView, ExportButton, FilterBar, NotificationsView } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import {
  getArchiveSummary,
  getReportSummary,
} from "../services/workflowSummaryService";
import { reportClientError } from "../utils/reportClientError";

// Routes all IRO Admin pages through one role-owned component.
export function IroAdmin({ page }) {
  if (page === "log-review") return <LogReviewForm />;
  if (page === "validation") return <ValidationQueue />;
  if (page === "reassign") return <ReassignSubmissions />;
  if (page === "reports") return <PerformanceReports />;
  if (page === "archive") return <ArchivePage />;
  if (page === "engagements") return <EngagementsPage />;
  if (page === "expiry") return <ExpiryView title="Agreement Expiry Tracking" action="Apply Filters" />;
  if (page === "notifications") return <NotificationsView />;

  return (
    <DashboardView
      roleKey="admin"
      title="Office Overview"
      subtitle="Real-time status of institutional document submissions and office throughput."
      action="New Submission"
    />
  );
}

// Registers agreement metadata before routing the case to the next office.
function LogReviewForm() {
  return (
    <section className="page iro-admin-page">
      <PageTitle title="Log & Review Form" subtitle="Register institutional agreements and perform initial administrative reviews." />
      <div className="two-col">
        <div>
          <FormPanel title="Partner Information" fields={["Partner Name", "Institution Type", "Country", "Contact Person"]} />
          <FormPanel title="Agreement Details" fields={["Agreement Type", "Effective Date", "Expiry Date", "Objective / Purpose"]} />
          <Panel title="Document Upload"><Dropzone /></Panel>
        </div>
        <aside className="review-panel">
          <h2>Administrative Review</h2>
          {["Signatures Present", "Terms Defined", "Attachments Included", "GDPR Compliance"].map((item) => (
            <label className="checkline" key={item}><input type="checkbox" /> {item}</label>
          ))}
          <label>Route To<select><option>Legal Counsel</option><option>IRO Staff</option></select></label>
          <label>Staff Remarks<textarea placeholder="Add administrative notes..." /></label>
          <button>Submit & Route</button>
          <button className="outline">Save Draft</button>
        </aside>
      </div>
    </section>
  );
}

function FormPanel({ title, fields }) {
  return (
    <Panel title={title}>
      <div className="form-grid">
        {fields.map((field) => (
          <label key={field}>{field}<input placeholder={field.includes("Date") ? "mm/dd/yyyy" : field} /></label>
        ))}
      </div>
    </Panel>
  );
}

// Prioritizes pending validations and high-urgency cases.
function ValidationQueue() {
  const rows = [];

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Validation Queue"
        subtitle="Pending document verifications and institutional submission approvals."
        action="Refresh Queue"
      />

      <StatGrid
        stats={[
          ["0 Cases", "Pending Total", CalendarClock],
          ["0 Cases", "Urgent", Info, "", "danger"],
          ["0 Hours", "Avg. Wait Time", CalendarClock, "", "blue"],
          ["0 Cases", "Validated Today", CheckCircle2],
        ]}
      />

      <FilterBar
        labels={[
          "All Departments",
          "All Priorities",
          "All Statuses",
        ]}
      />

      <Panel title="Validation Queue">
        <DataTable
          headers={[
            "ID / Case Ref",
            "Submission Date",
            "Department",
            "Entity Name",
            "Priority",
            "Status",
            "Actions",
          ]}
          rows={[]}
        />
      </Panel>
    </section>
  );
}

// Transfers active cases to balance IRO workload.
function ReassignSubmissions() {
  return (
    <section className="page iro-admin-page">
      <PageTitle title="Reassign Submissions" subtitle="Transfer active cases between department staff to optimize workflow distribution." />
      <div className="two-col">
        <Panel title="Pending Submissions">
          <DataTable
            headers={["Submission ID", "Requester", "Current Assignee", "Priority"]}
            rows={[]}
          />
        </Panel>
        <aside className="form-card">
          <h2>Assignment Details</h2>
          <div className="selected-record">IRO-2023-9095<br /><small>Apex Tech Solutions</small></div>
          <label>Reassign To<select><option>Select staff member...</option></select></label>
          <label>Reason for Reassignment<textarea placeholder="Briefly explain the administrative reason..." /></label>
          <button>Confirm Reassignment</button>
          <button className="outline">Cancel Request</button>
        </aside>
      </div>
    </section>
  );
}

// Summarizes institutional throughput and bottlenecks.
function PerformanceReports() {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const response = await getReportSummary({ page });

        if (active) {
          setSummary(response.data ?? {});
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load report summary:", requestError);

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

    loadReports();

    return () => {
      active = false;
    };
  }, [page]);

  const stats = summary?.stats ?? {};
  const breakdownRows = (summary?.department_breakdown ?? []).map((row) => [
    row.department,
    row.total_requests,
    row.approved,
    row.returned,
    row.average_turnaround,
    row.success_rate,
  ]);

  return (
    <section className="page iro-admin-page">
      <PageTitle title="Institutional Performance Reports" subtitle="Institutional oversight" action="Export Report" />
      <StatGrid stats={[
        [String(stats.total_reviewed ?? 0), "Total Reviewed", FileCheck2],
        [String(stats.total_returned ?? 0), "Total Returned", RefreshCw, "", "danger"],
        [String(stats.total_notarized ?? 0), "Total Notarized", Shield],
      ]} />
      <div className="two-col">
        <Panel title="Workflow Efficiency: Average Time per Stage">
          {["Document Logging", "Administrative Review", "Legal Counsel Approval", "Final Notarization"].map((stage, index) => (
            <div className="bar-row" key={stage}>
              <span>Stage {index + 1}: {stage}</span>
              <b>{[0.4, 1.8, 3.2, 0.8][index]} Days</b>
              <i style={{ width: `${[16, 55, 82, 28][index]}%` }} />
            </div>
          ))}
        </Panel>
        <Panel title="Agreement Volume Trends"><div className="bars">{[46, 58, 66, 82, 62, 50].map((height, index) => <span style={{ height: `${height}%` }} key={index} />)}</div></Panel>
      </div>
      <Panel title="Departmental Breakdown">
        {loading && <p>Loading report data...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && breakdownRows.length === 0 && (
          <p>No report data is available.</p>
        )}
        {!loading && !error && breakdownRows.length > 0 && (
          <DataTable
            headers={["Department / Office", "Total Requests", "Approved", "Returned", "Avg. Turnaround", "Success Rate"]}
            rows={breakdownRows}
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>
    </section>
  );
}

// Finalizes records into the secure archive vault.
function ArchivePage() {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    async function loadArchive() {
      setLoading(true);
      setError("");

      try {
        const response = await getArchiveSummary({ page });

        if (active) {
          setSummary(response.data ?? {});
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load archive records:", requestError);

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

    loadArchive();

    return () => {
      active = false;
    };
  }, [page]);

  const stats = summary?.stats ?? {};
  const rows = (summary?.records ?? []).map((record) => [
    record.tracking_number || "-",
    record.partner_institution || "-",
    record.document_type || "-",
    record.distribution_date
      ? new Date(record.distribution_date).toLocaleDateString()
      : "-",
    record.completion || "-",
    record.status || "-",
    "View",
  ]);

  return (
    <section className="page iro-admin-page">
      <PageTitle title="Records Archive" subtitle="Secure workspace for finalizing agreement distribution and archival." action="Export Registry" />
      <StatGrid stats={[
        [String(stats.total_archived ?? 0), "Total Archived", Archive],
        [String(stats.finalized_today ?? 0), "Finalized Today", Shield],
        [String(stats.pending_archival ?? 0), "Pending Archival", CalendarClock, "", "warn"],
        [String(stats.audit_flags ?? 0), "Audit Flags", Info, "", "danger"],
      ]} />
      <Panel title="Archive Records">
        {loading && <p>Loading archive records...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p>No archived records are available.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={["Tracking ID", "Partner Name", "Type", "Distribution Date", "Completion", "Status", "Actions"]}
            rows={rows}
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>
    </section>
  );
}

// Gives IRO Admin global visibility into partner engagements.
function EngagementsPage() {
  return (
    <section className="page split-page iro-admin-page">
      <div>
        <PageTitle title="Partner Engagements" subtitle="Global view of institutional partnerships." action="New Engagement" />
        <FilterBar labels={["All Departments", "All Agreement Types"]} />
        <Panel title="Engagement Registry" tools={<ExportButton label="Export" />}>
          <DataTable headers={["Partner Organization", "Type / Department", "Validity Period", "Status", "Action"]} 
          rows={[]}
          />
        </Panel>
      </div>
      <aside className="detail-drawer">
        <span className="badge">Active Partner</span>
        <h2>Global Health Alliance</h2>
        <p>Multinational health research non-profit focused on tropical disease mitigation and pharmaceutical ethics.</p>
        <div className="mini-grid">
          <span>Status<b>Verified Active</b></span>
          <span>Risk Level<b>Low (Tier 1)</b></span>
        </div>
        <button className="primary wide-inline">Edit Engagement</button>
      </aside>
    </section>
  );
}
