import React from "react";
import { DataTable } from "../../components/DataTable";
import { DocumentReviewViewer } from "../../components/DocumentReviewViewer";
import { PageTitle } from "../../components/PageTitle";
import { Panel } from "../../components/Panel";
import { DashboardView, Dropzone, ExpiryView, FilterBar, NotificationsView } from "../../components/SharedViews";
import { StatGrid } from "../../components/StatGrid";
import { UploadCloud, Eye, Trash2 } from "lucide-react";
import { createDraftSubmission, getSubmission, getSubmissionFile, getSubmissionReviewData, listSubmissions, updateSubmission, updateSubmissionStatus, uploadSubmissionAttachment } from "../../services/submissions";
import { formatTrackingNumber, getSchoolCode, getSchoolLabel, parseTrackingSequence } from "../../utils/school";

// Routes all Department Staff pages through one role-owned component.
export function DepartmentStaff({ page, account, setPage, pageState }) {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  if (page === "submission") return <SubmissionPage account={account} setPage={setPage} pageState={pageState} />;
  if (page === "submissions") return <MySubmissionsPage account={account} setPage={setPage} />;
  if (page === "engagements") return <EngagementsPage />;
  if (page === "expiry") return <ExpiryView action="Manual Update" />;
  if (page === "notifications") return <NotificationsView />;

  return (
    <>
      <DashboardView
        roleKey="department"
        title="Institutional Workspace"
        subtitle={`Welcome back, ${account.fullName}. Here is the real-time status for ${account.office}.`}
        action="New Submission"
        onAction={() => setWizardOpen(true)}
      />
      {wizardOpen && (
        <SubmissionWizard
          account={account}
          onClose={() => setWizardOpen(false)}
          onContinue={async (next) => {
            try {
              const departmentCode = getSchoolCode(account.department || account.office);
              const departmentFilterValue = account.department || account.office || "";
              let nextSequence = 1;
              try {
                const existing = departmentFilterValue
                  ? await listSubmissions(account, { department: `eq.${departmentFilterValue}` })
                  : await listSubmissions(account, {});
                const existingRows = existing?.data || [];
                const highest = existingRows.reduce((max, row) => {
                  const prefix = String(row?.tracking_number || "").split("-")[0].toUpperCase();
                  if (prefix && prefix !== departmentCode) return max;
                  return Math.max(max, parseTrackingSequence(row?.tracking_number));
                }, 0);
                nextSequence = highest + 1;
              } catch (error) {
                nextSequence = 1;
              }

              const trackingNumber = formatTrackingNumber(departmentCode, nextSequence);
              const response = await createDraftSubmission(account, {
                agreement_type: next.agreementType,
                submission_type: next.submissionType,
                partner_classification: next.partnerClassification,
                title: next.agreementType,
                agreement_title: next.agreementType,
                tracking_number: trackingNumber,
                requested_by_name: account.fullName || "",
                office: account.office,
                department: account.department,
              });
              const draft = response?.data?.[0] || response?.data || null;
              const draftId = draft?.id || draft?.submission_id || draft?.submissionId || draft?.data?.id;
              if (!draftId) {
                throw new Error("Unable to create the draft submission.");
              }
              localStorage.setItem("department-active-submission-id", draftId);
              sessionStorage.setItem("department-active-submission-id", draftId);
              sessionStorage.setItem("department-submission-entry", "dashboard");
              sessionStorage.setItem("department-submission-preset", JSON.stringify({
                agreementType: next.agreementType,
                submissionType: next.submissionType,
                partnerClassification: next.partnerClassification,
              }));
              sessionStorage.setItem("department-submission-tracking-number", trackingNumber);
              setWizardOpen(false);
              setPage?.("submission", {
                source: "dashboard",
                preset: {
                  agreementType: next.agreementType,
                  submissionType: next.submissionType,
                  partnerClassification: next.partnerClassification,
                },
              });
            } catch (error) {
              console.error(error);
            }
          }}
        />
      )}
    </>
  );
}

// Handles the department upload workflow for new agreements.

function formatSubmissionStatus(status) {
  const labels = {
    pending_iro_staff_review: "Pending IRO Staff Review",
    approved_by_iro_staff: "Logged by IRO Staff",
    pending_iro_admin_review: "Pending IRO Admin Review",
    legally_approved: "Approved by Legal Counsel",
    legal_revision_required: "Returned for Legal Corrections",
    revision_required: "Revision Required",
    notarized: "Notarized",
    archived: "Archived",
    distributed: "Distributed",
  };

  return labels[status] || status || "Unknown";
}

function statusTone(status) {
  if (["pending_iro_staff_review", "pending_iro_admin_review"].includes(status)) return "warn";
  if (["legal_revision_required", "revision_required"].includes(status)) return "danger";
  if (["approved_by_iro_staff", "legally_approved", "notarized", "archived", "distributed"].includes(status)) return "success";
  return "neutral";
}

