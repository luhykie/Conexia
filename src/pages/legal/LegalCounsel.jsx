import React from "react";
import { CalendarClock, CheckCircle2, FileText, Gavel, ShieldCheck } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { DocumentReviewViewer, ReviewCommentsPanel, useDocumentReview } from "../../components/DocumentReviewViewer";
import { PageTitle } from "../../components/PageTitle";
import { Panel } from "../../components/Panel";
import { DashboardView, ExpiryView, FilterBar } from "../../components/SharedViews";
import { StatGrid } from "../../components/StatGrid";
import { generateNotarizationForm, getSubmissionFile, listSubmissions, updateSubmissionStatus } from "../../services/submissions";
import { getSchoolLabel } from "../../utils/school";

function formatSubmissionStatus(status) {
  const labels = {
    pending_iro_staff_review: "Pending IRO Staff Review",
    approved_by_iro_staff: "Logged by IRO Staff",
    pending_iro_admin_review: "Pending IRO Admin Review",
    legally_approved: "Approved by Legal Counsel",
    legal_revision_required: "Returned for Legal Corrections",
    revision_required: "Revision Required",
    pending_notarization: "Pending Notarization",
    notarized: "Notarized",
  };

  return labels[status] || status || "Unknown";
}

function statusTone(status) {
  if (status === "pending_iro_admin_review") return "warn";
  if (status === "legally_approved") return "success";
  if (status === "legal_revision_required") return "danger";
  if (status === "pending_notarization") return "info";
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

// Routes all Legal Counsel pages through one role-owned component.
export function LegalCounsel({ page, account }) {
  if (page === "review") return <ReviewQueue account={account} />;
  if (page === "notarization") return <NotarizationTracker />;
  if (page === "expiry") return <ExpiryView title="Institutional Workspace" action="New Submission" />;
  if (page === "history") return <ActionHistory />;

  return (
    <DashboardView
      roleKey="legal"
      title="Legal Counsel Dashboard"
      subtitle="Prioritized legal review, approval, return, and notarization workload."
      action="Open Document"
    />
  );
}

// Provides a legal review queue with a side panel for findings and decisions.
function ReviewQueue({ account }) {
  const [submissions, setSubmissions] = React.useState([]);
  const [selectedSubmission, setSelectedSubmission] = React.useState(null);
  const [legalComments, setLegalComments] = React.useState("");
  const [selectionNote, setSelectionNote] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const review = useDocumentReview(selectedSubmission, account);

  React.useEffect(() => {
    async function loadSubmissions() {
      const response = await listSubmissions(account, { status: "eq.pending_legal_review" });
      const data = response?.data || [];
      if (data) {
        setSubmissions(data);
        if (data.length > 0) setSelectedSubmission(data[0]);
      }
      setLoading(false);
    }

    loadSubmissions();
  }, []);


    async function handleApprove() {
    if (!selectedSubmission) return;

    try {
      await updateSubmissionStatus(account, selectedSubmission.id, "approved", "Document approved by Legal Counsel");
      await generateNotarizationForm(account, selectedSubmission.id);
      setMessage("Document approved. Notarization Form generated successfully.");
      setSubmissions(submissions.filter(s => s.id !== selectedSubmission.id));
      setSelectedSubmission(null);
    } catch (error) {
      setMessage("Failed to approve document. Please try again.");
    }
  }

  async function handleReturnForCorrections() {
    if (!selectedSubmission || !legalComments) {
      setMessage("Please provide legal comments before returning for corrections.");
      return;
    }

    try {
      await updateSubmissionStatus(account, selectedSubmission.id, "revision_required", legalComments);
      setMessage("Document returned to Department Staff for corrections.");
      setSubmissions(submissions.filter(s => s.id !== selectedSubmission.id));
      setSelectedSubmission(null);
      setLegalComments("");
    } catch (error) {
      setMessage("Failed to return document. Please try again.");
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
    setLegalComments((current) => current ? `${current}\n\n[Highlighted] ${text}` : `[Highlighted] ${text}`);
  }

  return (
    <section className="page legal-page">
      <PageTitle title="Review Queue" subtitle="Manage and audit documents explicitly routed for your counsel." />
      <FilterBar labels={["All Routed", "Urgent"]} />
      <Panel title="Routed Documents">
        {loading ? (
          <p style={{ padding: "24px" }}>Loading submissions...</p>
        ) : (
            <DataTable
            headers={["Tracking #", "Department", "Partner", "Document Type", "Route Date", "Status", "Action"]}
            rows={submissions.map(s => [
              <b>{s.tracking_number || s.id.slice(0, 8)}</b>,
              getSchoolLabel(s),
              s.partner_institution_name,
              s.agreement_type,
              new Date(s.created_at).toLocaleDateString(),
              <span className={`badge ${statusTone(s.status)}`}>{formatSubmissionStatus(s.status)}</span>,
              <button
                className="outline"
                onClick={() => setSelectedSubmission(s)}
              >
                Review
              </button>
            ])}
          />
        )}
      </Panel>
      {selectedSubmission ? (
        <Panel title={`Reviewing ${selectedSubmission.tracking_number || selectedSubmission.id}`}>
          <div className="submission-review-layout review-layout">
            <section className="submission-review-layout__document">
              <DocumentReviewViewer submission={selectedSubmission} account={account} review={review} />
            </section>

            <aside className="submission-review-layout__details review-sidebar-compact">
              <h2 style={{ marginTop: 0 }}>Submission Details</h2>
              <p><strong>Partner:</strong> {selectedSubmission.partner_institution_name}</p>
              <p><strong>Department:</strong> {getSchoolLabel(selectedSubmission)}</p>
              <p><strong>Document:</strong> {selectedSubmission.file_name || "Document.pdf"}</p>
              <p><strong>Agreement:</strong> {selectedSubmission.agreement_title || selectedSubmission.agreement_type}</p>
              <p><strong>Status:</strong> <span className={`badge ${statusTone(selectedSubmission.status)}`}>{formatSubmissionStatus(selectedSubmission.status)}</span></p>
              <ReviewCommentsPanel review={review} title="Comments" />
              <label>Legal Comments
                <textarea
                  placeholder="Enter findings and required corrections..."
                  value={legalComments}
                  onChange={(e) => setLegalComments(e.target.value)}
                  rows={5}
                />
              </label>
              {message ? <p className="review-viewer-message">{message}</p> : null}
              <footer className="review-sidebar-compact__actions">
                <button className="outline danger" type="button" onClick={handleReturnForCorrections}>Return for Corrections</button>
                <button type="button" onClick={handleApprove}>Approve</button>
              </footer>
            </aside>
          </div>
        </Panel>
      ) : null}
    </section>
  );
}

// Records and verifies notarization events.
function NotarizationTracker() {
  return (
    <section className="page legal-page">
      <PageTitle title="Notarization Tracker" subtitle="Track pending notarization records and completed notarial entries." />
      <StatGrid stats={[
        ["42", "Total Queue", Gavel],
        ["18", "Pending Approval", CalendarClock, "", "blue"],
        ["124", "Completed (MTD)", CheckCircle2],
      ]} />
      <div className="two-col">
        <Panel title="Document Tracking Queue">
          <DataTable headers={["Document ID", "Entity / Client", "Status", "Last Activity", "Action"]} rows={[
            ["#DOC-2024-881", "Sterling-Cooper Ltd.", "Pending Notarization", "2h ago", "Record"],
            ["#DOC-2024-879", "Arasaka Corp.", "Notarized", "Yesterday", "View"],
            ["#DOC-2024-875", "Weyland-Yutani", "Pending Notarization", "3 days ago", "Record"],
            ["#DOC-2024-870", "Massive Dynamic", "Notarized", "1 week ago", "View"],
          ]} />
        </Panel>
        <aside className="form-card">
          <h2>Record Notarization</h2>
          {["Selected Document ID", "Notarial Reference Number", "Date of Notarization", "Notary Public Signature Code"].map((field) => (
            <label key={field}>{field}<input placeholder={field === "Selected Document ID" ? "#DOC-2024-881" : field} /></label>
          ))}
          <button>Submit for Verification</button>
        </aside>
      </div>
    </section>
  );
}

// Lists the legal team's review and notarization history.
function ActionHistory() {
  return (
    <section className="page legal-page">
      <PageTitle title="Legal Action History" subtitle="Audit Log & Activity" action="Download Report" />
      <FilterBar labels={["All Entities", "Date Range", "Any Status"]} />
      <div className="two-col">
        <Panel title="Audit Log & Activity">
          {[
            ["Approved #USJR-2023-0842", "Review of Commercial Master Services Agreement completed successfully.", "Verified"],
            ["Notarized Entry #NX-9921", "Digital notarial seal applied to Partnership Addendum.", "Recorded"],
            ["Rejected #UK-LTD-4401", "Insufficient identity verification documents provided.", "Correction"],
          ].map(([title, detail, status], index) => (
            <div className={`timeline-item ${index === 2 ? "danger" : ""}`} key={title}>
              <b>{title}</b>
              <p>{detail}</p>
              <span className={`badge ${index === 2 ? "danger" : ""}`}>{status}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Expiring Soon">
          <div className="notice danger"><b>Strategic Alliances Ltd.</b><p>Expires in 3 days - #CERT-998-AX</p><button className="primary">Flag for Renewal</button></div>
          <div className="notice warn"><b>Cloud Systems Inc.</b><p>Expires in 12 days - #CERT-204-VY</p><button className="outline">Flag for Renewal</button></div>
          <section className="dark-card"><ShieldCheck /><div><h2>Compliance Status</h2><p>4 agreements require notarization updates this month.</p></div></section>
        </Panel>
      </div>
    </section>
  );
}
