import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Globe2,
  History,
  MapPin,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../components/DocumentFilters";
import { PageTitle } from "../components/PageTitle";
import { createNotification } from "../utils/notifications";
import { Panel } from "../components/Panel";
import { DashboardView, Dropzone, ExpiryView } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { DocumentFilesPanel } from "../components/DocumentFilesPanel";
import { DepartmentalPdfReview } from "../components/DepartmentalPdfReview";
import { PreSubmissionModal } from "../components/PreSubmissionModal";
import DepartmentSettingsPage from "../features/department-staff/settings/Page";
import {
  createDepartmentDocument,
  approveDepartmentReview,
  createDepartmentReviewItem,
  deleteDepartmentReviewItem,
  getDepartmentReview,
  getDepartmentDiscussion,
  getDepartmentDocuments,
  getDepartmentHistory,
  requestDepartmentCorrection,
  routeDepartmentReviewToStaff,
  sendDepartmentDiscussionMessage,
  resubmitDepartmentDocument,
  updateDepartmentReviewHighlight,
} from "../services/departmentStaffService";
import { uploadDocumentFile } from "../services/documentFileService";
import { apiGet } from "../api/apiClient";
import { reportClientError } from "../utils/reportClientError";

const partnershipTypes = [
  ["Departmental", Building2],
  ["Local", MapPin],
  ["International", Globe2],
];

// Routes all Department Staff pages through one role-owned component.
export function DepartmentStaff({ page, account }) {
  const navigate = useNavigate();
  const [preSubmissionModalOpen, setPreSubmissionModalOpen] = React.useState(false);

  function handleNewSubmission() {
    setPreSubmissionModalOpen(true);
  }

  function handlePreSubmissionConfirm(selection) {
    // The upload page consumes this completed Department Staff draft at step 2.
    sessionStorage.setItem(
      "department-submission-draft",
      JSON.stringify(selection)
    );
    setPreSubmissionModalOpen(false);
    // Navigate to submission page
    navigate("/app/submission");
  }

  function handlePreSubmissionClose() {
    setPreSubmissionModalOpen(false);
  }

  if (page === "submission") return <SubmissionPage account={account} />;
  if (page === "submissions") return <MySubmissionsPage account={account} />;
  if (page === "engagements") return <EngagementsPage />;
  if (page === "expiry") return <ExpiryView />;
  if (page === "settings") return <DepartmentSettingsPage account={account} />;

  return (
    <>
      <DashboardView
        roleKey="department"
        title="Institutional Workspace"
        subtitle={`Welcome back, ${account.name || account.fullName}. Here is the real-time status for your department.`}
        action="New Submission"
        onAction={handleNewSubmission}
      />
      <PreSubmissionModal
        open={preSubmissionModalOpen}
        onClose={handlePreSubmissionClose}
        onConfirm={handlePreSubmissionConfirm}
        account={account}
      />
    </>
  );
}

