import React from "react";
import { Archive, CalendarClock, CheckCircle2, FileCheck2, FileText, Info, RefreshCw, Shield } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { DocumentReviewViewer } from "../../components/DocumentReviewViewer";
import { PageTitle } from "../../components/PageTitle";
import { Panel } from "../../components/Panel";
import { DashboardView, Dropzone, ExpiryView, ExportButton, FilterBar, NotificationsView } from "../../components/SharedViews";
import { StatGrid } from "../../components/StatGrid";
import { archiveStats, reportStats } from "../../data/mockData";
import { archiveSubmission, distributeSubmission, getSubmissionFile, listSubmissions, updateSubmissionStatus } from "../../services/submissions";
import { getSchoolLabel } from "../../utils/school";

function formatSubmissionStatus(status) {
  const labels = {
    notarized: "Notarized",
    archived: "Archived",
    distributed: "Distributed",
  };

  return labels[status] || status || "Unknown";
}

function statusTone(status) {
  if (status === "notarized") return "info";
  if (status === "archived") return "success";
  if (status === "distributed") return "success";
  return "neutral";
}

function SubmissionDocumentSheet({ submission }) {
  const attachment = Array.isArray(submission?.attachments) ? submission.attachments[0] : null;
  return (
    <div className="submission-sheet">
      <div className="submission-sheet__header">
        <h3>{submission.agreement_title || submission.partner_institution_name || "Submission Document"}</h3>
        <p>{attachment?.file_name || submission.file_name || "Attached PDF"}</p>
      </div>
      <div className="document-preview-empty" style={{ minHeight: "260px" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>No PDF file is attached to this submission yet.</p>
        <p style={{ margin: "8px 0 0" }}>
          The record only contains the filename right now, so the browser cannot render the PDF itself.
        </p>
      </div>
    </div>
  );
}

// Routes all IRO Admin pages through one role-owned component.
export function IroAdmin({ page, account }) {
  if (page === "log-review") return <LogReviewForm account={account} />;
  if (page === "validation") return <ValidationQueue />;
  if (page === "reassign") return <ReassignSubmissions />;
  if (page === "reports") return <PerformanceReports />;
  if (page === "archive") return <ArchivePage account={account} />;
  if (page === "engagements") return <EngagementsPage />;
  if (page === "expiry") return <ExpiryView title="Agreement Expiry Tracking" action="Apply Filters" />;
  if (page === "notifications") return <NotificationsView />;
  if (page === "notarization") return <NotarizationTracker />;

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
function LogReviewForm({ account }) {
  const [submissions, setSubmissions] = React.useState([]);
  const [selectedSubmission, setSelectedSubmission] = React.useState(null);
  const [adminNotes, setAdminNotes] = React.useState("");
  const [selectionNote, setSelectionNote] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    async function loadQueue() {
      try {
        const response = await listSubmissions(account, {});
        const data = (response?.data || []).filter((row) => [
          "pending_iro_admin_review",
          "approved_by_iro_staff",
          "pending_legal_review",
        ].includes(row.status));
        setSubmissions(data);
        setSelectedSubmission(data[0] || null);
      } catch (error) {
        setSubmissions([]);
        setSelectedSubmission(null);
      } finally {
        setLoading(false);
      }
    }

    loadQueue();
  }, [account]);


  async function handleRouteToDepartment() {
    if (!selectedSubmission) return;
    if (!adminNotes.trim()) {
      setMessage("Please enter review notes before returning the submission.");
      return;
    }

    try {
      await updateSubmissionStatus(account, selectedSubmission.id, "revision_required", adminNotes.trim());
      setMessage("Submission returned to Department Staff with review notes.");
      setSubmissions((current) => current.filter((row) => row.id !== selectedSubmission.id));
      setSelectedSubmission(null);
      setAdminNotes("");
    } catch (error) {
      setMessage(error.message || "Unable to return the submission.");
    }
  }

  async function handleApprove() {
    if (!selectedSubmission) return;

    try {
      await updateSubmissionStatus(account, selectedSubmission.id, "pending_legal_review", adminNotes.trim() || "Approved by IRO Admin and routed to Legal.");
      setMessage("Submission routed to Legal.");
      setSubmissions((current) => current.filter((row) => row.id !== selectedSubmission.id));
      setSelectedSubmission(null);
      setAdminNotes("");
    } catch (error) {
      setMessage(error.message || "Unable to route the submission.");
    }
  }

  async function handleReject() {
    if (!selectedSubmission) return;
    try {
      await updateSubmissionStatus(account, selectedSubmission.id, "revision_required", adminNotes.trim() || "Rejected by IRO Admin.");
      setMessage("Submission returned to Department Staff.");
      setSubmissions((current) => current.filter((row) => row.id !== selectedSubmission.id));
      setSelectedSubmission(null);
      setAdminNotes("");
    } catch (error) {
      setMessage(error.message || "Unable to reject the submission.");
    }
  }

  function handleCaptureSelection() {
    const selection = window.getSelection?.();
    const text = String(selection?.toString() || "").trim();
    if (!text) {
      setMessage("Select text in the document first, then capture it as a note.");
      return;
    }
    setSelectionNote(text);
    setAdminNotes((current) => current ? `${current}\n\n[Highlighted] ${text}` : `[Highlighted] ${text}`);
  }

  return (
    <section className="page iro-admin-page">
      <PageTitle title="Log & Review Form" subtitle="Review submissions logged by IRO Staff and continue the admin handoff." />
      <Panel title="Pending Submissions">
        {loading ? (
          <p style={{ padding: "24px" }}>Loading submissions...</p>
        ) : (
          <DataTable
            headers={["Tracking #", "Department", "Partner", "Status", "Action"]}
            rows={submissions.map((row) => [
              <b>{row.tracking_number || String(row.id).slice(0, 8)}</b>,
              getSchoolLabel(row),
              row.partner_institution_name,
              <span className={`badge ${statusTone(row.status)}`}>{formatSubmissionStatus(row.status)}</span>,
              <button className="outline" type="button" onClick={() => setSelectedSubmission(row)}>Review</button>,
            ])}
          />
        )}
      </Panel>

      {selectedSubmission ? (
        <Panel title={`Reviewing ${selectedSubmission.tracking_number || selectedSubmission.id}`}>
          <div className="admin-review-layout">
            <section className="admin-review-document">
              <div className="auth-status ready" style={{ marginBottom: "12px" }}>
                Received from IRO Staff and queued for admin review.
              </div>
              <div className="document-preview-shell">
                <DocumentReviewViewer submission={selectedSubmission} account={account} viewerTitle="IRO Admin Document Review" />
              </div>
            </section>

            <section className="admin-review-form">
              <div className="doc-preview" style={{ margin: 0, minHeight: "auto" }}>
                <h3>{selectedSubmission.partner_institution_name}</h3>
                <p><strong>Department:</strong> {getSchoolLabel(selectedSubmission)}</p>
                <p><strong>Agreement:</strong> {selectedSubmission.agreement_type || selectedSubmission.title || "N/A"}</p>
                <p><strong>Status:</strong> {formatSubmissionStatus(selectedSubmission.status)}</p>
                <p><strong>Workflow Step:</strong> {selectedSubmission.status === "approved_by_iro_staff" ? "Logged by IRO Staff" : "Queued for admin review"}</p>
                <p><strong>Current Notes:</strong> {selectedSubmission.notes || "No review notes yet."}</p>
              </div>
              <div className="review-toolbar">
                <button type="button" className="outline" onClick={handleCaptureSelection}>Capture Selection</button>
                <button type="button" className="outline" onClick={() => setSelectionNote("")}>Clear Capture</button>
              </div>
              {selectionNote && (
                <div className="auth-status ready">
                  <b>Selected text</b>
                  <small>{selectionNote}</small>
                </div>
              )}
              <label>
                Review Notes
                <textarea
                  placeholder="Write what the department should correct or confirm..."
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  rows={6}
                />
              </label>
              {message && <p style={{ color: message.includes("Unable") ? "red" : "green" }}>{message}</p>}
              <div style={{ display: "grid", gap: "10px" }}>
                <button type="button" onClick={handleApprove}>Approve and Route to Legal</button>
                <button type="button" className="outline" onClick={handleReject}>Return to Department Staff</button>
                <button type="button" className="outline" onClick={handleRouteToDepartment}>Return with Notes</button>
              </div>
            </section>
          </div>
        </Panel>
      ) : (
        <Panel title="Review Workspace">
          <p style={{ padding: "24px" }}>Select a submission to open the file and filled-out form together.</p>
        </Panel>
      )}
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
  return (
    <section className="page iro-admin-page">
      <PageTitle title="Validation Queue" subtitle="Pending document verifications and institutional submission approvals." action="Refresh Queue" />
      <StatGrid stats={[
        ["124 Cases", "Pending Total", CalendarClock],
        ["18 Cases", "Urgent", Info, "", "danger"],
        ["4.2 Hours", "Avg. Wait Time", CalendarClock, "", "blue"],
        ["42 Cases", "Validated Today", CheckCircle2],
      ]} />
      <FilterBar labels={["All Departments", "All Priorities", "All Statuses"]} />
      <Panel title="Validation Queue">
        <DataTable
          headers={["ID / Case Ref", "Submission Date", "Department", "Entity Name", "Priority", "Status", "Actions"]}
          rows={[
            ["#VAL-98231", "24 Oct 2023, 09:12", "Global Compliance", "Nexus Logistics Ltd", "Urgent", "New Submission", "Validate"],
            ["#VAL-98228", "23 Oct 2023, 16:45", "Institutional Finance", "Apex Capital Partners", "High", "Under Review", "Validate"],
            ["#VAL-98225", "23 Oct 2023, 14:10", "Legal Affairs", "Stellar Biotech", "Medium", "New Submission", "Validate"],
            ["#VAL-98220", "23 Oct 2023, 11:30", "Legal Affairs", "Horizon Ventures", "Urgent", "Escalated", "Validate"],
          ]}
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
            rows={[
              ["IRO-2023-9081", "Global Logistics Corp", "Jane Doe", "High"],
              ["IRO-2023-9095", "Apex Tech Solutions", "Marcus Smith", "Normal"],
              ["IRO-2023-9112", "City Health Group", "Jane Doe", "Medium"],
            ]}
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
  return (
    <section className="page iro-admin-page">
      <PageTitle title="Institutional Performance Reports" subtitle="Institutional oversight" action="Export Report" />
      <StatGrid stats={reportStats} />
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
        <DataTable headers={["Department / Office", "Total Requests", "Approved", "Returned", "Avg. Turnaround", "Success Rate"]} rows={[
          ["College of Law", "412", "390", "22", "4.2 Days", "94.6%"],
          ["Engineering & Tech", "285", "240", "45", "6.8 Days", "84.2%"],
          ["Medicine & Health", "354", "342", "12", "3.1 Days", "96.6%"],
        ]} />
      </Panel>
    </section>
  );
}

// Finalizes records into the secure archive vault.
function ArchivePage({ account }) {
  const [submissions, setSubmissions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    async function loadSubmissions() {
      const response = await listSubmissions(account, { status: "in.(notarized,archived,distributed)" });
      if (response?.data) {
        setSubmissions(response.data);
      }
      setLoading(false);
    }

    loadSubmissions();
  }, []);

  async function handleArchive(submission) {
    try {
      await archiveSubmission(account, submission.id);
        setMessage("Submission archived successfully.");
        setSubmissions(submissions.map(s => s.id === submission.id ? { ...s, status: "archived" } : s));
    } catch (error) {
      setMessage("Failed to archive submission. Please try again.");
    }
  }

  async function handleDistribute(submission) {
    try {
      await distributeSubmission(account, submission.id);
        setMessage("Submission distributed successfully.");
        setSubmissions(submissions.map(s => s.id === submission.id ? { ...s, status: "distributed" } : s));
    } catch (error) {
      setMessage("Failed to distribute submission. Please try again.");
    }
  }

  return (
    <section className="page iro-admin-page">
      <PageTitle title="Records Archive" subtitle="Secure workspace for finalizing agreement distribution and archival." action="Export Registry" />
      <StatGrid stats={[
        [String(submissions.filter(s => s.status === "notarized").length), "Pending Archive", Archive],
        [String(submissions.filter(s => s.status === "archived").length), "Archived", CheckCircle2],
        [String(submissions.filter(s => s.status === "distributed").length), "Distributed", FileCheck2],
      ]} />
      <Panel title="Archive Records">
        {loading ? (
          <p style={{ padding: "24px" }}>Loading submissions...</p>
        ) : (
            <DataTable 
            headers={["Tracking ID", "Department", "Partner Name", "Type", "Status", "Actions"]} 
            rows={submissions.map(s => [
              <b>{s.tracking_number || s.id.slice(0, 8)}</b>,
              getSchoolLabel(s),
              s.partner_institution_name,
              s.agreement_type,
              <span className={`badge ${statusTone(s.status)}`}>{formatSubmissionStatus(s.status)}</span>,
              <div style={{ display: "flex", gap: "8px" }}>
                {s.status === "notarized" && (
                  <button 
                    className="outline" 
                    onClick={() => handleArchive(s)}
                  >
                    Archive
                  </button>
                )}
                {s.status === "archived" && (
                  <button 
                    className="outline" 
                    onClick={() => handleDistribute(s)}
                  >
                    Distribute
                  </button>
                )}
                {s.status === "distributed" && (
                  <span className="badge">Completed</span>
                )}
              </div>
            ])} 
          />
        )}
        {message && <p style={{ marginTop: "16px", color: message.includes("Failed") ? "red" : "green" }}>{message}</p>}
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
          <DataTable headers={["Partner Organization", "Type / Department", "Validity Period", "Status", "Action"]} rows={[
            ["Global Health Alliance", "Research Collaboration", "Jan 12, 2024 - Jan 11, 2027", "Active", "Open"],
            ["Nordic Tech University", "Student Exchange", "Expires in 14 days", "Expiring", "Renew Now"],
            ["Quantum Dynamics Ltd.", "Strategic MOU", "Approval In Progress", "Pending", "Edit"],
          ]} />
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
        <div className="file-row"><FileText /> signed_mou_v2.pdf</div>
        <div className="file-row"><FileText /> risk_assessment.docx</div>
        <button className="primary wide-inline">Edit Engagement</button>
      </aside>
    </section>
  );
}
