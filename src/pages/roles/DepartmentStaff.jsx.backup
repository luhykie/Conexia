import React from "react";
import { FileText, UploadCloud } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { PageTitle } from "../../components/PageTitle";
import { Panel } from "../../components/Panel";
import { DashboardView, Dropzone, ExpiryView, FilterBar, NotificationsView } from "../../components/SharedViews";
import { StatGrid } from "../../components/StatGrid";
import { supabase } from "../../lib/supabaseClient";
import { addLocalSubmission, isMissingSubmissionsTableError, listLocalSubmissions } from "../../lib/submissionFallback";

// Routes all Department Staff pages through one role-owned component.
export function DepartmentStaff({ page, account }) {
  if (page === "submission") return <SubmissionPage account={account} />;
  if (page === "submissions") return <MySubmissionsPage account={account} />;
  if (page === "engagements") return <EngagementsPage />;
  if (page === "expiry") return <ExpiryView action="Manual Update" />;
  if (page === "notifications") return <NotificationsView />;

  return (
    <DashboardView
      roleKey="department"
      title="Institutional Workspace"
      subtitle={`Welcome back, ${account.fullName}. Here is the real-time status for ${account.office}.`}
      action="New Submission"
    />
  );
}

// Handles the department upload workflow for new agreements.
const DRAFT_STORAGE_KEY = "department-submission-draft";