// Handles the department upload workflow for new agreements.
function SubmissionPage({ account }) {
  const [form, setForm] = React.useState({
    partnershipType: "Departmental",
    partnerDepartmentId: "",
    partnerInstitution: "",
    agreementType: "MOA",
    durationValue: "5",
    durationUnit: "Years",
    partnerEmail: "",
    description: "",
    agreementTitle: "",
    submissionType: "new",
    requestingOffice: "",
    contactPerson: "",
    position: "",
    emailAddress: "",
    contactNumber: "",
    requestedCompletionDate: "",
    urgencyLevel: "normal",
  });

  const [submitting, setSubmitting] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [success, setSuccess] =
    React.useState("");

  const [selectedFile, setSelectedFile] =
    React.useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState("");
  const [step, setStep] = React.useState(1);
  const [submittedTrackingNumber, setSubmittedTrackingNumber] =
    React.useState("");
  const [preSubmissionAnswers, setPreSubmissionAnswers] =
    React.useState(null);
  const [departments, setDepartments] = React.useState([]);

  React.useEffect(() => {
    apiGet("/departments?per_page=100")
      .then((response) => setDepartments(response.data ?? response.departments ?? []))
      .catch(() => setDepartments([]));
  }, []);

  React.useEffect(() => {
    const storedDraft = sessionStorage.getItem("department-submission-draft");
    if (!storedDraft) return;

    try {
      const draft = JSON.parse(storedDraft);
      setPreSubmissionAnswers(draft);
      setForm({
        partnershipType: draft.partnerClassification === "Departmental" ? "Departmental" : draft.partnerClassification === "international" ? "International" : "Local",
        partnerDepartmentId: draft.partnerDepartmentId || "",
        partnerInstitution: draft.partnerInstitution || "",
        agreementType: draft.agreementType || "MOA",
        durationValue: draft.durationValue || "5",
        durationUnit: draft.durationUnit || "Years",
        partnerEmail: draft.emailAddress || "",
        description: formatReviewFormDetails(draft),
        agreementTitle: draft.agreementTitle || "",
        submissionType: draft.submissionType || "new",
        requestingOffice: draft.requestingOffice || "",
        contactPerson: draft.contactPerson || "",
        position: draft.position || "",
        emailAddress: draft.emailAddress || "",
        contactNumber: draft.contactNumber || "",
        requestedCompletionDate: draft.requestedCompletionDate || "",
        urgencyLevel: draft.urgencyLevel || "normal",
      });
      setStep(2);
    } catch (parseError) {
      reportClientError("Unable to restore Department Staff submission draft:", parseError);
      sessionStorage.removeItem("department-submission-draft");
    }
  }, []);

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      requestingOffice: current.requestingOffice || account?.department || account?.departmentCode || account?.office || "",
      emailAddress: current.emailAddress || account?.email || "",
    }));
  }, [account]);

  function updateForm(event) {
    const { name, value } = event.target;

    if (name === "partnershipType") {
      setForm((current) => ({
        ...current,
        partnershipType: value,
        partnerDepartmentId: "",
        partnerInstitution: "",
        partnerEmail: "",
      }));
      setError("");
      setSuccess("");
      setSubmittedTrackingNumber("");
      return;
    }

    if (name === "partnerDepartmentId") {
      const department = departments.find((item) => item.id === value);
      setForm((current) => ({
        ...current,
        partnerDepartmentId: value,
        partnerInstitution: department?.name || "",
        partnerEmail: "",
      }));
      setError("");
      setSuccess("");
      setSubmittedTrackingNumber("");
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
    setSubmittedTrackingNumber("");
  }

  function continueToUpload() {
    if (
      form.partnershipType === "Departmental" &&
      !form.partnerDepartmentId
    ) {
      setError("Please select a partner department.");
      return;
    }

    if (
      form.partnershipType !== "Departmental" &&
      !form.partnerInstitution.trim()
    ) {
      setError("Please enter the partner institution name.");
      return;
    }

    if (!isValidDuration(form)) {
      setError("Expected duration must be a positive number.");
      return;
    }

    if (!form.agreementTitle.trim() || !form.requestingOffice.trim() || !form.contactPerson.trim() || !form.position.trim() || !form.emailAddress.trim() || !form.contactNumber.trim() || !form.requestedCompletionDate) {
      setError("Please complete all required review form fields.");
      return;
    }
    if (!isValidEmail(form.emailAddress)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!isValidPhoneNumber(form.contactNumber)) {
      setError("Please enter a valid contact number with 7 to 15 digits.");
      return;
    }

    setError("");
    setStep(2);
  }

  function continueToConfirmation() {
    if (!selectedFile) {
      setError("Please select a document before continuing to confirmation.");
      return;
    }

    setError("");
    setStep(3);
  }

  function previewSelectedFile() {
    if (!selectedFile) {
      setError("Select a document to preview first.");
      return;
    }

    setLocalPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(selectedFile);
    });
    setError("");
  }

  function closeLocalPreview() {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl("");
  }

  function backToStep(previousStep) {
    setError("");
    setStep(previousStep);
  }

  function expiryPayload() {
    const effectiveDate = new Date();
    const expiryDate = new Date(effectiveDate);
    const duration = Number.parseInt(
      form.durationValue,
      10,
    );

    if (!Number.isFinite(duration) || duration < 1) {
      return {};
    }

    if (form.durationUnit === "Months") {
      expiryDate.setMonth(
        effectiveDate.getMonth() + duration,
      );
    } else {
      expiryDate.setFullYear(
        effectiveDate.getFullYear() + duration,
      );
    }

    return {
      effective_date: effectiveDate
        .toISOString()
        .slice(0, 10),
      expiry_date: expiryDate
        .toISOString()
        .slice(0, 10),
      renewal_notice_days: 30,
      renewal_status: "active",
    };
  }

  async function submitDocument(event) {
    event.preventDefault();

    if (!form.partnerInstitution.trim()) {
      setError(
        form.partnershipType === "Departmental"
          ? "Please select a partner department."
          : "Please enter the partner institution name.",
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    let data;

    try {
      const partnerName = form.partnerInstitution.trim();
      const response =
        await createDepartmentDocument({
          title: form.agreementTitle.trim() || `${partnerName} ${form.agreementType}`,
          document_type: form.agreementType,
          partner_institution: partnerName,
          partner_email:
            form.partnerEmail.trim() || null,
          partner_department_id:
            form.partnershipType === "Departmental"
              ? form.partnerDepartmentId || null
              : null,
          description: (form.description.trim() || formatReviewFormDetails({
            ...form,
            partnerClassification: form.partnershipType === "Departmental" ? "Departmental" : form.partnershipType.toLowerCase(),
          })).trim() || null,
          ...expiryPayload(),
        });

      data =
        response.document ??
        response.data;
    } catch (requestError) {
      reportClientError(
        "Document submission failed:",
        requestError,
      );

      setError(requestError.message);
      setSubmitting(false);
      return;
    }

    if (selectedFile && data?.id) {
      try {
        await uploadDocumentFile(data.id, selectedFile);
      } catch (requestError) {
        reportClientError(
          "Document file upload failed:",
          requestError,
        );

        setError(requestError.message);
        setSubmitting(false);
        return;
      }
    }

    setSubmittedTrackingNumber(data.tracking_number || "");
    setSuccess("Submission successful.");

    setForm({
      partnershipType: "Departmental",
      partnerDepartmentId: "",
      partnerInstitution: "",
      agreementType: "MOA",
      durationValue: "5",
      durationUnit: "Years",
      partnerEmail: "",
      description: "",
      agreementTitle: "",
      submissionType: "new",
      requestingOffice: account?.department || account?.departmentCode || account?.office || "",
      contactPerson: "",
      position: "",
      emailAddress: account?.email || "",
      contactNumber: "",
      requestedCompletionDate: "",
      urgencyLevel: "normal",
    });

    setSelectedFile(null);
    setStep(3);
    sessionStorage.removeItem("department-submission-draft");
    setSubmitting(false);
  }

  return (
    <section className="page department-page">
      <PageTitle
        title="Submit New Document"
        subtitle={`Initiate a formal review process from ${
          account?.office || "your department"
        }.`}
      />

      <form className="submission-wizard" onSubmit={submitDocument}>
        <div className="steps submission-steps" aria-label="Submission progress">
          <span className={step >= 1 ? "on" : ""}>
                1<b>Partner Info</b>
              </span>

          <span className={step >= 2 ? "on" : ""}>
                2<b>Upload</b>
              </span>

          <span className={step >= 3 ? "on" : ""}>
                3<b>Confirmation</b>
              </span>
        </div>

        {step === 1 && (
          <Panel title="Partnership Information">
            <div className="form-grid submission-step-grid">
              <label>
                Submission Type
                <select name="submissionType" value={form.submissionType} onChange={updateForm}>
                  <option value="new">New Partnership</option>
                  <option value="renewal">Renewal</option>
                </select>
              </label>

              <label>
                Title of Agreement
                <input name="agreementTitle" value={form.agreementTitle} onChange={updateForm} placeholder="Enter agreement title" required />
              </label>

              <fieldset className="full-width segmented-field">
                <legend>Partner Classification</legend>
                <div className="segmented-cards">
                  {partnershipTypes.map(([type, Icon]) => (
                    <button
                      type="button"
                      className={form.partnershipType === type ? "selected" : ""}
                      key={type}
                      onClick={() =>
                        updateForm({
                          target: {
                            name: "partnershipType",
                            value: type,
                          },
                        })
                      }
                    >
                      <Icon size={17} />
                      {type === "Departmental" ? "Departmental" : type}
                    </button>
                  ))}
                </div>
              </fieldset>

              {form.partnershipType === "Departmental" ? (
                <label>
                  Which department are you collaborating with?
                  <select
                    name="partnerDepartmentId"
                    value={form.partnerDepartmentId}
                    onChange={updateForm}
                    required
                  >
                    <option value="">
                      Select department or program
                    </option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code ? `${department.code} — ` : ""}{department.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Partner Institution / Organization Name
                  <input
                    name="partnerInstitution"
                    value={form.partnerInstitution}
                    onChange={updateForm}
                    placeholder="e.g. Global Tech University"
                    required
                  />
                </label>
              )}

              <label>
                Agreement Type
                <select
                  name="agreementType"
                  value={form.agreementType}
                  onChange={updateForm}
                >
                  <option value="MOA">Memorandum of Agreement (MOA)</option>
                  <option value="MOU">Memorandum of Understanding (MOU)</option>
                  <option value="MOF">Memorandum of Funding (MOF)</option>
                </select>
              </label>

              <label className="duration-field">
                Expected Duration
                <span>
                  <input
                    name="durationValue"
                    type="number"
                    min="1"
                    step="1"
                    value={form.durationValue}
                    onChange={updateForm}
                    required
                  />
                  <select
                    name="durationUnit"
                    value={form.durationUnit}
                    onChange={updateForm}
                  >
                    <option value="Years">Years</option>
                    <option value="Months">Months</option>
                  </select>
                </span>
              </label>

              <label>
                Requesting Office / Department
                <input
                  name="requestingOffice"
                  value={form.requestingOffice}
                  onChange={updateForm}
                  required
                />
              </label>

              <label>
                Contact Person
                <input name="contactPerson" value={form.contactPerson} onChange={updateForm} required />
              </label>

              <label>
                Position
                <input name="position" value={form.position} onChange={updateForm} required />
              </label>

              <label>
                Email Address
                <input name="emailAddress" type="email" value={form.emailAddress} onChange={updateForm} required />
              </label>

              <label>
                Contact Number
                <input name="contactNumber" type="tel" inputMode="numeric" pattern="[0-9]{7,15}" maxLength="15" title="Use a valid contact number with 7 to 15 digits." value={form.contactNumber} onChange={(event) => updateForm({ target: { name: "contactNumber", value: numbersOnly(event.target.value) } })} required />
              </label>

              <label>
                Requested Date of Completion
                <input name="requestedCompletionDate" type="date" value={form.requestedCompletionDate} onChange={updateForm} required />
              </label>

              <label>
                Urgency Level
                <select name="urgencyLevel" value={form.urgencyLevel} onChange={updateForm}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="highly_urgent">Highly Urgent</option>
                </select>
              </label>
            </div>
            <WizardActions>
              <button type="button" onClick={continueToUpload}>
                Continue to Upload <ArrowRight size={16} />
              </button>
            </WizardActions>
          </Panel>
        )}

        {step === 2 && (
          <div className="submission-step-layout">
            <Panel
              title="Document Upload"
              subtitle="Step 2: upload the agreement draft for review."
            >
              {preSubmissionAnswers && (
                <div className="pre-submission-info-banner">
                  <p><b>Partner:</b> {form.partnerInstitution}</p>
                  <p><b>Agreement:</b> {preSubmissionAnswers.agreementType} · {preSubmissionAnswers.submissionType === "renewal" ? "Renewal" : "New Partnership"}</p>
                  <p><b>Classification:</b> {preSubmissionAnswers.partnerClassification === "Departmental" ? "Departmental" : preSubmissionAnswers.partnerClassification.charAt(0).toUpperCase() + preSubmissionAnswers.partnerClassification.slice(1)}</p>
                  <p><b>Title:</b> {preSubmissionAnswers.agreementTitle}</p>
                  <p><b>Requesting Office:</b> {preSubmissionAnswers.requestingOffice}</p>
                  <p><b>Contact:</b> {preSubmissionAnswers.contactPerson} · {preSubmissionAnswers.position}</p>
                  <p><b>Email / Number:</b> {preSubmissionAnswers.emailAddress} · {preSubmissionAnswers.contactNumber}</p>
                  <p><b>Requested completion:</b> {preSubmissionAnswers.requestedCompletionDate} · {preSubmissionAnswers.urgencyLevel === "highly_urgent" ? "Highly Urgent" : preSubmissionAnswers.urgencyLevel.charAt(0).toUpperCase() + preSubmissionAnswers.urgencyLevel.slice(1)}</p>
                </div>
              )}
              <Dropzone
                label="Drag and drop agreement draft"
                detail="PDF, DOCX, ODT - Maximum 25 MB"
                selectedFile={selectedFile}
                disabled={submitting}
                onFileSelect={setSelectedFile}
                onRemove={() => setSelectedFile(null)}
              />
              <div className="wizard-preview-action">
                <button type="button" className="outline" disabled={!selectedFile || submitting} onClick={previewSelectedFile}>
                  Preview Selected Document
                </button>
                {selectedFile && <span>{selectedFile.name}</span>}
              </div>
              {localPreviewUrl && (
                <div className="department-local-preview">
                  <div className="department-local-preview__header">
                    <b>{selectedFile?.name || "Document preview"}</b>
                    <button type="button" className="outline" onClick={closeLocalPreview}>Close Preview</button>
                  </div>
                  {selectedFile?.type === "application/pdf" || selectedFile?.name?.toLowerCase().endsWith(".pdf") ? (
                    <iframe title="Selected document preview" src={localPreviewUrl} className="department-local-preview__frame" />
                  ) : (
                    <p>This file type cannot be rendered in the browser. You can still continue with the selected file.</p>
                  )}
                </div>
              )}
              <WizardActions>
                <button type="button" className="outline" onClick={() => backToStep(1)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="button" onClick={continueToConfirmation}>
                  Continue to Confirmation <ArrowRight size={16} />
                </button>
              </WizardActions>
            </Panel>
          </div>
        )}

        {step === 3 && (
          <div className="submission-step-layout">
            <Panel title={success ? "Submission Successful" : "Confirmation"}>
              {success ? (
                <div className="submission-success">
                  <CheckCircle2 size={34} />
                  <h2>Submission Successful</h2>
                  <p>Tracking Number:</p>
                  <strong>{submittedTrackingNumber || "Processing"}</strong>
                </div>
              ) : (
                <SubmissionSummary form={form} account={account} selectedFile={selectedFile} />
              )}
              {error && <div className="auth-error">{error}</div>}
              {success && <div className="success-message">{success}</div>}
              {!success && (
                <WizardActions>
                  <button
                    type="button"
                    className="outline"
                    disabled={submitting}
                    onClick={() => backToStep(2)}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit for Review"}
                    {!submitting && <UploadCloud size={16} />}
                  </button>
                </WizardActions>
              )}
            </Panel>
          </div>
        )}

        {error && step !== 3 && <div className="auth-error">{error}</div>}
      </form>
    </section>
  );
}

function WizardActions({ children }) {
  return <div className="wizard-actions">{children}</div>;
}

function SubmissionSummary({ form, account, selectedFile, compact = false }) {
  return (
    <aside className={`${compact ? "summary-card compact" : "summary-card"} submission-review-summary`}>
      <h2>Review Summary</h2>
      <p className="submission-review-note">Please verify these details before submitting. They are arranged for the review-form export.</p>
      <SummarySection title="Agreement Details">
        <SummaryField label="Title of Agreement" value={form.agreementTitle} />
        <SummaryField label="Type of Document" value={form.agreementType} />
        <SummaryField label="Submission Type" value={form.submissionType === "renewal" ? "Renewal" : "New Partnership"} />
        <SummaryField label="Partner Classification" value={form.partnershipType === "Departmental" ? "Departmental" : form.partnershipType} />
        <SummaryField label={form.partnershipType === "Departmental" ? "Collaborating Department / Program" : "Partner Organization"} value={form.partnerInstitution} />
      </SummarySection>
      <SummarySection title="Requesting Office Information">
        <SummaryField label="Office / Department" value={form.requestingOffice} />
        <SummaryField label="Contact Person" value={form.contactPerson} />
        <SummaryField label="Position" value={form.position} />
        <SummaryField label="Email Address" value={form.emailAddress} />
        <SummaryField label="Contact Number" value={form.contactNumber} />
      </SummarySection>
      <SummarySection title="Timeline Requirement">
        <SummaryField label="Requested Date of Completion" value={formatDate(form.requestedCompletionDate)} />
        <SummaryField label="Urgency Level" value={formatUrgency(form.urgencyLevel)} />
      </SummarySection>
      <SummarySection title="Submission Document">
        <SummaryField label="Selected File" value={selectedFile?.name || "No file selected"} />
        <SummaryField label="Processing Office" value={account?.office || account?.department || "Assigned Department"} />
        <SummaryField label="Initial Status" value="Submitted" />
      </SummarySection>
    </aside>
  );
}

function SummarySection({ title, children }) {
  return <section className="submission-review-section"><h3>{title}</h3><dl>{children}</dl></section>;
}

function SummaryField({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function formatUrgency(value) {
  return value === "highly_urgent" ? "Highly Urgent" : value === "urgent" ? "Urgent" : "Normal";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhoneNumber(value) {
  return /^\d{7,15}$/.test(value);
}

function numbersOnly(value) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function isValidDuration(form) {
  const duration = Number.parseInt(form.durationValue, 10);

  return Number.isFinite(duration) && duration > 0;
}

function durationLabel(form) {
  const duration = Number.parseInt(form.durationValue, 10);
  const unit = form.durationUnit === "Months" ? "Month" : "Year";

  if (!Number.isFinite(duration) || duration < 1) {
    return "-";
  }

  return `${duration} ${unit}${duration === 1 ? "" : "s"}`;
}

function formatReviewFormDetails(draft) {
  return [
    `Submission type: ${draft.submissionType === "renewal" ? "Renewal" : "New Partnership"}`,
    `Partner classification: ${draft.partnerClassification}`,
    `Requesting office/department: ${draft.requestingOffice}`,
    `Contact person: ${draft.contactPerson}`,
    `Position: ${draft.position}`,
    `Email address: ${draft.emailAddress}`,
    `Contact number: ${draft.contactNumber}`,
    `Requested completion date: ${draft.requestedCompletionDate}`,
    `Urgency level: ${draft.urgencyLevel}`,
  ].join("\n");
}

// Shows department-owned submissions and legal comments.
function MySubmissionsPage({ account }) {
 const [documents, setDocuments] = React.useState([]);
 const [selectedDocument, setSelectedDocument] =
  React.useState(null);
 const [reviewOpen, setReviewOpen] = React.useState(false);
 const [departmentalReview, setDepartmentalReview] = React.useState(null);
 const [pendingReviewItems, setPendingReviewItems] = React.useState([]);
 const [revisedFile, setRevisedFile] = React.useState(null);
 const [historyPreview, setHistoryPreview] = React.useState(null);
 const accountDepartmentId = account?.department_id || account?.departmentId || account?.department?.id;

 const [loading, setLoading] = React.useState(true);
 const [processing, setProcessing] =
  React.useState(false);

 const [error, setError] = React.useState("");
 const [success, setSuccess] = React.useState("");
 const [page, setPage] = React.useState(1);
 const [meta, setMeta] = React.useState(null);
 const {
  filters,
  queryParams,
  updateFilter,
  clearFilters,
 } = useDocumentFilters();

 function changeFilter(key, value) {
  updateFilter(key, value);
  setPage(1);
 }

  React.useEffect(() => {
    async function loadDocuments() {
      setLoading(true);
      setError("");

      try {
        const response =
          await getDepartmentDocuments({
            page,
            ...queryParams,
          });

        const loadedDocuments =
          response.documents ??
          response.data ??
          [];

        setDocuments(loadedDocuments);
        setMeta(response.meta ?? null);

        setSelectedDocument((current) => current
          ? loadedDocuments.find((document) => document.id === current.id) || null
          : null);
        setPendingReviewItems([]);
      } catch (requestError) {
        reportClientError(
          "Unable to load submissions:",
          requestError,
        );

        setError(requestError.message);
        setDocuments([]);
      }

      setLoading(false);
    }

    loadDocuments();
  }, [page, queryParams]);

  const rows = documents.map((document) => [
    document.tracking_number,

    document.partner_institution,

    document.document_type,

    <span
      key={`status-${document.id}`}
      className={`badge ${
        document.status === "Corrections Needed"
          ? "danger"
          : document.status === "Submitted"
            ? "pending"
            : "active"
      }`}
    >
      {departmentalStatusLabel(document, document.department_id === accountDepartmentId)}
    </span>,

    <button
      key={`view-${document.id}`}
      type="button"
      className="table-action"
      onClick={() => {
        setSelectedDocument(document);
        setPendingReviewItems([]);
        setRevisedFile(null);
        setHistoryPreview(null);
        setReviewOpen(true);
        setError("");
        setSuccess("");
      }}
    >
      View & Preview
    </button>,
  ]);

  // Resubmits a corrected document and clears the old Legal remarks.
  async function resubmitDocument() {
    if (!selectedDocument?.id) {
      setError("Select a valid document first.");
      return;
    }
    if (!revisedFile) {
      setError("Choose the corrected file before submitting it to the Partner Department.");
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    let updatedDocument;

    try {
      await uploadDocumentFile(selectedDocument.id, revisedFile);
      const response =
        await resubmitDepartmentDocument(
          selectedDocument.id
        );

      updatedDocument =
        response.document ??
        response.data;
    } catch (requestError) {
      reportClientError(
        "Unable to resubmit document:",
        requestError
      );

      setError(requestError.message);
      setProcessing(false);
      return;
    }

    if (!updatedDocument) {
      setError(
        "No document was updated. Refresh the page and verify that its status is still Corrections Needed."
      );
      setProcessing(false);
      return;
    }

    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === updatedDocument.id
          ? updatedDocument
          : document
      )
    );

    setSelectedDocument(updatedDocument);
    setRevisedFile(null);
    setSuccess("Document successfully resubmitted.");
    setProcessing(false);
  }

  if (reviewOpen && selectedDocument) {
    const reviewIsSubmitted = Boolean(selectedDocument.submitted_at);
    const isCreator = accountDepartmentId === selectedDocument.department_id;

    return (
      <section className="page department-page department-submission-review">
        <PageTitle
          title="Document Review"
          subtitle="Review your submitted document and completed submission information."
          action="Back to My Submissions"
          onAction={() => { setReviewOpen(false); setSelectedDocument(null); }}
        />
        <div className="department-submission-review__workspace">
          <main className="department-submission-review__document">
            {historyPreview ? (historyPreview.file.mime_type?.includes("pdf") ? <DepartmentalPdfReview documentId={selectedDocument.id} fileId={historyPreview.file.id} items={historyPreview.annotations} /> : <DocumentFilesPanel documentId={selectedDocument.id} embeddedPreview previewFileId={historyPreview.file.id} />) : selectedDocument.partner_department_id && reviewIsSubmitted ? <DepartmentalPdfReview documentId={selectedDocument.id} items={[...(departmentalReview?.items ?? []), ...pendingReviewItems]} canAnnotate={!isCreator && selectedDocument.status === "Department Review"} onCreateItem={async (item) => { const temporaryId = `pending-${Date.now()}`; const activeHighlights = [...(departmentalReview?.items ?? []), ...pendingReviewItems].filter((entry) => entry.type === "highlight" && !entry.highlight_removed_at); const optimisticItem = { ...item, id: temporaryId, highlight_color: item.type === "highlight" ? "blue" : null, display_number: item.type === "highlight" ? activeHighlights.length + 1 : null, created_at: new Date().toISOString(), department: selectedDocument.partner_department?.name, author: "You" }; setPendingReviewItems((current) => [...current, optimisticItem]); try { const response = await createDepartmentReviewItem(selectedDocument.id, item); setPendingReviewItems((current) => current.filter((entry) => entry.id !== temporaryId)); setDepartmentalReview((current) => ({ ...(current ?? {}), items: [...(current?.items ?? []).filter((entry) => entry.id !== response.item.id), response.item] })); return response; } catch (requestError) { setPendingReviewItems((current) => current.filter((entry) => entry.id !== temporaryId)); throw requestError; } }} onUpdateHighlight={async (itemId, payload) => { await updateDepartmentReviewHighlight(selectedDocument.id, itemId, payload); setDepartmentalReview(await getDepartmentReview(selectedDocument.id)); }} /> : <DocumentFilesPanel documentId={selectedDocument.id} embeddedPreview />}
          </main>
          <aside className="department-submission-review__details">
            <h2>Submission Details</h2>
            <SubmissionDetailSection title="Submission Information">
              <SubmissionDetail label="Tracking Number" value={selectedDocument.tracking_number} />
              <SubmissionDetail label="Status" value={departmentalStatusLabel(selectedDocument, isCreator)} />
              <SubmissionDetail label="Submitted Date" value={formatDocumentDate(selectedDocument.submitted_at)} />
            </SubmissionDetailSection>
            <SubmissionDetailSection title="Requesting Office / Department">
              <SubmissionDetail label="Department" value={selectedDocument.department?.name || selectedDocument.department?.code} />
            </SubmissionDetailSection>
            <SubmissionDetailSection title="Agreement Details">
              <SubmissionDetail label="Document Type" value={selectedDocument.document_type} />
              <SubmissionDetail label="Title of Agreement" value={selectedDocument.title} />
              <SubmissionDetail label="Partner Organization" value={selectedDocument.partner_institution} />
              <SubmissionDetail label="Partner Contact Email" value={selectedDocument.partner_email} />
            </SubmissionDetailSection>
            {selectedDocument.description && <SubmissionDetailSection title="Submitted Form Information"><p className="department-submission-review__description">{selectedDocument.description}</p></SubmissionDetailSection>}
            {selectedDocument.partner_department_id && <DepartmentalHistoryPanel documentId={selectedDocument.id} onViewVersion={setHistoryPreview} onCloseVersion={() => setHistoryPreview(null)} viewingVersion={Boolean(historyPreview)} />}
            {historyPreview && <DepartmentalVersionAnnotations version={historyPreview} />}
            {selectedDocument.legal_notes && <SubmissionDetailSection title="Legal Remarks"><div className="notice danger"><p>{selectedDocument.legal_notes}</p></div></SubmissionDetailSection>}
            {selectedDocument.partner_department_id && reviewIsSubmitted && <><DepartmentalReviewPanel document={selectedDocument} review={departmentalReview} isCreator={isCreator} onReviewChange={setDepartmentalReview} onRemoveAnnotation={async (itemId) => { await deleteDepartmentReviewItem(selectedDocument.id, itemId); setDepartmentalReview(await getDepartmentReview(selectedDocument.id)); }} onDocumentChange={(document) => { setSelectedDocument(document); setDocuments((current) => current.map((item) => item.id === document.id ? document : item)); }} /><DepartmentDiscussionPanel document={selectedDocument} currentDepartmentId={accountDepartmentId} /></>}
            {isCreator && selectedDocument.status === "Corrections Needed" && <><label className="file-picker">Revised version<input type="file" accept=".pdf,.docx,.odt" onChange={(event) => setRevisedFile(event.target.files?.[0] || null)} /></label><button disabled={processing || !revisedFile} onClick={resubmitDocument}>{processing ? "Submitting revised version..." : "Submit Revised Version"}</button></>}
            {isCreator && selectedDocument.status === "Partner Review Complete" && <button disabled={processing} onClick={async () => { setProcessing(true); setError(""); try { const response = await routeDepartmentReviewToStaff(selectedDocument.id); const updated = response.document ?? response.data; setSelectedDocument(updated); setDocuments((current) => current.map((item) => item.id === updated.id ? updated : item)); setSuccess("Submission sent to the next process."); } catch (requestError) { setError(requestError.message); } finally { setProcessing(false); } }}>{processing ? "Sending..." : "Send to Next Process"}</button>}
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="success-message">{success}</p>}
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="page department-page">
      <div>
        <PageTitle
          title="My Submissions"
          subtitle="Real-time tracking of institutional documents and partner agreements."
        />

        <StatGrid
          stats={[
            {
              value: String(
                documents.filter((document) =>
                  [
                    "Submitted",
                    "Logged",
                    "Under Legal Review",
                  ].includes(document.status),
                ).length,
              ).padStart(2, "0"),
              label: "Currently in Review",
              icon: FileText,
              badge: "Active",
            },
            {
              value: String(
                documents.filter(
                  (document) =>
                    document.status ===
                    "Pending Notarization",
                ).length,
              ).padStart(2, "0"),
              label: "Awaiting Notarization",
              icon: FileText,
              badge: "Pending",
              tone: "warn",
            },
            {
              value: String(
                documents.filter(
                  (document) =>
                    document.status ===
                    "Corrections Needed",
                ).length,
              ).padStart(2, "0"),
              label: "Requires Resubmission",
              icon: FileText,
              badge: "Action",
              tone: "danger",
            },
          ]}
        />

        <Panel title="Submission Records">
          <DocumentFilters
            filters={filters}
            onChange={changeFilter}
            onClear={() => {
              clearFilters();
              setPage(1);
            }}
            statusOptions={[
              "Submitted",
              "Logged",
              "Under Legal Review",
              "Corrections Needed",
              "Approved",
              "Pending Notarization",
              "Notarized",
              "Archived",
            ]}
            showDepartment={false}
            unsupported={{
              document_type: true,
              partnership_scope: true,
              date_from: true,
              date_to: true,
            }}
          />
          {loading && <p>Loading submissions...</p>}

          {error && (
            <p className="auth-error">
              Unable to load submissions: {error}
            </p>
          )}

          {!loading &&
            !error &&
            documents.length === 0 && (
              <p>
                No submissions are available for this
                department.
              </p>
            )}

          {!loading &&
            !error &&
            documents.length > 0 && (
              <DataTable
                headers={[
                  "Tracking #",
                  "Partner",
                  "Type",
                  "Status",
                  "Action",
                ]}
                rows={rows}
                meta={meta}
                onPageChange={setPage}
              />
            )}
        </Panel>
      </div>

      {false && <aside className="detail-drawer">
        <h2>Submission Details</h2>

        {!selectedDocument ? (
          <p>Select a submission.</p>
        ) : (
          <>
            <p>
              <b>Tracking #:</b>{" "}
              {selectedDocument.tracking_number}
            </p>

            <p>
              <b>Partner:</b>{" "}
              {selectedDocument.partner_institution}
            </p>

            <p>
              <b>Document Type:</b>{" "}
              {selectedDocument.document_type}
            </p>

            <p>
              <b>Status:</b>{" "}
              {selectedDocument.status}
            </p>

            {selectedDocument.description && (
              <p>
                <b>Description:</b>{" "}
                {selectedDocument.description}
              </p>
            )}

            {selectedDocument.legal_notes && (
              <>
                <h3>Legal Remarks</h3>

                <div className="notice danger">
                  <p>{selectedDocument.legal_notes}</p>
                </div>
              </>
            )}

            <DocumentFilesPanel
              documentId={selectedDocument.id}
              canUpload={[
                "Submitted",
                "Corrections Needed",
              ].includes(selectedDocument.status)}
              canDelete={[
                "Submitted",
                "Corrections Needed",
              ].includes(selectedDocument.status)}
            />

            {error && (
              <p className="auth-error">
                {error}
              </p>
            )}

            {success && (
              <p className="success-message">
                {success}
              </p>
            )}

            {selectedDocument.status ===
              "Corrections Needed" && (
              <button
                disabled={processing}
                onClick={resubmitDocument}
              >
                {processing
                  ? "Resubmitting..."
                  : "Resubmit Document"}
              </button>
            )}
          </>
        )}
      </aside>}
    </section>
  );
}

function SubmissionDetailSection({ title, children }) {
  return <section className="department-submission-review__section"><h3>{title}</h3><div>{children}</div></section>;
}

function SubmissionDetail({ label, value }) {
  return <p><span>{label}</span><b>{value || "—"}</b></p>;
}

function DepartmentalHistoryPanel({ documentId, onViewVersion, onCloseVersion, viewingVersion }) {
  const [open, setOpen] = React.useState(false);
  const [events] = React.useState([]);
  const [versions, setVersions] = React.useState([]);
  const [original, setOriginal] = React.useState(null);
  const [highlightedVersions, setHighlightedVersions] = React.useState([]);
  const [approvedDocument, setApprovedDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await getDepartmentHistory(documentId);
      setVersions(response.versions ?? []);
      setOriginal(response.original ?? null);
      setHighlightedVersions(response.highlighted_versions ?? []);
      setApprovedDocument(response.approved_document ?? null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  return <SubmissionDetailSection title="Document History">
    <div className="department-history">
      <button type="button" className="outline department-history__trigger" onClick={toggle}>
        <History size={16} /> {open ? "Hide History" : "History"}
      </button>
      {viewingVersion && <button type="button" className="table-action" onClick={onCloseVersion}>Return to current version</button>}
      {open && <div className="department-history__events">
        {loading && <p>Loading history...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && !original && <p>No original document found.</p>}
        {original && <article className="department-history__version"><div><b>Original Document</b><small>{original.file.filename}</small></div><button type="button" className="table-action" onClick={() => onViewVersion(original)}>View Document</button></article>}
        <div className="department-history__group"><b>Highlighted Versions</b>{highlightedVersions.map((version) => <article key={`highlighted-${version.file.id}`} className="department-history__version"><div><b>Version {version.file.version}</b><small>{version.annotations.length} saved review annotation{version.annotations.length === 1 ? "" : "s"}</small></div><button type="button" className="table-action" onClick={() => onViewVersion(version)}>View Highlighted Version</button></article>)}{!highlightedVersions.length && <p>No saved highlighted versions.</p>}</div>
        {approvedDocument && <div className="department-history__group"><b>Approved Document</b><article className="department-history__version"><div><b>APPROVED - Version {approvedDocument.file.version}</b><small>{approvedDocument.approved_at ? new Date(approvedDocument.approved_at).toLocaleString() : approvedDocument.file.filename}</small></div><button type="button" className="table-action" onClick={() => onViewVersion(approvedDocument)}>View Approved Document</button></article></div>}
        {false && versions.map((version) => <article key={version.file.id} className="department-history__version">
          <div><b>{version.label}{version.latest ? " · Latest" : ""}</b><small>{version.status}{version.approved_at ? ` · ${new Date(version.approved_at).toLocaleString()}` : ""}</small></div>
          <button type="button" className="table-action" onClick={() => onViewVersion(version)}>View {version.annotations?.length ? "Highlighted " : ""}Document</button>
        </article>)}
        {events.map((event) => <article key={event.id}>
          <div><b>{event.label}</b><small>{event.actor} · {event.created_at ? new Date(event.created_at).toLocaleString() : ""}</small></div>
          {event.file && <button type="button" className="table-action" onClick={() => onViewVersion(versions.find((version) => version.file.id === event.file.id) || { file: event.file, annotations: [] })}>View Document</button>}
        </article>)}
      </div>}
    </div>
  </SubmissionDetailSection>;
}

function DepartmentalVersionAnnotations({ version }) {
  return <SubmissionDetailSection title={`${version.label} Annotations`}>
    <div className="department-history__annotations">
      <p><b>{version.status}</b>{version.approved_at ? ` · Approved ${new Date(version.approved_at).toLocaleString()}` : ""}</p>
      {!version.annotations?.length && <p>No saved annotations for this version.</p>}
      {(version.annotations ?? []).map((item) => <article key={item.id}>
        <small>{item.department || "Department"} · {item.author || "Staff"}</small>
        {item.selected_text && <blockquote>{item.selected_text}</blockquote>}
        {item.comment && <p>{item.comment}</p>}
      </article>)}
    </div>
  </SubmissionDetailSection>;
}

function DepartmentalReviewPanel({ document, review, isCreator, onReviewChange, onRemoveAnnotation, onDocumentChange }) {
  const [comment, setComment] = React.useState("");
  const [replyTo, setReplyTo] = React.useState("");
  const [replyText, setReplyText] = React.useState("");
  const [color, setColor] = React.useState("yellow");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const canReview = !isCreator && document.status === "Department Review";
  const canRemoveAnnotation = !isCreator && ["Department Review", "Corrections Needed", "Partner Review Complete"].includes(document.status);

  const load = React.useCallback(async () => {
    try {
      onReviewChange(await getDepartmentReview(document.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [document.id, onReviewChange]);

  React.useEffect(() => { load(); }, [load]);

  async function saveItem(type) {
    if (type === "comment" && !comment.trim()) {
      setError("Enter a document comment.");
      return;
    }
    setSaving(true); setError("");
    try {
      await createDepartmentReviewItem(document.id, { type, comment: type === "comment" ? comment.trim() : null });
      setComment("");
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function approve() {
    const previous = document; onDocumentChange({ ...document, status: "Partner Review Complete" }); setSaving(true); setError("");
    try {
      const response = await approveDepartmentReview(document.id);
      onDocumentChange(response.document ?? response.data);
      await load();
    } catch (requestError) { onDocumentChange(previous); setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function requestCorrection() {
    if (!comment.trim()) { setError("Explain the correction required before sending it."); return; }
    const previous = document; onDocumentChange({ ...document, status: "Corrections Needed" }); setSaving(true); setError("");
    try {
      await requestDepartmentCorrection(document.id, comment.trim());
      setComment("");
      onDocumentChange({ ...document, status: "Corrections Needed" });
      await load();
    } catch (requestError) { onDocumentChange(previous); setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function reply() {
    if (!replyTo || !replyText.trim()) return;
    setSaving(true); setError("");
    try {
      await createDepartmentReviewItem(document.id, { type: "reply", parent_id: replyTo, comment: replyText.trim() });
      setReplyTo(""); setReplyText(""); await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function removeAnnotation(itemId) {
    const previous = review;
    onReviewChange({ ...(review ?? {}), items: (review?.items ?? []).filter((item) => item.id !== itemId) });
    setSaving(true); setError("");
    try {
      await onRemoveAnnotation(itemId);
    } catch (requestError) {
      onReviewChange(previous);
      setError(requestError.message || "Unable to remove this annotation.");
    } finally {
      setSaving(false);
    }
  }

  return <SubmissionDetailSection title="Departmental Review">
    <div className="departmental-review">
      <p className="departmental-review__hint">Both participating departments review this same file. Highlights and comments are shared and retained with the submission.</p>
      <div className="departmental-review__legend" aria-label="Highlight legend"><b>Highlight legend</b><span><i className="departmental-review__legend-dot departmental-review__legend-dot--yellow" />{document.department?.name || "Submitting Department"}</span><span><i className="departmental-review__legend-dot departmental-review__legend-dot--blue" />{document.partner_department?.name || "Partner Department"}</span></div>
      <div className="departmental-review__approvals">
        {(review?.reviews ?? []).map((entry) => <p key={entry.department_id}><b>{entry.department || "Department"}</b><span className={entry.approved_at ? "badge active" : "badge pending"}>{entry.approved_at ? "Approved" : "Pending review"}</span></p>)}
      </div>
      {canReview && <>
        <p className="departmental-review__hint">Select text in the document preview to add a contextual highlight or comment.</p>
        <label>Correction note<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Explain the correction required." /></label>
        <div className="departmental-review__actions"><button type="button" className="danger" disabled={saving} onClick={requestCorrection}>Request Correction</button><button type="button" disabled={saving} onClick={approve}>Approve Review</button></div>
      </>}
      {(review?.items ?? []).length > 0 && <div className="departmental-review__items">{review.items.map((item) => { const marker = item.type === "highlight" ? item.display_number : null; return <article key={item.id}><small>{marker && <b className="departmental-review__marker">Highlight #{marker}</b>}{item.department || "Department"} · {item.author || "Staff"} · {item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>{item.selected_text && <blockquote className={`departmental-review__highlight departmental-review__highlight--${item.highlight_color || "yellow"}`}>{item.selected_text}</blockquote>}{item.comment && <p>{item.comment}</p>}{canRemoveAnnotation && <button type="button" className="table-action danger departmental-review__delete" title="Remove annotation" aria-label="Remove annotation" disabled={saving} onMouseDown={(event) => event.stopPropagation()} onClick={() => removeAnnotation(item.id)}><Trash2 size={14} /></button>}</article>; })}</div>}
      {error && <p className="auth-error">{error}</p>}
    </div>
  </SubmissionDetailSection>;
}

function DepartmentDiscussionPanel({ document, currentDepartmentId }) {
  const documentId = document.id;
  const [messages, setMessages] = React.useState([]); const [text, setText] = React.useState(""); const [error, setError] = React.useState(""); const [sending, setSending] = React.useState(false); const [open, setOpen] = React.useState(false);
  const load = React.useCallback(async () => { try { const result = await getDepartmentDiscussion(documentId); setMessages(result.messages ?? []); } catch (e) { setError(e.message); } }, [documentId]);
  React.useEffect(() => { load(); const timer = window.setInterval(load, 12000); return () => window.clearInterval(timer); }, [load]);
  async function send() { if (!text.trim() || sending) return; const body = text.trim(); const temporaryId = `pending-message-${Date.now()}`; const optimistic = { id: temporaryId, message: body, department_id: currentDepartmentId, department: document.department?.name || "Your Department", created_at: new Date().toISOString() }; setMessages((current) => [...current, optimistic]); setText(""); setSending(true); setError(""); try { const result = await sendDepartmentDiscussionMessage(documentId, body); setMessages((current) => current.map((message) => message.id === temporaryId ? result.message : message).filter((message, index, all) => all.findIndex((entry) => entry.id === message.id) === index)); } catch (e) { setMessages((current) => current.filter((message) => message.id !== temporaryId)); setText(body); setError(e.message || "Unable to send message. Please try again."); } finally { setSending(false); } }
  return <div className="submission-discussion"><button type="button" className="submission-discussion__launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open}>💬 Discussion{messages.length > 0 && <span>{messages.length}</span>}</button>{open && <section className="submission-discussion__window"><header><b>Submission Discussion</b><button type="button" onClick={() => setOpen(false)} aria-label="Close discussion">×</button></header><div className="submission-discussion__messages">{messages.map((message) => <article key={message.id} className={message.department_id === currentDepartmentId ? "is-current" : ""}><small><b>{message.department_id === currentDepartmentId ? "You" : message.department || "Department"}</b> · {message.author || "Staff"}</small><p>{message.message}</p><time>{message.created_at ? new Date(message.created_at).toLocaleString() : ""}</time></article>)}</div><div className="submission-discussion__compose"><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a message..." /><button type="button" disabled={sending || !text.trim()} onClick={send}>{sending ? "Sending..." : "Send"}</button></div>{error && <p className="auth-error">{error}</p>}</section>}</div>;
}

function departmentalStatusLabel(document, isCreator) {
  if (!document?.partner_department_id) return document?.status;
  if (isCreator) {
    if (document.status === "Department Review") return "Under Partner Department Review";
    if (document.status === "Corrections Needed") return "Ready for Correction";
    if (document.status === "Partner Review Complete") return "Partner Review Complete — Ready to Route";
    return document.status;
  }
  if (document.status === "Department Review") return "Pending Your Review";
  if (document.status === "Corrections Needed") return "Awaiting Creator's Corrections";
  if (document.status === "Partner Review Complete") return "Review Complete — Returned to Creator";
  if (document.status === "Submitted") return "Routed to Staff Review";
  return document.status;
}

function formatDocumentDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

// Lists external partnerships visible to the department.
function EngagementsPage() {
  const {
    filters,
    updateFilter,
    clearFilters,
  } = useDocumentFilters();

  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle title="Engagements Management" subtitle="Oversee institutional partnerships and document compliance for your office." />
        <Panel title="Partner Engagements">
          <DocumentFilters
            filters={filters}
            onChange={updateFilter}
            onClear={clearFilters}
            statusOptions={["Active", "Renewal Required", "Renewed", "Expired"]}
            showDepartment={false}
            showExpiryWindow
            unsupported={{
              search: true,
              document_type: true,
              partnership_scope: true,
              status: true,
              date_from: true,
              date_to: true,
              expiry_window: true,
            }}
          />
          <DataTable
            headers={[
              "Partner Organization",
              "Agreement",
              "Duration",
              "Documents",
              "Status",
            ]}
            rows={[]}
          />
        </Panel>
      </div>
      <aside className="detail-drawer">
        <h2>Engagement Details</h2>
        <div className="mini-grid">
          <span>Start Date<b>Jan 12, 2024</b></span>
          <span>Expiration<b>Jan 11, 2029</b></span>
        </div>
        <h3>Submission Compliance</h3>
        <div className="notice"><b>Notarized MOA</b><p>Verified</p></div>
        <div className="notice"><b>Institutional Profile</b><p>Verified</p></div>
        <div className="notice warn"><b>Financial Audit</b><p>Pending</p></div>
        <button className="primary wide-inline" disabled>
          Renewal workflow unavailable
        </button>
      </aside>
    </section>
  );
}
