import React from "react";
import { CalendarClock, CheckCircle2, FileText, Gavel, ShieldCheck } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { DashboardView, ExpiryView, FilterBar } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { approveDocument, requestCorrections } from "../services/documentService";
import { getWorkflowDocuments } from "../services/workflowStore";

// Routes all Legal Counsel pages through one role-owned component.
export function LegalCounsel({ page }) {
  if (page === "review") return <ReviewQueue />;
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
function ReviewQueue() {
  const [documents, setDocuments] = React.useState(() =>
    getWorkflowDocuments().filter((document) => document.status === "Under Legal Review")
  );
  const [selectedDocumentId, setSelectedDocumentId] = React.useState(documents[0]?.id || null);
  const [remarks, setRemarks] = React.useState("");
  const [message, setMessage] = React.useState("");

  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) || documents[0];

  function refreshQueue() {
    const routedDocuments = getWorkflowDocuments().filter((document) => document.status === "Under Legal Review");
    setDocuments(routedDocuments);
    setSelectedDocumentId(routedDocuments[0]?.id || null);
  }

  async function handleApprove() {
    if (!selectedDocument) return;

    await approveDocument(selectedDocument.id);
    setMessage(`${selectedDocument.tracking_number} approved by legal counsel.`);
    refreshQueue();
  }

  async function handleReturn() {
    if (!selectedDocument) return;

    await requestCorrections(
      selectedDocument.id,
      remarks || "Please revise the document according to legal counsel comments."
    );
    setMessage(`${selectedDocument.tracking_number} returned for corrections.`);
    setRemarks("");
    refreshQueue();
  }

  const rows = documents.map((document) => [
    document.tracking_number,
    document.partner_institution,
    document.document_type,
    new Date(document.updated_at || document.submitted_at).toLocaleDateString(),
    document.status,
  ]);

  return (
    <section className="page split-page legal-page">
      <div>
        <PageTitle title="Review Queue" subtitle="Manage and audit documents explicitly routed for your counsel." />
        <FilterBar labels={["All Routed", "Urgent"]} />
        <Panel title="Routed Documents">
          {rows.length ? (
            <DataTable headers={["Tracking #", "Partner", "Document Type", "Route Date", "Status"]} rows={rows} />
          ) : (
            <p className="empty-state">No documents are currently routed to legal counsel.</p>
          )}
        </Panel>
      </div>
      <aside className="review-sidebar">
        <h2>Review Sidebar</h2>
        {selectedDocument ? (
          <select
            value={selectedDocument.id}
            onChange={(event) => setSelectedDocumentId(event.target.value)}
          >
            {documents.map((document) => (
              <option value={document.id} key={document.id}>
                {document.tracking_number} - {document.partner_institution}
              </option>
            ))}
          </select>
        ) : null}
        <div className="dropzone">
          <FileText />
          <b>{selectedDocument?.title || "No routed document"}</b>
          <p>{selectedDocument?.description || "IRO Staff routed documents appear here."}</p>
        </div>
        <label>
          Liability Assessment
          <textarea
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Enter findings on indemnity clauses..."
            value={remarks}
          />
        </label>
        <label className="checkline"><input type="checkbox" /> Compliance Verified</label>
        <footer>
          <button className="outline danger" disabled={!selectedDocument} onClick={handleReturn}>Return</button>
          <button disabled={!selectedDocument} onClick={handleApprove}>Approve</button>
        </footer>
        {message && <p className="review-status legal-message">{message}</p>}
      </aside>
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