function buildSubmissionTimeline(submission) {
  const timeline = [
    {
      label: "Submitted by Department Staff",
      detail: submission?.submitted_at || submission?.created_at || "",
      tone: "info",
    },
  ];

  if (submission?.status === "pending_iro_staff_review") {
    timeline.push({ label: "Waiting for IRO Staff review", detail: "Submission is currently queued.", tone: "warn" });
  }

  if (submission?.status === "pending_iro_admin_review" || submission?.status === "approved_by_iro_staff") {
    timeline.push({
      label: "Reviewed by IRO Staff",
      detail: submission?.notes || "Logged and forwarded to IRO Admin.",
      tone: "success",
    });
    timeline.push({ label: "With IRO Admin", detail: "Awaiting admin review.", tone: "warn" });
  }

  if (submission?.status === "revision_required" || submission?.status === "legal_revision_required") {
    timeline.push({
      label: "Returned with comments",
      detail: submission?.notes || "Please review the admin comments and resubmit.",
      tone: "danger",
    });
  }

  if (submission?.status === "pending_legal_review" || submission?.status === "legal_review") {
    timeline.push({
      label: "Routed to Legal",
      detail: submission?.notes || "Awaiting legal review.",
      tone: "warn",
    });
  }

  if (submission?.status === "legally_approved" || submission?.status === "approved") {
    timeline.push({
      label: "Approved",
      detail: submission?.notes || "Submission approved and ready for archive.",
      tone: "success",
    });
  }

  if (submission?.status === "archived") {
    timeline.push({
      label: "Archived",
      detail: submission?.notes || "Submission moved to archive.",
      tone: "success",
    });
  }

  return timeline;
}

