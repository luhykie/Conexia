import React from "react";
import { CalendarClock, CheckCircle2, FileText, Gavel, ShieldCheck } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { PageTitle } from "../../components/PageTitle";
import { Panel } from "../../components/Panel";
import { DashboardView, ExpiryView, FilterBar } from "../../components/SharedViews";
import { StatGrid } from "../../components/StatGrid";
import { supabase } from "../../lib/supabaseClient";

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
  const [submissions, setSubmissions] = React.useState([]);
  const [selectedSubmission, setSelectedSubmission] = React.useState(null);
  const [legalComments, setLegalComments] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    async function loadSubmissions() {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .in("status", ["review_form_generated", "under_review", "resubmitted"])
        .order("created_at", { ascending: false });

      if (!error && data) {
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
      const token = localStorage.getItem("sb-access-token");
      
      // First update status to approved
      const statusResponse = await fetch(`http://localhost:8000/api/submissions/${selectedSubmission.id}/status`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "approved",
          notes: "Document approved by Legal Counsel",
        }),
      });

      if (!statusResponse.ok) {
        setMessage("Failed to approve document. Please try again.");
        return;
      }

      // Then generate notarization form
      const notarizationResponse = await fetch(`http://localhost:8000/api/submissions/${selectedSubmission.id}/notarization-form`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (notarizationResponse.ok) {
        setMessage("Document approved. Notarization Form generated successfully.");
        setSubmissions(submissions.filter(s => s.id !== selectedSubmission.id));
        setSelectedSubmission(null);
      } else {
        setMessage("Document approved. Notarization Form generation pending.");
        setSubmissions(submissions.filter(s => s.id !== selectedSubmission.id));
        setSelectedSubmission(null);
      }
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
      const token = localStorage.getItem("sb-access-token");
      const response = await fetch(`http://localhost:8000/api/submissions/${selectedSubmission.id}/status`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "corrections_needed",
          notes: legalComments,
          metadata: { legal_comments: legalComments },
        }),
      });

      if (response.ok) {
        setMessage("Document returned to Department Staff for corrections.");
        setSubmissions(submissions.filter(s => s.id !== selectedSubmission.id));
        setSelectedSubmission(null);
        setLegalComments("");
      } else {
        setMessage("Failed to return document. Please try again.");
      }
    } catch (error) {
      setMessage("Failed to return document. Please try again.");
    }
  }

  return (
    <section className="page split-page legal-page">
      <div>
        <PageTitle title="Review Queue" subtitle="Manage and audit documents explicitly routed for your counsel." />
        <FilterBar labels={["All Routed", "Urgent"]} />
        <Panel title="Routed Documents">
          {loading ? (
            <p style={{ padding: "24px" }}>Loading submissions...</p>
          ) : (
            <DataTable 
              headers={["Tracking #", "Partner", "Document Type", "Route Date", "Status"]} 
              rows={submissions.map(s => [
                s.tracking_number || s.id.slice(0, 8),
                s.partner_institution_name,
                s.agreement_type,
                new Date(s.created_at).toLocaleDateString(),
                s.status,
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
      </div>
      <aside className="review-sidebar">
        <h2>Review Sidebar</h2>
        {selectedSubmission ? (
          <>
            <div className="dropzone">
              <FileText />
              <b>{selectedSubmission.file_name || "Document.pdf"}</b>
              <p>{selectedSubmission.agreement_type} - {new Date(selectedSubmission.created_at).toLocaleDateString()}</p>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <p><strong>Partner:</strong> {selectedSubmission.partner_institution_name}</p>
              <p><strong>Agreement:</strong> {selectedSubmission.agreement_title || selectedSubmission.agreement_type}</p>
              <p><strong>Office:</strong> {selectedSubmission.office}</p>
              <p><strong>Urgency:</strong> {selectedSubmission.urgency_level}</p>
            </div>
            <label>Legal Comments
              <textarea 
                placeholder="Enter findings and required corrections..." 
                value={legalComments}
                onChange={(e) => setLegalComments(e.target.value)}
                rows={6}
              />
            </label>
            <label className="checkline"><input type="checkbox" /> Compliance Verified</label>
            {message && <p style={{ marginTop: "16px", color: message.includes("Failed") ? "red" : "green" }}>{message}</p>}
            <footer>
              <button className="outline danger" onClick={handleReturnForCorrections}>Return for Corrections</button>
              <button onClick={handleApprove}>Approve</button>
            </footer>
          </>
        ) : (
          <p style={{ padding: "24px" }}>Select a submission to review.</p>
        )}
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
