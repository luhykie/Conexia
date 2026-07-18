import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, FileText, Gavel, ShieldCheck } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { DashboardView, ExpiryView, FilterBar } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { supabase } from "../supabaseClient";
import { isSupabaseConfigured } from "../supabaseConfig";

const LEGAL_STATUS_MAP = {
  pendingReview: ["Pending Review", "Under Legal Review"],
  pendingNotarization: ["Pending Notarization"],
  approved: ["Approved"],
  correctionsSent: ["Corrections Needed"],
};

// Routes all Legal Counsel pages through one role-owned component.
export function LegalCounsel({ page }) {
  if (page === "review") return <ReviewQueue />;
  if (page === "notarization") return <NotarizationTracker />;
  if (page === "expiry") return <ExpiryView title="Institutional Workspace" action="New Submission" />;
  if (page === "history") return <ActionHistory />;

  return <LegalDashboard />;
}

function LegalDashboard() {
  const navigate = useNavigate();
  const [workflowCounts, setWorkflowCounts] = React.useState({
    pendingReview: 0,
    pendingNotarization: 0,
    approved: 0,
    correctionsSent: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;

    async function loadDashboardStats() {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setError("Dashboard statistics are unavailable until Supabase is configured.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await fetchWorkflowStatusRows();

        if (!isMounted) {
          return;
        }

        setWorkflowCounts(getWorkflowCounts(data || []));
      } catch (loadError) {
        console.error("Failed to load legal dashboard statistics:", loadError);
        if (isMounted) {
          setError("Unable to load legal counsel statistics. Please try again later.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = [
    [loading ? "..." : workflowCounts.pendingReview.toString(), "Pending Review", CalendarClock, "Priority", "warn"],
    [loading ? "..." : workflowCounts.pendingNotarization.toString(), "Pending Notarization", Gavel, "Staged", "blue"],
    [loading ? "..." : workflowCounts.approved.toString(), "Approved", ShieldCheck, "Complete"],
    [loading ? "..." : workflowCounts.correctionsSent.toString(), "Corrections Sent", FileText, "Action Req", "danger"],
  ];

  function handleStatusClick(label) {
    const page = label === "Pending Notarization" ? "notarization" : "review";
    const status = label === "Corrections Sent" ? "Corrections Needed" : label;

    navigate(`/app/${page}?status=${encodeURIComponent(status)}`);
  }

  const statusBanner = error ? (
    <div className="dashboard-alert danger">{error}</div>
  ) : loading ? (
    <div className="dashboard-alert loading">Refreshing dashboard statistics...</div>
  ) : null;

  return (
    <DashboardView
      roleKey="legal"
      title="Legal Counsel Dashboard"
      subtitle="Prioritized legal review, approval, return, and notarization workload."
      action="Open Document"
      stats={stats}
      onCardClick={handleStatusClick}
      statusBanner={statusBanner}
    />
  );
}

function getWorkflowCounts(rows) {
  return rows.reduce(
    (counts, row) => {
      const status = String(row.workflow_status || "").trim().toLowerCase();

      if (LEGAL_STATUS_MAP.pendingReview.some((candidate) => candidate.toLowerCase() === status)) {
        counts.pendingReview += 1;
      } else if (LEGAL_STATUS_MAP.pendingNotarization.some((candidate) => candidate.toLowerCase() === status)) {
        counts.pendingNotarization += 1;
      } else if (LEGAL_STATUS_MAP.approved.some((candidate) => candidate.toLowerCase() === status)) {
        counts.approved += 1;
      } else if (LEGAL_STATUS_MAP.correctionsSent.some((candidate) => candidate.toLowerCase() === status)) {
        counts.correctionsSent += 1;
      }

      return counts;
    },
    {
      pendingReview: 0,
      pendingNotarization: 0,
      approved: 0,
      correctionsSent: 0,
    }
  );
}

async function fetchWorkflowStatusRows() {
  if (!supabase) {
    throw new Error("Supabase client is not initialized.");
  }

  const candidateTables = ["documents", "submissions", "workflow_documents", "legal_documents"];

  for (const table of candidateTables) {
    const { data, error } = await supabase.from(table).select("workflow_status").range(0, 9999);

    if (!error) {
      return data || [];
    }

    if (typeof error.message === "string" && /relation .* does not exist|table .* does not exist/i.test(error.message)) {
      continue;
    }

    throw error;
  }

  throw new Error("Unable to locate a Supabase table with a workflow_status field.");
}

// Provides a legal review queue with a side panel for findings and decisions.
function ReviewQueue() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const rows = [
    ["#CX-88219", "Global Logistics Corp", "Draft MOA", "Oct 12, 2023", "Pending Review"],
    ["#CX-88224", "Artemis Ventures", "MOU Amendment", "Oct 14, 2023", "Pending Review"],
    ["#CX-88231", "Pacific Energy", "ND Agreement", "Oct 15, 2023", "Pending Review"],
    ["#CX-88240", "Standard Bank Ltd", "Loan Framework", "Oct 16, 2023", "Pending Review"],
    ["#CX-88245", "Borealis Ltd", "Asset Transfer Addendum", "Oct 17, 2023", "Corrections Needed"],
    ["#CX-88251", "Vertex Logistics Corp", "Renewal Agreement", "Oct 18, 2023", "Approved"],
  ];
  const filteredRows = statusFilter ? rows.filter((row) => row[4] === statusFilter) : rows;

  return (
    <section className="page split-page legal-page">
      <div>
        <PageTitle title="Review Queue" subtitle="Manage and audit documents explicitly routed for your counsel." />
        <FilterBar labels={["All Routed", "Urgent"]} />
        <Panel title={statusFilter ? `${statusFilter} Documents` : "Routed Documents"}>
          <DataTable headers={["Tracking #", "Partner", "Document Type", "Route Date", "Status"]} rows={filteredRows} />
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
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const rows = [
    ["#DOC-2024-881", "Sterling-Cooper Ltd.", "Pending Notarization", "2h ago", "Record"],
    ["#DOC-2024-879", "Arasaka Corp.", "Notarized", "Yesterday", "View"],
    ["#DOC-2024-875", "Weyland-Yutani", "Pending Notarization", "3 days ago", "Record"],
    ["#DOC-2024-870", "Massive Dynamic", "Notarized", "1 week ago", "View"],
  ];
  const filteredRows = statusFilter ? rows.filter((row) => row[2] === statusFilter) : rows;

  return (
    <section className="page legal-page">
      <PageTitle title="Notarization Tracker" subtitle="Track pending notarization records and completed notarial entries." />
      <StatGrid stats={[
        ["42", "Total Queue", Gavel],
        ["18", "Pending Approval", CalendarClock, "", "blue"],
        ["124", "Completed (MTD)", CheckCircle2],
      ]} />
      <div className="two-col">
        <Panel title={statusFilter ? `${statusFilter} Documents` : "Document Tracking Queue"}>
          <DataTable headers={["Document ID", "Entity / Client", "Status", "Last Activity", "Action"]} rows={filteredRows} />
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