function SubmissionPage({ account, setPage, pageState }) {
  const presetValues = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("department-submission-preset") || "null") || {};
    } catch (error) {
      return {};
    }
  }, [pageState]);

  const [submissionId, setSubmissionId] = React.useState("");
  const [form, setForm] = React.useState({
    partnerInstitutionName: "",
    agreementType: presetValues.agreementType || "",
    submissionType: presetValues.submissionType || "",
    partnerClassification: presetValues.partnerClassification || "",
    trackingNumber: sessionStorage.getItem("department-submission-tracking-number") || "",
    expectedDuration: "5 Years (Standard)",
    partnerContactEmail: "",
        contactPerson: "",
        contactPosition: "",
        contactNumber: "",
        requestedCompletionDate: "",
        urgencyLevel: "normal",
        requestedByName: account.fullName || "",
        requestedByDate: new Date().toISOString().split("T")[0],
        notedByName: "",
        notedByDate: "",
      });
  const [file, setFile] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const isCorrectionMode = pageState?.mode === "correction" || sessionStorage.getItem("department-submission-mode") === "correction";

  function resolveSubmissionId() {
    return (
      pageState?.draftId ||
      submissionId ||
      sessionStorage.getItem("department-active-submission-id") ||
      localStorage.getItem("department-active-submission-id") ||
      ""
    );
  }

  React.useEffect(() => {
    async function loadDraftSubmission() {
      const activeId = pageState?.draftId || sessionStorage.getItem("department-active-submission-id") || localStorage.getItem("department-active-submission-id");
      const preset = (() => {
        try {
          return JSON.parse(sessionStorage.getItem("department-submission-preset") || "null") || {};
        } catch (error) {
          return {};
        }
      })();

      if (!activeId) {
        setSubmissionId("");
        setForm((prev) => ({
          ...prev,
          agreementType: preset.agreementType || "",
          submissionType: preset.submissionType || "",
          partnerClassification: preset.partnerClassification || "",
          trackingNumber: sessionStorage.getItem("department-submission-tracking-number") || prev.trackingNumber || "",
        }));
        return;
      }

      try {
        const response = await getSubmission(account, activeId);
        const draft = response?.data || null;
        if (draft) {
          setSubmissionId(activeId);
          setForm((prev) => ({
            ...prev,
            partnerInstitutionName: draft.partner_institution_name || prev.partnerInstitutionName,
            agreementType: draft.agreement_type || preset.agreementType || prev.agreementType,
            submissionType: draft.submission_type || preset.submissionType || prev.submissionType,
            partnerClassification: draft.partner_classification || preset.partnerClassification || prev.partnerClassification,
            trackingNumber: draft.tracking_number || sessionStorage.getItem("department-submission-tracking-number") || prev.trackingNumber || "",
            agreementTitle: draft.agreement_title || prev.agreementTitle,
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
          }));
          setSuccessMessage(draft.status === "draft" ? "Loaded existing draft. Continue editing your submission." : "Loaded submission. Continue editing or submit when ready.");
        }
      } catch (error) {
        setError(error.message || "Unable to load the draft submission.");
      }
    }

    loadDraftSubmission();
  }, [account, pageState]);

  React.useEffect(() => {
    if (isCorrectionMode) {
      setSuccessMessage("Correction mode: update the fields and replace the PDF if needed, then submit again.");
    }
  }, [isCorrectionMode]);

  async function uploadAttachment(submissionId) {
    if (!file) return { storagePath: null, fileName: null };

    return await uploadSubmissionAttachment(account, submissionId, file);
  }
  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccessMessage("");
  }

  async function ensureDraftSubmissionId() {
    const existingId = resolveSubmissionId();
    if (existingId) {
      return existingId;
    }

    const departmentCode = getSchoolCode(account.department || account.office);
    const trackingNumber = form.trackingNumber || sessionStorage.getItem("department-submission-tracking-number") || formatTrackingNumber(departmentCode, 1);

    const response = await createDraftSubmission(account, {
      agreement_type: form.agreementType,
      submission_type: form.submissionType,
      partner_classification: form.partnerClassification,
      tracking_number: trackingNumber,
      title: form.agreementTitle || form.partnerInstitutionName || form.agreementType,
      agreement_title: form.agreementTitle || form.partnerInstitutionName || form.agreementType,
      partner_institution_name: form.partnerInstitutionName,
      requested_by_name: form.requestedByName,
      office: account.office,
      department: account.department,
    });

    const draft = response?.data?.[0] || response?.data || null;
    const draftId = draft?.id || draft?.submission_id || draft?.submissionId || draft?.data?.id;
    if (!draftId) {
      throw new Error("Unable to create the draft submission.");
    }

    setSubmissionId(draftId);
    localStorage.setItem("department-active-submission-id", draftId);
    sessionStorage.setItem("department-active-submission-id", draftId);
    sessionStorage.setItem("department-submission-tracking-number", trackingNumber);

    return draftId;
  }

  async function saveCurrentDraft() {
    try {
      const activeSubmissionId = await ensureDraftSubmissionId();
      const attachment = file ? await uploadAttachment(activeSubmissionId) : {};
      await updateSubmission(account, activeSubmissionId, {
        title: form.agreementTitle || form.partnerInstitutionName,
        partner_institution_name: form.partnerInstitutionName,
        agreement_type: form.agreementType,
        submission_type: form.submissionType,
        partner_classification: form.partnerClassification,
        tracking_number: form.trackingNumber || sessionStorage.getItem("department-submission-tracking-number") || "",
        agreement_title: form.agreementTitle || form.partnerInstitutionName,
        expected_duration: form.expectedDuration,
        contact_email: form.partnerContactEmail,
        partner_contact_email: form.partnerContactEmail,
        contact_person: form.contactPerson,
        contact_position: form.contactPosition,
        contact_number: form.contactNumber,
        requested_completion_date: form.requestedCompletionDate,
        urgency_level: form.urgencyLevel,
        requested_by_name: form.requestedByName,
        requested_by_date: form.requestedByDate,
        noted_by_name: form.notedByName,
        noted_by_date: form.notedByDate,
        ...(attachment.storagePath ? { storage_path: attachment.storagePath } : {}),
        ...(attachment.fileName ? { file_name: attachment.fileName } : {}),
        ...(attachment.storagePath
          ? {
              attachments: [{
                id: `attachment-${Date.now()}`,
                file_name: attachment.fileName,
                storage_path: attachment.storagePath,
                mime_type: attachment.mimeType,
                file_size: attachment.fileSize,
              }],
            }
          : {}),
        current_stage: "draft",
        status: "draft",
      });
      sessionStorage.setItem("department-submission-entry", "dashboard");
      sessionStorage.setItem("department-active-submission-id", activeSubmissionId);
      setSuccessMessage("Draft saved.");
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to save the draft.");
    }
  }

  async function handleSubmit() {
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
      const activeSubmissionId = await ensureDraftSubmissionId();
      const attachment = await uploadAttachment(activeSubmissionId);

      await updateSubmission(account, activeSubmissionId, {
        title: form.agreementTitle || form.partnerInstitutionName,
        partner_institution_name: form.partnerInstitutionName,
        agreement_type: form.agreementType,
        submission_type: form.submissionType,
        partner_classification: form.partnerClassification,
        tracking_number: form.trackingNumber || sessionStorage.getItem("department-submission-tracking-number") || "",
        agreement_title: form.agreementTitle || form.partnerInstitutionName,
        expected_duration: form.expectedDuration,
        contact_email: form.partnerContactEmail,
        partner_contact_email: form.partnerContactEmail,
        contact_person: form.contactPerson,
        contact_position: form.contactPosition,
        contact_number: form.contactNumber,
        requested_completion_date: form.requestedCompletionDate,
        urgency_level: form.urgencyLevel,
        requested_by_name: form.requestedByName,
        requested_by_date: form.requestedByDate,
        noted_by_name: form.notedByName,
        noted_by_date: form.notedByDate,
        storage_path: attachment.storagePath,
        file_name: attachment.fileName,
        attachments: attachment.storagePath ? [{
          id: `attachment-${Date.now()}`,
          file_name: attachment.fileName,
          storage_path: attachment.storagePath,
          mime_type: attachment.mimeType,
          file_size: attachment.fileSize,
        }] : [],
        status: "pending_iro_staff_review",
        current_stage: "iro_staff",
      });

      setSuccessMessage("Submission sent for review and routed to IRO Staff.");
      setFile(null);
      sessionStorage.setItem("department-active-submission-id", activeSubmissionId);
      localStorage.removeItem("department-active-submission-id");
      sessionStorage.removeItem("department-active-submission-id");
      sessionStorage.removeItem("department-submission-entry");
      sessionStorage.removeItem("department-submission-preset");
      sessionStorage.removeItem("department-submission-tracking-number");
      sessionStorage.removeItem("department-submission-mode");
      setSubmissionId("");
      setPage?.("submissions");
    } catch (err) {
      setError(err?.message || "Submission could not be completed. Please try again.");
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
        {isCorrectionMode && (
          <div className="auth-status ready" style={{ marginBottom: "16px" }}>
            This submission was returned for corrections. Update any fields below and upload a replacement PDF if needed.
          </div>
        )}
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
              <button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit"} <UploadCloud size={18} />
              </button>
              <button className="outline" onClick={saveCurrentDraft} disabled={submitting}>
                {submitting ? "Saving..." : "Save Draft"}
              </button>
            </div>
          </Panel>
        </div>
        <aside className="summary-card">
          <h2>Review Summary</h2>
          <p>Intended Partner: {form.partnerInstitutionName || "---"}</p>
          <p>Agreement Class: <b>{form.agreementType}</b></p>
          <p>Submission Type: <b>{form.submissionType === "renewal" ? "Renewal" : "New Partnership"}</b></p>
          <p>Partner Classification: <b>{form.partnerClassification === "international" ? "International" : "Local"}</b></p>
          <p>Processing Office: <b>{account.office}</b></p>
        </aside>
      </div>
    </section>
  );
}