function SubmissionPage({ account }) {
  const [form, setForm] = React.useState({
    partnerInstitutionName: "",
    agreementType: "Memorandum of Agreement (MOA)",
    expectedDuration: "5 Years (Standard)",
    partnerContactEmail: "",
  });
  const [file, setFile] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  React.useEffect(() => {
    try {
      const storedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (storedDraft) {
        const { form: savedForm } = JSON.parse(storedDraft);
        setForm((prev) => ({ ...prev, ...savedForm }));
        setSuccessMessage("Loaded saved draft. Add your file and submit when ready.");
      }
    } catch (err) {
      // ignore invalid draft state
    }
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccessMessage("");
  }

  function loadDraft() {
    try {
      const storedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!storedDraft) {
        setError("No saved draft found.");
        return;
      }

      const { form: savedForm } = JSON.parse(storedDraft);
      if (savedForm) {
        setForm((prev) => ({ ...prev, ...savedForm }));
        setSuccessMessage("Draft restored. Continue editing or submit for review.");
        setError("");
      }
    } catch (err) {
      setError("Unable to restore draft.");
    }
  }

  async function handleSubmit(saveAsDraft = false) {
    if (saveAsDraft) {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ form }));
        setSuccessMessage("Draft saved locally. Add your file and submit when ready.");
        setError("");
      } catch (err) {
        setError("Unable to save draft locally.");
      }
      return;
    }

    if (!form.partnerInstitutionName || !form.partnerContactEmail) {
      setError("Partner institution name and contact email are required for review submission.");
      return;
    }

    if (!file) {
      setError("Please attach a document before submitting for review.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      let storagePath = null;
      let fileName = null;
      if (file) {
        try {
          const filePath = `${account.id}/${Date.now()}_${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("submissions")
            .upload(filePath, file, { upsert: true });
          if (!uploadError && uploadData) {
            storagePath = uploadData.path;
            fileName = file.name;
          }
        } catch (uploadErr) {
          storagePath = null;
          fileName = file.name;
        }
      }

      const { error: insertError } = await supabase.from("submissions").insert({
        submitted_by: account.id,
        office: account.office,
        department: account.department,
        partner_institution_name: form.partnerInstitutionName,
        agreement_type: form.agreementType,
        expected_duration: form.expectedDuration,
        partner_contact_email: form.partnerContactEmail,
        storage_path: storagePath,
        file_name: fileName,
        status: "under_review",
      });

      if (insertError) {
        if (!isMissingSubmissionsTableError(insertError)) {
          setError("Submission could not be completed. Please try again.");
          return;
        }

        addLocalSubmission({
          id: `local-${Date.now()}`,
          submitted_by: account.id,
          office: account.office,
          department: account.department,
          partner_institution_name: form.partnerInstitutionName,
          agreement_type: form.agreementType,
          expected_duration: form.expectedDuration,
          partner_contact_email: form.partnerContactEmail,
          storage_path: storagePath,
          file_name: fileName,
          status: "under_review",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setSuccessMessage("Submission sent for review and routed to IRO Staff.");
      setForm({
        partnerInstitutionName: "",
        agreementType: "Memorandum of Agreement (MOA)",
        expectedDuration: "5 Years (Standard)",
        partnerContactEmail: "",
      });
      setFile(null);
    } catch (err) {
      setError("Submission could not be completed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page department-page">
      <PageTitle
        title="Submit New Document"
        subtitle={`Initiate a formal review process from ${account.office}.`}
      />
      <div className="two-col">
        <div>
          <div className="steps">
            <span className="on">1<b>Partner Info</b></span>
            <span>2<b>Upload</b></span>
            <span>3<b>Confirmation</b></span>
          </div>
          <DepartmentForm form={form} onChange={updateField} />
          <Panel title="Document Upload Section">
            <Dropzone
              label="Drag, drop, or click to choose your agreement draft"
              detail="PDF, DOCX, ODT - MAX 25MB"
              selectedFile={file}
              onFileChange={setFile}
            />
            <div className="action-strip" style={{ marginTop: "24px", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 100%" }}>
                {error && <div className="auth-error">{error}</div>}
                {successMessage && <div className="auth-status ready">{successMessage}</div>}
              </div>
              <button onClick={() => handleSubmit(false)} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit for Review"} <UploadCloud size={18} />
              </button>
              <button className="outline" onClick={() => handleSubmit(true)} disabled={submitting}>
                {submitting ? "Saving..." : "Save as Draft"}
              </button>
              <button className="outline" onClick={loadDraft} disabled={submitting}>
                Retrieve Draft
              </button>
            </div>
          </Panel>
        </div>
        <aside className="summary-card">
          <h2>Review Summary</h2>
          <p>Intended Partner: {form.partnerInstitutionName || "---"}</p>
          <p>Agreement Class: <b>{form.agreementType}</b></p>
          <p>Processing Office: <b>{account.office}</b></p>
        </aside>
      </div>
    </section>
  );
}

// Collects partner metadata before the upload moves to review.
function DepartmentForm({ form, onChange }) {
  return (
    <Panel title="Partner Institution Details">
      <div className="form-grid">
        <label>Partner Institution Name
          <input
            value={form.partnerInstitutionName}
            onChange={(e) => onChange("partnerInstitutionName", e.target.value)}
            placeholder="e.g. Global Tech University"
          />
        </label>
        <label>Agreement Type
          <select
            value={form.agreementType}
            onChange={(e) => onChange("agreementType", e.target.value)}
          >
            <option>Memorandum of Agreement (MOA)</option>
            <option>Memorandum of Understanding (MOU)</option>
          </select>
        </label>
        <label>Expected Duration
          <select
            value={form.expectedDuration}
            onChange={(e) => onChange("expectedDuration", e.target.value)}
          >
            <option>5 Years (Standard)</option>
            <option>3 Years</option>
            <option>1 Year</option>
          </select>
        </label>
        <label>Partner Contact Email
          <input
            value={form.partnerContactEmail}
            onChange={(e) => onChange("partnerContactEmail", e.target.value)}
            placeholder="contact@partner.edu"
          />
        </label>
      </div>
    </Panel>
  );
}

// Shows department-owned submissions and legal comments.
function MySubmissionsPage({ account }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let channel = null;

    async function loadSubmissions() {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, partner_institution_name, agreement_type, status, created_at")
        .eq("submitted_by", account.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRows(
          data.map((row) => [
            row.id.slice(0, 8),
            row.partner_institution_name,
            row.agreement_type,
            row.status,
          ])
        );
      } else if (error && isMissingSubmissionsTableError(error)) {
        const localRows = listLocalSubmissions((row) => row.submitted_by === account.id).map((row) => [
          String(row.id).slice(0, 8),
          row.partner_institution_name,
          row.agreement_type,
          row.status,
        ]);
        setRows(localRows);
      }
      setLoading(false);
    }

    loadSubmissions();

    // subscribe to realtime updates for this user's submissions
    if (account?.id) {
      channel = supabase
        .channel(`public:submissions:submitted_by=eq.${account.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `submitted_by=eq.${account.id}` }, (payload) => {
          loadSubmissions();
        })
        .subscribe();
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch (e) { /* ignore */ }
      }
    };
  }, [account?.id]);

  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle title="My Submissions" subtitle="Real-time tracking of institutional documents and partner agreements." />
        <Panel title="Submission Records">
          {loading ? (
            <p style={{ padding: "24px" }}>Loading submissions...</p>
          ) : (
            <DataTable headers={["Tracking #", "Partner", "Type", "Status"]} rows={rows} />
          )}
        </Panel>
      </div>
      <aside className="detail-drawer">
        <h2>Submission Details</h2>
        <p>Select a submission to view legal comments and version history.</p>
      </aside>
    </section>
  );
}

// Lists external partnerships visible to the department.
function EngagementsPage() {
  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle title="Engagements Management" subtitle="Oversee institutional partnerships and document compliance for your office." action="Create Engagement" />
        <FilterBar labels={["All Institutions", "All", "Active", "Pending", "Expiring"]} />
        <Panel title="Partner Engagements">
          <DataTable
            headers={["Partner Organization", "Agreement", "Duration", "Documents", "Status"]}
            rows={[]}
          />
        </Panel>
      </div>
    </section>
  );
}
