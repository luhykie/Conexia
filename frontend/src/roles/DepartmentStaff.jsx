import React from "react";
import { Eye, FileText, UploadCloud } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { DashboardView, Dropzone, ExpiryView, FilterBar, NotificationsView } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { DocumentFilesPanel } from "../components/DocumentFilesPanel";
import {
  createDraftSubmission,
  getSubmission,
  getSubmissionFile,
  getSubmissionReviewData,
  listSubmissions,
  updateSubmission,
  uploadSubmissionAttachment,
} from "../services/submissions";
import { reportClientError } from "../utils/reportClientError";
import { useNavigate } from "react-router-dom";

export function DepartmentStaff({ page, account }) {
  const navigate = useNavigate();

  if (page === "submission") return <SubmissionPage account={account} navigate={navigate} />;
  if (page === "submissions") return <MySubmissionsPage account={account} navigate={navigate} />;
  if (page === "engagements") return <EngagementsPage />;
  if (page === "expiry") return <ExpiryView action="Manual Update" />;
  if (page === "notifications") return <NotificationsView />;

  return (
    <DashboardView
      roleKey="department"
      title="Institutional Workspace"
      subtitle={`Welcome back, ${account?.name || account?.fullName || "Department Staff"}. Here is the real-time status for your department.`}
      action="New Submission"
      onAction={() => navigate("/app/submission")}
    />
  );
}

