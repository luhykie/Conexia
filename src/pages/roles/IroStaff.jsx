import React from "react";
import { CheckCircle2, Clock3, Download, FileText, Folder, Gauge } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { PageTitle } from "../../components/PageTitle";
import { Panel } from "../../components/Panel";
import { DashboardView, Dropzone, ExpiryView, ExportButton, FilterBar } from "../../components/SharedViews";
import { StatGrid } from "../../components/StatGrid";
import { supabase } from "../../lib/supabaseClient";
import { isMissingSubmissionsTableError, listLocalSubmissions, updateLocalSubmission } from "../../lib/submissionFallback";

// Routes all IRO Staff pages through one role-owned component.
export function IroStaff({ page, setPage }) {
  if (page === "incoming") return <IncomingSubmissions setPage={setPage} />;
  if (page === "log-review") return <LogReview setPage={setPage} />;
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

// Shows all newly received submissions requiring IRO Staff processing.
function IncomingSubmissions({ setPage }) {
  const [rows, setRows] = React.useState([]);
  const [submissions, setSubmissions] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadIncoming() {
      const toRow = (row) => [
        String(row.id).slice(0, 8),
        row.office,
        row.partner_institution_name,
        row.agreement_type,
        new Date(row.created_at).toLocaleDateString(),
        row.status,
        <button className="outline" type="button" onClick={() => {
          setSelectedId(row.id);
          setPage?.("log-review");
        }}>Review</button>,
      ];

      if (!supabase) {
        const local = listLocalSubmissions((row) => row.status === "under_review");
        setSubmissions(local);
        setRows(local.map(toRow));
        setSelectedId(local[0]?.id || null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("submissions")
        .select("id, office, partner_institution_name, agreement_type, created_at, status")
        .eq("status", "under_review")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSubmissions(data);
        setRows(data.map(toRow));
        setSelectedId(data[0]?.id || null);
      } else if (error && isMissingSubmissionsTableError(error)) {
        const local = listLocalSubmissions((row) => row.status === "under_review");
        setSubmissions(local);
        setRows(local.map(toRow));
        setSelectedId(local[0]?.id || null);
      }

      setLoading(false);
    }

    loadIncoming();
  }, []);

  return (
    <section className="page iro-staff-page">
      <PageTitle title="Incoming Queue" subtitle="Receive submissions routed from Department Staff." />
      <StatGrid stats={[
        [`${rows.length}`, "Total Pending", Folder, "+New"],
        ["Under Review", FileText, "Review and log submissions before sending to IRO Admin"],
      ]} />
      <FilterBar labels={["All Departments", "All Statuses", "Submitted Only"]} />
      <div className="two-col">
        <Panel title="Active Submissions" tools={<ExportButton label="Export CSV" />}>
          {loading ? (
            <p style={{ padding: 24 }}>Loading submissions...</p>
          ) : rows.length ? (
            <DataTable headers={["Tracking #", "Department", "Document Type", "Date Submitted", "Status", "Action"]} rows={rows} />
          ) : (
            <p style={{ padding: 24 }}>No submissions are currently awaiting staff review.</p>
          )}
        </Panel>
        <aside className="detail-drawer">
          <h2>Submission Preview</h2>
          {submissions.length ? (
            (() => {
              const preview = submissions.find((item) => item.id === selectedId) || submissions[0];
              return (
                <div className="doc-preview">
                  <h3>{preview.partner_institution_name}</h3>
                  <p><strong>Office:</strong> {preview.office}</p>
                  <p><strong>Department:</strong> {preview.department || "---"}</p>
                  <p><strong>Agreement Type:</strong> {preview.agreement_type}</p>
                  <p><strong>Submitted:</strong> {new Date(preview.created_at).toLocaleString()}</p>
                  <p><strong>Status:</strong> <b>{preview.status}</b></p>
                  <button className="primary wide-inline" type="button" onClick={() => setPage?.("log-review")}>
                    Open for Review
                  </button>
                </div>
              );
            })()
          ) : (
            <p>No submission selected.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

// Gives IRO Staff a document preview plus administrative completeness checklist.
function LogReview({ setPage }) {
  const [submission, setSubmission] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    async function loadSubmission() {
      if (!supabase) {
        const [first] = listLocalSubmissions((row) => row.status === "under_review");
        if (first) {
          setSubmission(first);
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, office, department, partner_institution_name, agreement_type, expected_duration, partner_contact_email, status, created_at"
        )
        .eq("status", "under_review")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setSubmission(data);
      } else if (error && isMissingSubmissionsTableError(error)) {
        const [first] = listLocalSubmissions((row) => row.status === "under_review");
        if (first) {
          setSubmission(first);
        }
      }
      setLoading(false);
    }

    loadSubmission();
  }, []);

  async function handleMarkLogged() {
    if (!submission) return;

    if (!supabase) {
      updateLocalSubmission(submission.id, (row) => ({ ...row, status: "logged", updated_at: new Date().toISOString() }));
      setMessage("Submission marked logged and routed to IRO Admin.");
      setSubmission({ ...submission, status: "logged" });
      return;
    }

    const { error } = await supabase
      .from("submissions")
      .update({ status: "logged" })
      .eq("id", submission.id);

    if (error) {
      if (!isMissingSubmissionsTableError(error)) {
        setMessage("Unable to mark logged. Please try again.");
        return;
      }

      updateLocalSubmission(submission.id, (row) => ({ ...row, status: "logged", updated_at: new Date().toISOString() }));
    }

    setMessage("Submission marked logged and routed to IRO Admin.");
    setSubmission({ ...submission, status: "logged" });
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
                <p><strong>Agreement Type:</strong> {submission.agreement_type}</p>
                <p><strong>Office:</strong> {submission.office}</p>
                <p><strong>Department:</strong> {submission.department}</p>
                <p><strong>Submitted:</strong> {new Date(submission.created_at).toLocaleString()}</p>
                <p><strong>Contact:</strong> {submission.partner_contact_email}</p>
                <p>Status: <b>{submission.status}</b></p>
              </div>
            ) : (
              <p style={{ padding: 24 }}>No submissions are currently awaiting staff review.</p>
            )}
          </Panel>
        </div>
        <aside className="review-sidebar">
          <h2>Completeness Check</h2>
          { ["Partner Details Verified", "Signatory Identified", "Standard Template Used"].map((item) => (
            <label className="checkline" key={item}><input type="checkbox" /> {item}</label>
          )) }
          <label>Internal Staff Notes<textarea placeholder="Any initial observations for the reviewer..." /></label>
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

// Tracks submission stage history from receipt through legal review.
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
            <footer><span>MOA (Institutional)</span><span>Engineering Dept.</span><b>Time in Current Status {time}</b></footer>
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
        <button className="primary wide-inline"><Download size={18} /> Generate Export Log</button>
      </aside>
    </section>
  );
}
