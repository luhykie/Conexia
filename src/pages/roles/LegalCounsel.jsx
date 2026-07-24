import React from "react";
import { CalendarClock, CheckCircle2, FileText, Gavel, ShieldCheck } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { PageTitle } from "../../components/PageTitle";
import { Panel } from "../../components/Panel";
import { DashboardView, ExpiryView, FilterBar } from "../../components/SharedViews";
import { StatGrid } from "../../components/StatGrid";

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
  return (
    <section className="page split-page legal-page">
      <div>
        <PageTitle title="Review Queue" subtitle="Manage and audit documents explicitly routed for your counsel." />
        <FilterBar labels={["All Routed", "Urgent"]} />
        <Panel title="Routed Documents">
          <DataTable headers={["Tracking #", "Partner", "Document Type", "Route Date", "Status"]} rows={[
            ["#CX-88219", "Global Logistics Corp", "Draft MOA", "Oct 12, 2023", "Pending Review"],
            ["#CX-88224", "Artemis Ventures", "MOU Amendment", "Oct 14, 2023", "Pending Review"],
            ["#CX-88231", "Pacific Energy", "ND Agreement", "Oct 15, 2023", "Pending Review"],
            ["#CX-88240", "Standard Bank Ltd", "Loan Framework", "Oct 16, 2023", "Pending Review"],
          ]} />
        </Panel>
      </div>
      <aside className="review-sidebar">
        <h2>Review Sidebar</h2>
        <div className="dropzone">
          <FileText />
          <b>Draft MOA_v2.pdf</b>
          <p>1.4 MB - Generated Oct 12</p>
        </div>
        <label>Liability Assessment<textarea placeholder="Enter findings on indemnity clauses..." /></label>
        <label className="checkline"><input type="checkbox" /> Compliance Verified</label>
        <footer><button className="outline danger">Return</button><button>Approve</button></footer>
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