function SubmissionPage({ account, navigate }) {
  const [form, setForm] = React.useState({
    partnerInstitutionName: "",
    agreementType: "Memorandum of Agreement (MOA)",
    submissionType: "new_partnership",
    partnerClassification: "local",
    trackingNumber: "",
    expectedDuration: "5 Years (Standard)",
    partnerContactEmail: "",
    contactPerson: "",
    contactPosition: "",
    contactNumber: "",
    requestedCompletionDate: "",
    urgencyLevel: "normal",
    requestedByName: account?.name || account?.fullName || "",
    requestedByDate: new Date().toISOString().split("T")[0],
    notedByName: "",
    notedByDate: "",
    agreementTitle: "",
    description: "",
  });

  const [submissionId, setSubmissionId] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [loadingExisting, setLoadingExisting] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  React.useEffect(() => {
    const activeId = sessionStorage.getItem("department-active-submission-id") || localStorage.getItem("department-active-submission-id") || "";
    if (!activeId) return;

    setLoadingExisting(true);
    setSubmissionId(activeId);

    (async () => {
      try {
        const response = await getSubmission(activeId);
        const draft = response?.data || null;
        if (!draft) return;

        setForm((prev) => ({
          ...prev,
          partnerInstitutionName: draft.partner_institution_name || prev.partnerInstitutionName,
          agreementType: draft.agreement_type || prev.agreementType,
          submissionType: draft.submission_type || prev.submissionType,
          partnerClassification: draft.partner_classification || prev.partnerClassification,
          trackingNumber: draft.tracking_number || prev.trackingNumber,
          expectedDuration: draft.expected_duration || prev.expectedDuration,
          partnerContactEmail: draft.partner_contact_email || prev.partnerContactEmail,
          contactPerson: draft.contact_person || prev.contactPerson,
          contactPosition: draft.contact_position || prev.contactPosition,
          contactNumber: draft.contact_number || prev.contactNumber,
          requestedCompletionDate: draft.requested_completion_date || prev.requestedCompletionDate,
          urgencyLevel: draft.urgency_level || prev.urgencyLevel,
          requestedByName: draft.requested_by_name || prev.requestedByName,
          requestedByDate: draft.requested_by_date || prev.requestedByDate,
          notedByName: draft.noted_by_name || prev.notedByName,
          notedByDate: draft.noted_by_date || prev.notedByDate,
          agreementTitle: draft.agreement_title || prev.agreementTitle,
          description: draft.description || prev.description,
        }));
        setSuccessMessage("Loaded existing submission. Update the fields and upload a replacement PDF if needed.");
      } catch (requestError) {
        reportClientError("Unable to load department submission:", requestError);
        setError(requestError.message);
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [account]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccessMessage("");
  }

  async function ensureSubmissionId() {
    if (submissionId) return submissionId;

    const response = await createDraftSubmission({
      agreement_type: form.agreementType,
      submission_type: form.submissionType,
      partner_classification: form.partnerClassification,
      title: form.agreementTitle || form.partnerInstitutionName || form.agreementType,
      agreement_title: form.agreementTitle || form.partnerInstitutionName || form.agreementType,
      partner_institution_name: form.partnerInstitutionName,
      requested_by_name: form.requestedByName,
      office: account?.office,
      department: account?.department,
      tracking_number: form.trackingNumber || undefined,
      requested_by_date: form.requestedByDate,
      noted_by_name: form.notedByName,
      noted_by_date: form.notedByDate,
      contact_person: form.contactPerson,
      contact_position: form.contactPosition,
      contact_number: form.contactNumber,
      partner_contact_email: form.partnerContactEmail,
      contact_email: form.partnerContactEmail,
      requested_completion_date: form.requestedCompletionDate || null,
      urgency_level: form.urgencyLevel,
      description: form.description || null,
      draft: true,
    });

    const draft = response?.data?.[0] || response?.data || null;
    const id = draft?.id || draft?.submission_id || draft?.submissionId || draft?.data?.id;
    if (!id) throw new Error("Unable to create the draft submission.");

    setSubmissionId(id);
    localStorage.setItem("department-active-submission-id", id);
    sessionStorage.setItem("department-active-submission-id", id);
    return id;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.partnerInstitutionName.trim() || !form.partnerContactEmail.trim()) {
      setError("Partner institution name and contact email are required for review submission.");
      return;
    }

    if (!file) {
      setError("Please attach a document before submitting for review.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const activeId = await ensureSubmissionId();
      await uploadSubmissionAttachment(activeId, file);
      await updateSubmission(activeId, {
        title: form.agreementTitle || form.partnerInstitutionName,
        partner_institution_name: form.partnerInstitutionName,
        agreement_type: form.agreementType,
        submission_type: form.submissionType,
        partner_classification: form.partnerClassification,
        tracking_number: form.trackingNumber || undefined,
        agreement_title: form.agreementTitle || form.partnerInstitutionName,
        expected_duration: form.expectedDuration,
        contact_email: form.partnerContactEmail,
        partner_contact_email: form.partnerContactEmail,
        contact_person: form.contactPerson,
        contact_position: form.contactPosition,
        contact_number: form.contactNumber,
        requested_completion_date: form.requestedCompletionDate || null,
        urgency_level: form.urgencyLevel,
        requested_by_name: form.requestedByName,
        requested_by_date: form.requestedByDate,
        noted_by_name: form.notedByName,
        noted_by_date: form.notedByDate,
        description: form.description || null,
        status: "pending_iro_staff_review",
        current_stage: "iro_staff",
      });

      setSuccessMessage("Submission sent for review and routed to IRO Staff.");
      setFile(null);
      sessionStorage.removeItem("department-active-submission-id");
      localStorage.removeItem("department-active-submission-id");
      setSubmissionId("");
      navigate?.("/app/submissions");
    } catch (requestError) {
      reportClientError("Submission failed:", requestError);
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page department-page">
      <PageTitle
        title="Submit New Document"
        subtitle={`Initiate a formal review process from ${account?.office || "your department"}.`}
      />

      <form onSubmit={handleSubmit}>
        <div className="two-col">
          <div>
            <div className="steps">
              <span className="on">1<b>Partner Info</b></span>
              <span>2<b>Upload</b></span>
              <span>3<b>Confirmation</b></span>
            </div>

            {loadingExisting && <div className="auth-status ready">Loading existing submission...</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}
            {error && <div className="auth-error">{error}</div>}

            <Panel title="Partner Institution Details">
              <div className="form-grid">
                <label>Partner Institution Name<input value={form.partnerInstitutionName} onChange={(e) => updateField("partnerInstitutionName", e.target.value)} placeholder="e.g. Global Tech University" required /></label>
                <label>Agreement Type
                  <select value={form.agreementType} onChange={(e) => updateField("agreementType", e.target.value)}>
                    <option value="Memorandum of Agreement (MOA)">Memorandum of Agreement (MOA)</option>
                    <option value="Memorandum of Understanding (MOU)">Memorandum of Understanding (MOU)</option>
                    <option value="Memorandum of Funding (MOF)">Memorandum of Funding (MOF)</option>
                  </select>
                </label>
                <label>Submission Type
                  <select value={form.submissionType} onChange={(e) => updateField("submissionType", e.target.value)}>
                    <option value="new_partnership">New Partnership</option>
                    <option value="renewal">Renewal</option>
                  </select>
                </label>
                <label>Partner Classification
                  <select value={form.partnerClassification} onChange={(e) => updateField("partnerClassification", e.target.value)}>
                    <option value="local">Local</option>
                    <option value="international">International</option>
                  </select>
                </label>
                <label>Partner Contact Email<input value={form.partnerContactEmail} onChange={(e) => updateField("partnerContactEmail", e.target.value)} type="email" placeholder="contact@partner.edu" /></label>
                <label>Contact Person<input value={form.contactPerson} onChange={(e) => updateField("contactPerson", e.target.value)} placeholder="Contact person" /></label>
                <label>Contact Position<input value={form.contactPosition} onChange={(e) => updateField("contactPosition", e.target.value)} placeholder="Position" /></label>
                <label>Contact Number<input value={form.contactNumber} onChange={(e) => updateField("contactNumber", e.target.value)} placeholder="Contact number" /></label>
                <label>Expected Duration
                  <select value={form.expectedDuration} onChange={(e) => updateField("expectedDuration", e.target.value)}>
                    <option value="5 Years (Standard)">5 Years (Standard)</option>
                    <option value="3 Years">3 Years</option>
                    <option value="1 Year">1 Year</option>
                  </select>
                </label>
                <label>Requested Completion Date<input value={form.requestedCompletionDate} onChange={(e) => updateField("requestedCompletionDate", e.target.value)} type="date" /></label>
                <label>Requested By Name<input value={form.requestedByName} onChange={(e) => updateField("requestedByName", e.target.value)} /></label>
                <label>Requested By Date<input value={form.requestedByDate} onChange={(e) => updateField("requestedByDate", e.target.value)} type="date" /></label>
                <label>Noted By Name<input value={form.notedByName} onChange={(e) => updateField("notedByName", e.target.value)} /></label>
                <label>Noted By Date<input value={form.notedByDate} onChange={(e) => updateField("notedByDate", e.target.value)} type="date" /></label>
                <label className="full-width">Agreement Title<input value={form.agreementTitle} onChange={(e) => updateField("agreementTitle", e.target.value)} placeholder="Agreement title" /></label>
                <label className="full-width">Description<textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Briefly describe the agreement." rows="4" /></label>
              </div>
            </Panel>

            <Panel title="Document Upload Section">
              <Dropzone label={file?.name || "Drag and drop agreement draft here"} detail="PDF, DOCX, ODT - MAX 25MB" />
              <input type="file" accept=".pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text" disabled={submitting} onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </Panel>
          </div>

          <aside className="summary-card">
            <h2>Review Summary</h2>
            <p>Intended Partner: <b>{form.partnerInstitutionName || "---"}</b></p>
            <p>Agreement Class: <b>{form.agreementType}</b></p>
            <p>Submission Type: <b>{form.submissionType === "renewal" ? "Renewal" : "New Partnership"}</b></p>
            <p>Partner Classification: <b>{form.partnerClassification === "international" ? "International" : "Local"}</b></p>
            <p>Processing Office: <b>{account?.office || "Assigned Department"}</b></p>
            <button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit for Review"} {!submitting && <UploadCloud size={18} />}</button>
            <button type="button" className="outline" disabled={submitting} onClick={() => setSuccessMessage("Draft saving remains available through the loaded submission flow.")}>Save as Draft</button>
          </aside>
        </div>
      </form>
    </section>
  );
}

function MySubmissionsPage({ account, navigate }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedSubmission, setSelectedSubmission] = React.useState(null);
  const [submissionDetails, setSubmissionDetails] = React.useState(null);
  const [reviewData, setReviewData] = React.useState({ comments: [], annotations: [] });

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await listSubmissions({ submitted_by: account?.id ? `eq.${account.id}` : undefined });
        const data = response?.data || response || [];
        setRows((data || []).map((row) => ([
          <b key={`tn-${row.id}`}>{row.tracking_number || String(row.id).slice(0, 8)}</b>,
          row.partner_institution_name || row.partner_institution || "-",
          row.agreement_type || "MOA",
          row.submission_type === "renewal" ? "Renewal" : "New Engagement",
          row.partner_classification === "international" ? "International" : "Local",
          row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
          <span key={`status-${row.id}`} className="badge">{row.status || "-"}</span>,
          <button key={`view-${row.id}`} className="table-action" type="button" onClick={() => openDrawer(row)}>View</button>,
          <button key={`edit-${row.id}`} className="table-action" type="button" onClick={() => {
            sessionStorage.setItem("department-active-submission-id", row.id);
            localStorage.setItem("department-active-submission-id", row.id);
            navigate("/app/submission");
          }}>Edit</button>,
        ])));
      } catch (err) {
        setMessage(err.message || "Unable to load submissions.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  async function openDrawer(row) {
    setDrawerOpen(true);
    setSubmissionDetails(row);
    try {
      const [submissionResult, reviewResult] = await Promise.allSettled([
        getSubmission(row.id),
        getSubmissionReviewData(row.id),
      ]);
      if (submissionResult.status === "fulfilled") {
        setSubmissionDetails(submissionResult.value?.data || row);
      }
      if (reviewResult.status === "fulfilled") {
        setReviewData(reviewResult.value?.data || { comments: [], annotations: [] });
      }
    } catch {}
  }

  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle
          title="My Submissions"
          subtitle="Real-time tracking of institutional documents and partner agreements."
          action="New Submission"
          onAction={() => navigate("/app/submission")}
        />
        <Panel title="Submission Records">
          {loading ? <p>Loading submissions...</p> : null}
          {message ? <p className="auth-error">{message}</p> : null}
          {!loading && !message && (
            <DataTable headers={["Tracking #", "Partner", "Agreement Type", "Submission Type", "Partner Classification", "Submitted Date", "Status", "Action", "Edit"]} rows={rows} />
          )}
        </Panel>
      </div>

      {drawerOpen && (
        <aside className="detail-drawer">
          <h2>Submission Details</h2>
          {submissionDetails ? (
            <>
              <p><b>Tracking #:</b> {submissionDetails.tracking_number}</p>
              <p><b>Partner:</b> {submissionDetails.partner_institution_name || submissionDetails.partner_institution}</p>
              <p><b>Agreement Type:</b> {submissionDetails.agreement_type || "MOA"}</p>
              <p><b>Submission Type:</b> {submissionDetails.submission_type === "renewal" ? "Renewal" : "New Engagement"}</p>
              <p><b>Status:</b> {submissionDetails.status}</p>
              {submissionDetails.description && <p><b>Description:</b> {submissionDetails.description}</p>}
              <DocumentFilesPanel documentId={submissionDetails.id} canUpload={["draft", "revision_required", "legal_revision_required", "pending_iro_staff_review"].includes(submissionDetails.status)} canDelete={["draft", "revision_required", "legal_revision_required", "pending_iro_staff_review"].includes(submissionDetails.status)} />
              <h3>Review History</h3>
              {Array.isArray(reviewData.comments) && reviewData.comments.length ? reviewData.comments.map((comment) => (
                <div className="timeline-item" key={comment.id}>
                  <b>{comment.created_by_name || comment.role || "Reviewer"}</b>
                  <p>{comment.comment}</p>
                </div>
              )) : <p>No review comments yet.</p>}
            </>
          ) : <p>Select a submission to view status.</p>}
        </aside>
      )}
    </section>
  );
}

function EngagementsPage() {
  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle title="Engagements Management" subtitle="Oversee institutional partnerships and document compliance for your office." action="Create Engagement" />
        <FilterBar labels={["All Institutions", "All", "Active", "Pending", "Expiring"]} />
        <Panel title="Partner Engagements">
          <DataTable headers={["Partner Organization", "Agreement", "Duration", "Documents", "Status"]} rows={[]} />
        </Panel>
      </div>
    </section>
  );
}