function SubmissionWizard({ account, onClose, onContinue }) {
  const [agreementType, setAgreementType] = React.useState("");
  const [submissionType, setSubmissionType] = React.useState("");
  const [partnerClassification, setPartnerClassification] = React.useState("");
  const [errors, setErrors] = React.useState({});

  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleNext() {
    const nextErrors = {};

    if (!agreementType) nextErrors.agreementType = "Please select an Agreement Type.";
    if (!submissionType) nextErrors.submissionType = "Please select a Submission Type.";
    if (!partnerClassification) nextErrors.partnerClassification = "Please select a Partner Classification.";

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    onContinue({ agreementType, submissionType, partnerClassification });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { onClose(); } }}>
      <div className="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="submission-wizard-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2 id="submission-wizard-title">Start a New Agreement Submission</h2>
          <button className="icon-close" type="button" onClick={onClose}>×</button>
        </header>
        <p className="wizard-intro">Submit a new Memorandum of Agreement (MOA), Memorandum of Understanding (MOU), or Memorandum of Friendship (MOF). Your submission will automatically follow the official CONEXIA review workflow.</p>
        <div className="wizard-section">
          <h3>Agreement Type</h3>
          <div className="wizard-choice-grid">
            {[
              ["Memorandum of Agreement (MOA)", "MOA"],
              ["Memorandum of Understanding (MOU)", "MOU"],
              ["Memorandum of Friendship (MOF)", "MOF"],
            ].map(([label, short]) => (
              <button
                key={short}
                type="button"
                className={agreementType === label ? "wizard-choice active" : "wizard-choice"}
                onClick={() => {
                  setAgreementType(label);
                  setErrors((prev) => ({ ...prev, agreementType: "" }));
                }}
              >
                <strong>{short}</strong>
                <small>{label}</small>
              </button>
            ))}
          </div>
          {errors.agreementType && <div className="auth-error">{errors.agreementType}</div>}
        </div>
        <div className="wizard-section">
          <h3>Submission Type</h3>
          <div className="wizard-choice-grid two">
            <button type="button" className={submissionType === "new_partnership" ? "wizard-choice active" : "wizard-choice"} onClick={() => { setSubmissionType("new_partnership"); setErrors((prev) => ({ ...prev, submissionType: "" })); }}>
              <strong>New Partnership</strong>
              <small>Fresh agreement submission</small>
            </button>
            <button type="button" className={submissionType === "renewal" ? "wizard-choice active" : "wizard-choice"} onClick={() => { setSubmissionType("renewal"); setErrors((prev) => ({ ...prev, submissionType: "" })); }}>
              <strong>Renewal</strong>
              <small>Existing agreement renewal</small>
            </button>
          </div>
          {errors.submissionType && <div className="auth-error">{errors.submissionType}</div>}
        </div>
        <div className="wizard-section">
          <h3>Partner Classification</h3>
          <div className="wizard-choice-grid two">
            <button type="button" className={partnerClassification === "local" ? "wizard-choice active" : "wizard-choice"} onClick={() => { setPartnerClassification("local"); setErrors((prev) => ({ ...prev, partnerClassification: "" })); }}>
              <strong>Local</strong>
              <small>Domestic partner institution</small>
            </button>
            <button type="button" className={partnerClassification === "international" ? "wizard-choice active" : "wizard-choice"} onClick={() => { setPartnerClassification("international"); setErrors((prev) => ({ ...prev, partnerClassification: "" })); }}>
              <strong>International</strong>
              <small>Foreign partner institution</small>
            </button>
          </div>
          {errors.partnerClassification && <div className="auth-error">{errors.partnerClassification}</div>}
        </div>
        <footer className="wizard-footer">
          <button type="button" className="outline" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" onClick={handleNext}>Next</button>
        </footer>
      </div>
    </div>
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
            <option>Memorandum of Funding (MOF)</option>
          </select>
        </label>
        <label>Submission Type
          <select
            value={form.submissionType}
            onChange={(e) => onChange("submissionType", e.target.value)}
          >
            <option value="new_partnership">New Engagement</option>
            <option value="renewal">Renewal</option>
          </select>
        </label>
        <label>Partner Classification
          <select
            value={form.partnerClassification}
            onChange={(e) => onChange("partnerClassification", e.target.value)}
          >
            <option value="local">Local</option>
            <option value="international">International</option>
          </select>
        </label>
        <label>Agreement Title
          <input
            value={form.agreementTitle}
            onChange={(e) => onChange("agreementTitle", e.target.value)}
            placeholder="e.g. Academic Exchange Program 2024"
          />
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
        <label>Contact Person
          <input
            value={form.contactPerson}
            onChange={(e) => onChange("contactPerson", e.target.value)}
            placeholder="Full name of contact person"
          />
        </label>
        <label>Contact Position
          <input
            value={form.contactPosition}
            onChange={(e) => onChange("contactPosition", e.target.value)}
            placeholder="e.g. Department Head"
          />
        </label>
        <label>Contact Number
          <input
            value={form.contactNumber}
            onChange={(e) => onChange("contactNumber", e.target.value)}
            placeholder="e.g. +63 912 345 6789"
          />
        </label>
        <label>Requested Completion Date
          <input
            type="date"
            value={form.requestedCompletionDate}
            onChange={(e) => onChange("requestedCompletionDate", e.target.value)}
          />
        </label>
        <label>Urgency Level
          <select
            value={form.urgencyLevel}
            onChange={(e) => onChange("urgencyLevel", e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="highly_urgent">Highly Urgent</option>
          </select>
        </label>
        <label>Requested By
          <input
            value={form.requestedByName}
            onChange={(e) => onChange("requestedByName", e.target.value)}
            placeholder="Name of requesting official"
          />
        </label>
        <label>Requested By Date
          <input
            type="date"
            value={form.requestedByDate}
            onChange={(e) => onChange("requestedByDate", e.target.value)}
          />
        </label>
        <label>Noted By
          <input
            value={form.notedByName}
            onChange={(e) => onChange("notedByName", e.target.value)}
            placeholder="Name of noting official (optional)"
          />
        </label>
        <label>Noted By Date
          <input
            type="date"
            value={form.notedByDate}
            onChange={(e) => onChange("notedByDate", e.target.value)}
          />
        </label>
      </div>
    </Panel>
  );
}


