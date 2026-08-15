import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Globe2,
  MapPin,
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
import { PreSubmissionModal } from "../components/PreSubmissionModal";
import DepartmentSettingsPage from "../features/department-staff/settings/Page";
import {
  createDepartmentDocument,
  getDepartmentDocuments,
  resubmitDepartmentDocument,
} from "../services/departmentStaffService";
import { uploadDocumentFile } from "../services/documentFileService";
import { reportClientError } from "../utils/reportClientError";

const partnershipTypes = [
  ["Departmental", Building2],
  ["Local", MapPin],
  ["International", Globe2],
];

const collaboratingDepartments = [
  "School of Engineering and Architecture",
  "School of Computer Science",
  "School of Education",
  "School of Business and Management",
  "School of Law",
  "School of Arts and Sciences",
  "Expanded Tertiary Education Equivalency and Accreditation Program (ETEEAP)",
  "School of Allied Medical Sciences",
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
  if (page === "submissions") return <MySubmissionsPage />;
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

  React.useEffect(() => {
    const storedDraft = sessionStorage.getItem("department-submission-draft");
    if (!storedDraft) return;

    try {
      const draft = JSON.parse(storedDraft);
      setPreSubmissionAnswers(draft);
      setForm({
        partnershipType: draft.partnerClassification === "interdepartmental" ? "Departmental" : draft.partnerClassification === "international" ? "International" : "Local",
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
      setForm((current) => ({
        ...current,
        partnerDepartmentId: value,
        partnerInstitution: value,
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
          description: (form.description.trim() || formatReviewFormDetails({
            ...form,
            partnerClassification: form.partnershipType === "Departmental" ? "interdepartmental" : form.partnershipType.toLowerCase(),
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
                      {type === "Departmental" ? "Interdepartmental" : type}
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
                    {collaboratingDepartments.map((department) => (
                      <option key={department} value={department}>
                        {department}
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
                  <p><b>Classification:</b> {preSubmissionAnswers.partnerClassification === "interdepartmental" ? "Interdepartmental" : preSubmissionAnswers.partnerClassification.charAt(0).toUpperCase() + preSubmissionAnswers.partnerClassification.slice(1)}</p>
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
        <SummaryField label="Partner Classification" value={form.partnershipType === "Departmental" ? "Interdepartmental" : form.partnershipType} />
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
function MySubmissionsPage() {
 const [documents, setDocuments] = React.useState([]);
 const [selectedDocument, setSelectedDocument] =
  React.useState(null);
 const [reviewOpen, setReviewOpen] = React.useState(false);

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
      {document.status}
    </span>,

    <button
      key={`view-${document.id}`}
      type="button"
      className="table-action"
      onClick={() => {
        setSelectedDocument(document);
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

    setProcessing(true);
    setError("");
    setSuccess("");

    let updatedDocument;

    try {
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
    setSuccess("Document successfully resubmitted.");
    setProcessing(false);
  }

  if (reviewOpen && selectedDocument) {
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
            <DocumentFilesPanel documentId={selectedDocument.id} embeddedPreview />
          </main>
          <aside className="department-submission-review__details">
            <h2>Submission Details</h2>
            <SubmissionDetailSection title="Submission Information">
              <SubmissionDetail label="Tracking Number" value={selectedDocument.tracking_number} />
              <SubmissionDetail label="Status" value={selectedDocument.status} />
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
            {selectedDocument.legal_notes && <SubmissionDetailSection title="Legal Remarks"><div className="notice danger"><p>{selectedDocument.legal_notes}</p></div></SubmissionDetailSection>}
            {selectedDocument.status === "Corrections Needed" && <button disabled={processing} onClick={resubmitDocument}>{processing ? "Resubmitting..." : "Resubmit Document"}</button>}
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
