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
import { getDepartments } from "../services/departmentService";
import { uploadDocumentFile } from "../services/documentFileService";
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
    // Store pre-submission selections in sessionStorage
    sessionStorage.setItem(
      "department-pre-submission",
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
  });

  const [submitting, setSubmitting] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [success, setSuccess] =
    React.useState("");

  const [selectedFile, setSelectedFile] =
    React.useState(null);
  const [departments, setDepartments] =
    React.useState([]);
  const [loadingDepartments, setLoadingDepartments] =
    React.useState(false);
  const [step, setStep] = React.useState(1);
  const [submittedTrackingNumber, setSubmittedTrackingNumber] =
    React.useState("");

  React.useEffect(() => {
    async function loadDepartments() {
      setLoadingDepartments(true);

      try {
        const response = await getDepartments({
          per_page: 100,
          sort: "code",
          direction: "asc",
        });
        setDepartments(response.data ?? []);
      } catch (requestError) {
        reportClientError("Unable to load departments:", requestError);
        setDepartments([]);
      } finally {
        setLoadingDepartments(false);
      }
    }

    loadDepartments();
  }, []);

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
      const department = departments.find(
        (item) => item.id === value,
      );

      setForm((current) => ({
        ...current,
        partnerDepartmentId: value,
        partnerInstitution: department
          ? formatDepartmentName(department)
          : "",
        partnerEmail: department?.email || "",
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

    setError("");
    setStep(2);
  }

  function continueToConfirmation() {
    setError("");
    setStep(3);
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

    if (!account?.id || !account?.departmentId) {
      setError(
        "Your account has no department assignment.",
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
          title: `${partnerName} ${form.agreementType}`,
          document_type: form.agreementType,
          partner_institution: partnerName,
          partner_email:
            form.partnerEmail.trim() || null,
          description:
            form.description.trim() || null,
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
    });

    setSelectedFile(null);
    setStep(3);
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
              <fieldset className="full-width segmented-field">
                <legend>Partnership Type</legend>
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
                      {type}
                    </button>
                  ))}
                </div>
              </fieldset>

              {form.partnershipType === "Departmental" ? (
                <label>
                  Partner Department
                  <select
                    name="partnerDepartmentId"
                    value={form.partnerDepartmentId}
                    onChange={updateForm}
                    disabled={loadingDepartments}
                    required
                  >
                    <option value="">
                      {loadingDepartments
                        ? "Loading departments..."
                        : "Select department"}
                    </option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {formatDepartmentName(department)}
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
                Partner Contact Email
                <input
                  className={form.partnershipType === "Departmental" ? "auto-filled-input" : ""}
                  name="partnerEmail"
                  type="email"
                  value={form.partnerEmail}
                  onChange={updateForm}
                  readOnly={form.partnershipType === "Departmental"}
                  placeholder={form.partnershipType === "Departmental" ? "Auto-filled from department" : "contact@partner.edu"}
                />
              </label>

              <label className="full-width">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  placeholder="Briefly describe the agreement."
                  rows="4"
                />
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
              subtitle="Upload the agreement draft for review."
            >
              <Dropzone
                label="Drag and drop agreement draft"
                detail="PDF, DOCX, ODT - Maximum 25 MB"
                selectedFile={selectedFile}
                disabled={submitting}
                onFileSelect={setSelectedFile}
                onRemove={() => setSelectedFile(null)}
              />
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
    <aside className={compact ? "summary-card compact" : "summary-card"}>
      <h2>Review Summary</h2>
      <p>Partnership Type: <b>{form.partnershipType}</b></p>
      <p>{form.partnershipType === "Departmental" ? "Partner Department" : "Partner / Institution"}: <b>{form.partnerInstitution || "-"}</b></p>
      <p>Agreement Type: <b>{form.agreementType}</b></p>
      <p>Expected Duration: <b>{durationLabel(form)}</b></p>
      <p>Partner Contact: <b>{form.partnerEmail || "-"}</b></p>
      {!compact && <p>Description: <b>{form.description || "-"}</b></p>}
      <p>Selected File: <b>{selectedFile?.name || "No file selected"}</b></p>
      <p>Processing Office: <b>{account?.office || "Assigned Department"}</b></p>
      <p>Initial Status: <b>Submitted</b></p>
    </aside>
  );
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

function formatDepartmentName(department) {
  if (!department) {
    return "";
  }

  return department.code
    ? `${department.code} - ${department.name}`
    : department.name;
}

// Shows department-owned submissions and legal comments.
function MySubmissionsPage() {
 const [documents, setDocuments] = React.useState([]);
 const [selectedDocument, setSelectedDocument] =
  React.useState(null);

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

        setSelectedDocument((current) => {
          if (!loadedDocuments.length) return null;

          return (
            loadedDocuments.find(
              (document) => document.id === current?.id
            ) || loadedDocuments[0]
          );
        });
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
        setError("");
        setSuccess("");
      }}
    >
      View
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

  return (
    <section className="page split-page department-page">
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

      <aside className="detail-drawer">
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
      </aside>
    </section>
  );
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
