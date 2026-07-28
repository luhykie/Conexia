import React from "react";
import { Download, FileText, Folder, Gauge, Paperclip } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { PageTitle } from "../../components/PageTitle";
import { Panel } from "../../components/Panel";
import { DashboardView, Dropzone, ExpiryView, ExportButton, FilterBar } from "../../components/SharedViews";
import { StatGrid } from "../../components/StatGrid";
import { listSubmissions, updateSubmissionStatus } from "../../services/submissions";
import { getSchoolLabel } from "../../utils/school";

function formatSubmissionStatus(status) {
  const labels = {
    pending_iro_staff_review: "Pending",
    approved_by_iro_staff: "Logged by IRO Staff",
    pending_iro_admin_review: "Pending",
    legally_approved: "Approved by Legal Counsel",
    legal_revision_required: "Returned for Legal Corrections",
    revision_required: "Revision Required",
  };

  return labels[status] || status || "Unknown";
}

function statusTone(status) {
  if (status === "pending_iro_staff_review") return "warn";
  if (status === "approved_by_iro_staff") return "success";
  if (status === "pending_iro_admin_review") return "warn";
  if (status === "legal_revision_required" || status === "revision_required") return "danger";
  return "neutral";
}

export function IroStaff({ page, setPage, account }) {
  if (page === "incoming") return <IncomingSubmissions setPage={setPage} account={account} />;
  if (page === "log-review") return <LogReview setPage={setPage} account={account} />;
  if (page === "status") return <StatusTracker />;
  if (page === "expiry") return <ExpiryView title="Global Expiry List" action="Bulk Notify Offices" />;

  return (
    <DashboardView
      roleKey="staff"
      title="Dashboard Overview"
      subtitle="Real-time tracking of institutional relations workflow."
      action="Process Now"
    />
  );
}