// Shows department-owned submissions and legal comments.
function MySubmissionsPage({ account, setPage }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerLoading, setDrawerLoading] = React.useState(false);
  const [selectedSubmission, setSelectedSubmission] = React.useState(null);
  const [submissionDetails, setSubmissionDetails] = React.useState(null);
  const [reviewData, setReviewData] = React.useState({ comments: [], annotations: [] });
  const [downloadBusyId, setDownloadBusyId] = React.useState("");
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");
  const [previewUrl, setPreviewUrl] = React.useState("");

  const loadSubmissions = React.useCallback(async () => {
    const mapRow = (row) => [
      <b>{row.tracking_number || String(row.id).slice(0, 8)}</b>,
      getSchoolLabel(row),
      row.agreement_type || "MOA",
      row.submission_type === "renewal" ? "Renewal" : "New Engagement",
      row.partner_classification === "international" ? "International" : "Local",
      new Date(row.created_at).toLocaleDateString(),
      <span className={`badge ${statusTone(row.status)}`}>{formatSubmissionStatus(row.status)}</span>,
      <>
        <button
          key={`view-${row.id}`}
          className="outline"
          title="View submission"
          aria-label="View submission"
          onClick={() => openDrawer(row)}
          style={{ padding: '6px 8px' }}
        >
          <Eye size={16} />
        </button>
        <button
          key={`delete-${row.id}`}
          className="danger outline"
          title="Delete submission"
          aria-label="Delete submission"
          style={{ marginLeft: 8, padding: '6px 8px' }}
            onClick={async () => {
            const confirmed = window.confirm("Delete Submission? This action cannot be undone.");
            if (!confirmed) return;
            try {
              await updateSubmissionStatus(account, row.id, "archived", "Submission deleted by Department Staff via list view.");
              setMessage("Submission archived.");
              await loadSubmissions();
            } catch (err) {
              setMessage(err?.message || "Unable to delete submission.");
            }
          }}
        >
          <Trash2 size={16} />
        </button>
      </>,
    ];

    setLoading(true);
    setMessage("");

    try {
      const response = await listSubmissions(account, {});
      const data = response?.data || [];
      // Show active submissions first and archived submissions at the bottom to avoid confusion
      const sorted = (data || []).slice().sort((a, b) => {
        const aArchived = String(a?.status || "").toLowerCase() === "archived";
        const bArchived = String(b?.status || "").toLowerCase() === "archived";
        if (aArchived && !bArchived) return 1;
        if (bArchived && !aArchived) return -1;
        // Otherwise sort by created date descending (newest first)
        const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });
      setRows(sorted.map(mapRow));
    } catch (error) {
      setRows([]);
      setMessage(error.message || "Unable to load submissions.");
    }

    setLoading(false);
  }, [account]);

  React.useEffect(() => {
    loadSubmissions();

    let refresh = null;
    if (account?.id) {
      refresh = setInterval(loadSubmissions, 15000);
    }

    return () => {
      if (refresh) clearInterval(refresh);
    };
  }, [account?.id, loadSubmissions]);

  async function detectDuplicates() {
    setMessage("");
    try {
      const response = await listSubmissions(account, {});
      const data = response?.data || [];
      const counts = data.reduce((acc, row) => {
        const tn = String(row.tracking_number || row.id || "");
        acc[tn] = (acc[tn] || 0) + 1;
        return acc;
      }, {});
      const duplicates = Object.entries(counts).filter(([, c]) => c > 1).map(([tn, c]) => `${tn} (${c})`);
      if (duplicates.length) {
        setMessage(`Duplicate tracking numbers found: ${duplicates.join(", ")}`);
      } else {
        setMessage("No duplicate tracking numbers found.");
      }
    } catch (err) {
      setMessage(err?.message || "Unable to detect duplicates.");
    }
  }

  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") closeDrawer();
    }

    if (drawerOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  React.useEffect(() => {
    if (!drawerOpen) return undefined;

    function handleDocumentMouseDown(event) {
      const target = event.target;
      if (target instanceof Element && target.classList.contains("drawer-backdrop")) {
        closeDrawer();
      }
    }

    window.addEventListener("mousedown", handleDocumentMouseDown);
    return () => window.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [drawerOpen]);

  async function openDrawer(row) {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setSelectedSubmission(row);
    setSubmissionDetails(null);
    setPreviewUrl("");
    setReviewData({ comments: [], annotations: [] });
    setDeleteError("");

    try {
      const [submissionResult, reviewResult] = await Promise.allSettled([
        getSubmission(account, row.id),
        getSubmissionReviewData(account, row.id),
      ]);

      if (submissionResult.status === "fulfilled") {
        setSubmissionDetails(submissionResult.value?.data || row);
      } else {
        setSubmissionDetails(row);
        setMessage(submissionResult.reason?.message || "Unable to load submission details.");
      }

      if (reviewResult.status === "fulfilled") {
        setReviewData(reviewResult.value?.data || { comments: [], annotations: [] });
      } else {
        setReviewData({ comments: [], annotations: [] });
      }
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerLoading(false);
    setSubmissionDetails(null);
    setSelectedSubmission(null);
    setPreviewUrl("");
    setDeleteError("");
  }

  function formatFileSize(size) {
    if (typeof size !== "number" || Number.isNaN(size)) return "---";
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.round(size / 1024)} KB`;
    return `${size} B`;
  }

  function inferFileLabel(item) {
    const fileName = item?.file_name || "Attached Document";
    const extension = (fileName.includes(".") ? fileName.split(".").pop() : "").toLowerCase();
    const mimeType = (item?.mime_type || "").toLowerCase();

    if (mimeType.includes("pdf") || extension === "pdf") return "PDF Document";
    if (mimeType.includes("word") || ["doc", "docx", "odt"].includes(extension)) return "Word Document";
    if (mimeType.includes("sheet") || ["xls", "xlsx", "csv"].includes(extension)) return "Spreadsheet";
    if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(extension)) return "Image";
    if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "Compressed File";

    return extension ? `${extension.toUpperCase()} Document` : "Document";
  }

  function inferFileBadge(item) {
    const fileName = item?.file_name || "FILE";
    const extension = (fileName.includes(".") ? fileName.split(".").pop() : "").toLowerCase();
    const mimeType = (item?.mime_type || "").toLowerCase();

    if (mimeType.includes("pdf") || extension === "pdf") return "PDF";
    if (mimeType.includes("word") || ["doc", "docx", "odt"].includes(extension)) return "DOC";
    if (mimeType.includes("sheet") || ["xls", "xlsx", "csv"].includes(extension)) return "XLS";
    if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(extension)) return "IMG";
    if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "ZIP";

    return extension ? extension.toUpperCase() : "FILE";
  }

  function getAttachmentItems(submission) {
    if (!submission) return [];
    if (Array.isArray(submission.attachments) && submission.attachments.length) return submission.attachments;
    if (submission.file_name || submission.storage_path) {
      return [{
        id: submission.id,
        file_name: submission.file_name || "Attached Document",
        storage_path: submission.storage_path,
        file_size: submission.file_size,
        mime_type: submission.mime_type,
        created_at: submission.created_at,
      }];
    }
    return [];
  }

  async function handlePreviewAttachment() {
    if (!selectedSubmission) return;
    setMessage("");
    try {
      const response = await getSubmissionFile(account, selectedSubmission.id);
      const url = response?.data?.url;
      if (url) {
        setPreviewUrl(url);
        return;
      }
      setMessage("No preview is available for this attachment yet.");
    } catch (error) {
      setMessage(error.message || "Unable to preview attachment.");
    }
  }

  async function handleDownloadAttachment(item) {
    if (!selectedSubmission) return;
    setDownloadBusyId(item.id || item.file_name || selectedSubmission.id);
    setMessage("");
    try {
      const response = await getSubmissionFile(account, selectedSubmission.id);
      const url = response?.data?.url;
      const fileName = response?.data?.file_name || item.file_name || "download";
      if (!url) return;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setMessage(error.message || "Unable to download attachment.");
    } finally {
      setDownloadBusyId("");
    }
  }

  function canDeleteSubmission(submission) {
    return ["draft", "legal_revision_required", "revision_required", "rejected"].includes(submission?.status);
  }

  async function handleDeleteSubmission() {
    if (!selectedSubmission || !canDeleteSubmission(selectedSubmission)) return;
    const confirmed = window.confirm("Delete Submission?\n\nThis action cannot be undone.");
    if (!confirmed) return;

    setDeleteBusy(true);
    setDeleteError("");
    try {
      await updateSubmission(account, selectedSubmission.id, {
        status: "archived",
        current_stage: "archived",
        notes: "Submission deleted by Department Staff.",
      });
      closeDrawer();
      loadSubmissions();
    } catch (error) {
      setDeleteError(error.message || "Unable to delete submission.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleResubmit() {
    if (!selectedSubmission) return;

    try {
      localStorage.setItem("department-active-submission-id", selectedSubmission.id);
      sessionStorage.setItem("department-active-submission-id", selectedSubmission.id);
      sessionStorage.setItem("department-submission-entry", "submissions");
      sessionStorage.setItem("department-submission-mode", "correction");
      setPage?.("submission", {
        source: "resubmit",
        draftId: selectedSubmission.id,
        mode: "correction",
      });
      setMessage("Submission reopened for corrections. Make your edits and submit again when ready.");
    } catch (err) {
      setMessage(err?.message || "Failed to resubmit document.");
    }
  }

  async function handleEditSubmission() {
    if (!selectedSubmission) return;

    localStorage.setItem("department-active-submission-id", selectedSubmission.id);
    sessionStorage.setItem("department-active-submission-id", selectedSubmission.id);
    sessionStorage.setItem("department-submission-entry", "submissions");
    sessionStorage.setItem("department-submission-mode", "correction");
    setPage?.("submission", {
      source: "edit",
      draftId: selectedSubmission.id,
      mode: "correction",
    });
  }

  const activeSubmission = submissionDetails || selectedSubmission;
  const resolvedSubmissionUrl = previewUrl || "";

  return (
    <section className="page department-page my-submissions-page">
      <div>
        <PageTitle title="My Submissions" subtitle="Real-time tracking of institutional documents and partner agreements." />
        <Panel title="Submission Records">
          {loading ? (
            <p style={{ padding: "24px" }}>Loading submissions...</p>
          ) : (
            <DataTable headers={["Tracking #", "Department", "Agreement Type", "Submission Type", "Partner Classification", "Submitted Date", "Status", "Action"]} rows={rows} />
          )}
        </Panel>
        {message && <p style={{ marginTop: "12px", color: message.includes("Failed") ? "red" : "green" }}>{message}</p>}
      </div>

      {drawerOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
          <aside className="detail-drawer drawer-overlay" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-close drawer-close" type="button" onClick={closeDrawer}>×</button>
            <div className="drawer-grid">
              <section className="drawer-left">
                <h2>Document Preview</h2>
                {drawerLoading ? (
                  <p>Loading document preview…</p>
                ) : activeSubmission ? (
                  <DocumentReviewViewer submission={activeSubmission} account={account} viewerTitle="Review Document" />
                ) : (
                  <p>No submission selected.</p>
                )}
              </section>

              <section className="drawer-right">
                <h2>Submission Details</h2>
                {drawerLoading ? (
                  <p>Loading submission details...</p>
                ) : activeSubmission ? (
                  <>
                    <p><strong>Tracking #:</strong> {activeSubmission.tracking_number || activeSubmission.id}</p>
                    <p><strong>Department:</strong> {getSchoolLabel(activeSubmission)}</p>
                    <p><strong>Partner:</strong> {activeSubmission.partner_institution_name}</p>
                    <p><strong>Agreement Type:</strong> {activeSubmission.agreement_type || "MOA"}</p>
                    <p><strong>Submission Type:</strong> {activeSubmission.submission_type === "renewal" ? "Renewal" : "New Engagement"}</p>
                    <p><strong>Partner Classification:</strong> {activeSubmission.partner_classification === "international" ? "International" : "Local"}</p>
                    <p><strong>Status:</strong> <b>{formatSubmissionStatus(activeSubmission.status)}</b></p>
                    <p><strong>Current Reviewer:</strong> {activeSubmission.current_reviewer || activeSubmission.current_reviewer_role || "IRO Staff"}</p>
                    <p><strong>Revision Cycle:</strong> {activeSubmission.revision_cycle || 1}</p>
                    <p><strong>Submitted Date:</strong> {activeSubmission.created_at ? new Date(activeSubmission.created_at).toLocaleString() : "---"}</p>
                    <p><strong>Updated Date:</strong> {activeSubmission.updated_at ? new Date(activeSubmission.updated_at).toLocaleDateString() : "---"}</p>
                    <p><strong>Workflow Status:</strong> <span className={`badge ${statusTone(activeSubmission.status)}`}>{formatSubmissionStatus(activeSubmission.status)}</span></p>
                    <p><strong>Activity Summary:</strong> {activeSubmission.notes || activeSubmission.legal_comments || "No review notes yet."}</p>
                    <div style={{ marginTop: "16px" }}>
                      <strong>Submission Timeline</strong>
                      <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                        {buildSubmissionTimeline(activeSubmission).map((item) => (
                          <div key={`${item.label}-${item.detail}`} className={`timeline-item ${item.tone || ""}`}>
                            <b>{item.label}</b>
                            <p>{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {activeSubmission.legal_comments && (
                      <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#fff3cd", borderRadius: "4px" }}>
                        <strong>Legal Comments:</strong>
                        <p>{activeSubmission.legal_comments}</p>
                      </div>
                    )}
                    <div style={{ marginTop: "16px" }}>
                      <strong>Review History</strong>
                      <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                        {Array.isArray(reviewData.comments) && reviewData.comments.length ? reviewData.comments.map((comment) => (
                          <div key={comment.id} className="timeline-item">
                            <b>{comment.created_by_name || comment.role || "Reviewer"}</b>
                            <p>Page {comment.page_number || 1}</p>
                            {comment.selected_text ? <p>{comment.selected_text}</p> : null}
                            <p>{comment.comment}</p>
                            <small>{comment.created_at ? new Date(comment.created_at).toLocaleString() : ""}</small>
                          </div>
                        )) : (
                          <p>No review comments yet.</p>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <strong>Attachments</strong>
                      <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                        {getAttachmentItems(activeSubmission).length ? getAttachmentItems(activeSubmission).map((item) => {
                          const fileName = item.file_name || "Attached Document";
                          const extension = inferFileBadge(item);
                          const fileTypeLabel = inferFileLabel(item);
                          return (
                            <div key={item.id || fileName} className="attachment-card">
                              <div className="attachment-card__icon">{extension}</div>
                              <div className="attachment-card__body">
                                <b>{fileName}</b>
                                <small>{fileTypeLabel}</small>
                                <small>{formatFileSize(item.file_size)}</small>
                              </div>
                              <div className="attachment-card__actions">
                                <button className="outline" onClick={handlePreviewAttachment}>Preview</button>
                                <button className="outline" onClick={() => handleDownloadAttachment(item)} disabled={downloadBusyId === (item.id || item.file_name || activeSubmission.id)}>
                                  {downloadBusyId === (item.id || item.file_name || activeSubmission.id) ? "Downloading..." : "Download"}
                                </button>
                              </div>
                            </div>
                          );
                        }) : (
                          <p>No attachments found.</p>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                      <button className="primary" onClick={handleEditSubmission}>
                        Edit Submission
                      </button>
                      <button className="outline" onClick={handleResubmit} disabled={deleteBusy || !["legal_revision_required", "revision_required"].includes(activeSubmission.status)}>
                        Resubmit After Corrections
                      </button>
                      <button className="danger outline" onClick={handleDeleteSubmission} disabled={deleteBusy || !canDeleteSubmission(activeSubmission)}>
                        {deleteBusy ? "Deleting..." : "Delete Submission"}
                      </button>
                      {!canDeleteSubmission(activeSubmission) && (
                        <p style={{ margin: 0, color: "#8a5a00" }}>Delete is only allowed for Draft, Returned for Revision, and Rejected submissions.</p>
                      )}
                      {deleteError && <p style={{ margin: 0, color: "var(--red)" }}>{deleteError}</p>}
                    </div>
                  </>
                ) : (
                  <p>Select a submission to view status, details, and revision history.</p>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
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