function IncomingSubmissions({ setPage, account }) {
  const [rows, setRows] = React.useState([]);
  const [submissions, setSubmissions] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadIncoming() {
      const toRow = (row) => [
        <b>{row.tracking_number || String(row.id).slice(0, 8)}</b>,
        getSchoolLabel(row),
        row.agreement_type,
        new Date(row.created_at).toLocaleDateString(),
        <span className={`badge ${statusTone(row.status)}`}>{formatSubmissionStatus(row.status)}</span>,
        <button
          className="outline"
          type="button"
          onClick={() => {
            setSelectedId(row.id);
            setPage?.("log-review");
          }}
        >
          Review
          </button>,
      ];

      try {
        const response = await listSubmissions(account, { status: "eq.pending_iro_staff_review" });
        const data = response?.data || [];
        setSubmissions(data);
        setRows(data.map(toRow));
        setSelectedId(data[0]?.id || null);
      } catch (error) {
        setSubmissions([]);
        setRows([]);
        setSelectedId(null);
      }

      setLoading(false);
    }

    loadIncoming();
  }, [setPage, account]);

  const preview = submissions.find((item) => item.id === selectedId) || submissions[0] || null;

  return (
    <section className="page iro-staff-page">
      <PageTitle title="Incoming Queue" subtitle="Receive submissions routed from Department Staff." />
      <StatGrid
        stats={[
          [`${rows.length}`, "Total Pending", Folder, "+New"],
          ["Under Review", "Review and log submissions before sending to IRO Admin", FileText],
        ]}
      />
      <FilterBar labels={["All Departments", "All Statuses", "Submitted Only"]} />
      <div className="two-col">
        <Panel title="Active Submissions" tools={<ExportButton label="Export CSV" />}>
          {loading ? (
            <p style={{ padding: 24 }}>Loading submissions...</p>
          ) : rows.length ? (
              <DataTable
                headers={["Tracking #", "Department", "Document Type", "Date Submitted", "Status", "Action"]}
                rows={rows}
              />
          ) : (
            <p style={{ padding: 24 }}>No submissions are currently awaiting staff review.</p>
          )}
        </Panel>

        <aside className="detail-drawer">
          <h2>Submission Preview</h2>
          {preview ? (
            <div className="doc-preview">
              <h3>{preview.partner_institution_name}</h3>
              <p><strong>Office:</strong> {preview.office}</p>
              <p><strong>Department:</strong> {getSchoolLabel(preview)}</p>
              <p><strong>Title:</strong> {preview.title || preview.agreement_title || "---"}</p>
              <p><strong>Agreement Type:</strong> {preview.agreement_type}</p>
              <p><strong>Expected Duration:</strong> {preview.expected_duration || "---"}</p>
              <p><strong>Contact Person:</strong> {preview.contact_person || "---"}</p>
              <p><strong>Contact Position:</strong> {preview.contact_position || "---"}</p>
              <p><strong>Contact Email:</strong> {preview.partner_contact_email || preview.contact_email || "---"}</p>
              <p><strong>Contact Number:</strong> {preview.contact_number || "---"}</p>
              <p><strong>Requested Completion:</strong> {preview.requested_completion_date ? new Date(preview.requested_completion_date).toLocaleDateString() : "---"}</p>
              <p><strong>Requested By:</strong> {preview.requested_by_name || "---"}</p>
              <p><strong>Submitted:</strong> {new Date(preview.created_at).toLocaleString()}</p>
              <p><strong>Status:</strong> <b>{formatSubmissionStatus(preview.status)}</b></p>
              <p><span className={`badge ${statusTone(preview.status)}`}>{formatSubmissionStatus(preview.status)}</span></p>
              <p><strong>Review Notes:</strong> {preview.notes || "No review notes yet."}</p>
              <p className="attachment-indicator">
                <Paperclip size={16} />
                <span>Attachment received. IRO Staff can review the filled-out form, but the file stays hidden from staff by design.</span>
              </p>
              <button className="primary wide-inline" type="button" onClick={() => setPage?.("log-review")}>
                Open for Review
              </button>
            </div>
          ) : (
            <p style={{ padding: 24 }}>No submission selected.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function LogReview({ setPage, account }) {
  const [submission, setSubmission] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    async function loadSubmission() {
      try {
        const response = await listSubmissions(account, { status: "eq.pending_iro_staff_review" });
        const data = (response?.data || [])[0] || null;
        setSubmission(data);
      } catch (error) {
        setSubmission(null);
      }
      setLoading(false);
    }

    loadSubmission();
  }, []);

    async function handleMarkLogged() {
    if (!submission) return;

    try {
      await updateSubmissionStatus(account, submission.id, "approved_by_iro_staff", "IRO Staff approved the submission.");
    } catch (error) {
      setMessage(error.message || "Unable to approve submission. Please try again.");
      return;
    }

    setMessage("Submission logged and routed to IRO Admin.");
    setSubmission({ ...submission, status: "approved_by_iro_staff" });
  }

  return (
    <section className="page iro-staff-page">
      <PageTitle title="Log & Review Form" subtitle="Verify incoming submission data before routing to IRO Admin." action="Mark as Logged" />
      <div className="two-col">
        <div>
          <button className="outline" type="button" onClick={() => setPage?.("incoming")} style={{ marginBottom: 16 }}>
            Back to Incoming Queue
          </button>
          <Panel title={submission ? `Document Preview: ${submission.partner_institution_name}` : "Pending Submission"}>
            {loading ? (
              <p style={{ padding: 24 }}>Loading submission...</p>
            ) : submission ? (
              <div className="doc-preview">
                <h3>{submission.partner_institution_name}</h3>
                <p><strong>Department:</strong> {getSchoolLabel(submission)}</p>
                <p><strong>Title:</strong> {submission.title || submission.agreement_title || "---"}</p>
                <p><strong>Agreement Type:</strong> {submission.agreement_type}</p>
                <p><strong>Office:</strong> {submission.office}</p>
                <p><strong>Expected Duration:</strong> {submission.expected_duration || "---"}</p>
                <p><strong>Contact Person:</strong> {submission.contact_person || "---"}</p>
                <p><strong>Contact Position:</strong> {submission.contact_position || "---"}</p>
                <p><strong>Contact Email:</strong> {submission.partner_contact_email || submission.contact_email || "---"}</p>
                <p><strong>Contact Number:</strong> {submission.contact_number || "---"}</p>
                <p><strong>Requested Completion:</strong> {submission.requested_completion_date ? new Date(submission.requested_completion_date).toLocaleDateString() : "---"}</p>
                <p><strong>Requested By:</strong> {submission.requested_by_name || "---"}</p>
                <p><strong>Submitted:</strong> {new Date(submission.created_at).toLocaleString()}</p>
                <p><strong>Contact:</strong> {submission.partner_contact_email}</p>
                <p><strong>Status:</strong> <b>{formatSubmissionStatus(submission.status)}</b></p>
                <p><span className={`badge ${statusTone(submission.status)}`}>{formatSubmissionStatus(submission.status)}</span></p>
                <p><strong>Review Notes:</strong> {submission.notes || "No review notes yet."}</p>
                <p className="attachment-indicator">
                  <Paperclip size={16} />
                <span>Attachment received. The file is hidden from IRO Staff, but the routed form is available for review.</span>
              </p>
              </div>
            ) : (
              <p style={{ padding: 24 }}>No submissions are currently awaiting staff review.</p>
            )}
          </Panel>
        </div>
        <aside className="review-sidebar">
          <h2>Completeness Check</h2>
          {["Partner Details Verified", "Signatory Identified", "Standard Template Used"].map((item) => (
            <label className="checkline" key={item}>
              <input type="checkbox" /> {item}
            </label>
          ))}
          <label>
            Internal Staff Notes
            <textarea placeholder="Any initial observations for the reviewer..." />
          </label>
          <Panel title="Routing & Automation">
            <button className="primary wide-inline" onClick={handleMarkLogged} disabled={!submission}>
              Mark as Logged and Route to IRO Admin
            </button>
            <Dropzone label="Attach supporting document" detail="Optional supporting PDF or DOCX" />
            {message && <p style={{ marginTop: 16 }}>{message}</p>}
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function StatusTracker() {
  return (
    <section className="page split-page iro-staff-page">
      <div>
        <PageTitle title="Submission Progression" subtitle="Real-time status of active institutional agreements." />
        {[
          ["CTX-9902", "Pacific Global University", "2d 14h", true],
          ["CTX-9884", "Nautical Research Institute", "14h 22m", false],
          ["CTX-9871", "Vanguard Medical College", "5d 02h", true],
        ].map(([id, name, time, complete]) => (
          <article className="status-card" key={id}>
            <span className="badge active">ID: {id}</span>
            <h2>{name}</h2>
            <div className="progress-steps">
              <span className="done">Submitted</span>
              <span className="done">Logged</span>
              <span className={complete ? "done" : ""}>Under Review</span>
            </div>
            <footer>
              <span>MOA (Institutional)</span>
              <span>Engineering Dept.</span>
              <b>Time in Current Status {time}</b>
            </footer>
          </article>
        ))}
      </div>
      <aside className="detail-drawer">
        <h2>Audit Trail</h2>
        {["Status Changed to Under Review", "Logged & Verified", "Initial Submission"].map((entry) => (
          <div className="timeline-item" key={entry}>
            <b>{entry}</b>
            <p>Submission lifecycle event recorded for export and audit.</p>
            <small>OCT 14, 11:30</small>
          </div>
        ))}
        <button className="primary wide-inline">
          <Download size={18} /> Generate Export Log
        </button>
      </aside>
    </section>
  );
}
