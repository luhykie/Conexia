import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe2,
  MapPin,
  UploadCloud,
} from "lucide-react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Dropzone } from "../../../components/SharedViews";
import { createDepartmentDocument } from "../../../services/departmentStaffService";
import { getDepartments } from "../../../services/departmentService";
import { uploadDocumentFile } from "../../../services/documentFileService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

const initialForm = {
  partnershipType: "Departmental",
  partnerDepartmentId: "",
  partnerInstitution: "",
  agreementType: "MOA",
  durationValue: "5",
  durationUnit: "Years",
  partnerEmail: "",
  description: "",
};

const partnershipTypes = [
  ["Departmental", Building2],
  ["Local", MapPin],
  ["International", Globe2],
];

export default function Page({ account }) {
  const [form, setForm] = React.useState(initialForm);
  const [departments, setDepartments] = React.useState([]);
  const [loadingDepartments, setLoadingDepartments] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [step, setStep] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [submittedTrackingNumber, setSubmittedTrackingNumber] =
    React.useState("");

  React.useEffect(() => {
    async function loadDepartments() {
      setLoadingDepartments(true);

      try {
        const response = await getDepartments({ per_page: 100 });
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

  async function submitDocument(event) {
    event.preventDefault();

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

    if (!account?.id || !account?.departmentId) {
      setError("Your account has no department assignment.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    let document;

    try {
      const partnerName = form.partnerInstitution.trim();
      const response = await createDepartmentDocument({
        title: `${partnerName} ${form.agreementType}`,
        document_type: form.agreementType,
        partner_institution: partnerName,
        partner_email: form.partnerEmail.trim() || null,
        description: form.description.trim() || null,
        ...expiryPayload(form),
      });

      document = response.document ?? response.data;
    } catch (requestError) {
      reportClientError("Document submission failed:", requestError);
      setError(requestError.message);
      setSubmitting(false);
      return;
    }

    if (selectedFile && document?.id) {
      try {
        await uploadDocumentFile(document.id, selectedFile);
      } catch (requestError) {
        reportClientError("Document file upload failed:", requestError);
        setError(requestError.message);
        setSubmitting(false);
        return;
      }
    }

    setSubmittedTrackingNumber(document.tracking_number || "");
    setSuccess("Submission successful.");
    setForm(initialForm);
    setSelectedFile(null);
    setStep(3);
    setSubmitting(false);
  }

  return (
    <section className="department-submission-page">
      <PageTitle
        title="Submit New Document"
        subtitle={`Initiate a formal review process from ${account?.department || account?.departmentCode || "your department"}.`}
      />

      <form className="submission-wizard" onSubmit={submitDocument}>
        <div className="steps submission-steps" aria-label="Submission progress">
          <span className={step >= 1 ? "on" : ""}>1<b>Partner Info</b></span>
          <span className={step >= 2 ? "on" : ""}>2<b>Upload</b></span>
          <span className={step >= 3 ? "on" : ""}>3<b>Confirmation</b></span>
        </div>

        {step === 1 && (
          <Panel title="Partnership Information">
            <div className="department-form-grid">
              <fieldset className="department-form-wide segmented-field">
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
                    disabled={submitting || loadingDepartments}
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
                  <input name="partnerInstitution" value={form.partnerInstitution} onChange={updateForm} disabled={submitting} placeholder="e.g. Global Tech University" required />
                </label>
              )}

              <label>
                Agreement Type
                <select name="agreementType" value={form.agreementType} onChange={updateForm} disabled={submitting}>
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
                    disabled={submitting}
                    required
                  />
                  <select name="durationUnit" value={form.durationUnit} onChange={updateForm} disabled={submitting}>
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
                  disabled={submitting}
                  readOnly={form.partnershipType === "Departmental"}
                  placeholder={form.partnershipType === "Departmental" ? "Auto-filled from department" : "contact@partner.edu"}
                />
              </label>

              <label className="department-form-wide">
                Description
                <textarea name="description" value={form.description} onChange={updateForm} disabled={submitting} placeholder="Briefly describe the agreement." rows="4" />
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
            <Panel title="Document Upload" subtitle="Upload the agreement draft for review.">
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
                  <button type="button" className="outline" disabled={submitting} onClick={() => backToStep(2)}>
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
    <aside className={compact ? "department-summary-card compact" : "department-summary-card"}>
      <h2>Review Summary</h2>
      <p>Partnership Type: <b>{form.partnershipType}</b></p>
      <p>{form.partnershipType === "Departmental" ? "Partner Department" : "Partner / Institution"}: <b>{form.partnerInstitution || "-"}</b></p>
      <p>Agreement Type: <b>{form.agreementType}</b></p>
      <p>Expected Duration: <b>{durationLabel(form)}</b></p>
      <p>Partner Contact: <b>{form.partnerEmail || "-"}</b></p>
      {!compact && <p>Description: <b>{form.description || "-"}</b></p>}
      <p>Selected File: <b>{selectedFile?.name || "No file selected"}</b></p>
      <p>Processing Office: <b>{account?.departmentCode || "Assigned Department"}</b></p>
      <p>Initial Status: <b>Submitted</b></p>
    </aside>
  );
}

function formatDepartmentName(department) {
  if (!department) {
    return "";
  }

  return department.code
    ? `${department.name} (${department.code})`
    : department.name;
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

function expiryPayload(form) {
  const effectiveDate = new Date();
  const expiryDate = new Date(effectiveDate);
  const duration = Number.parseInt(form.durationValue, 10);

  if (!Number.isFinite(duration) || duration < 1) {
    return {};
  }

  if (form.durationUnit === "Months") {
    expiryDate.setMonth(effectiveDate.getMonth() + duration);
  } else {
    expiryDate.setFullYear(effectiveDate.getFullYear() + duration);
  }

  return {
    effective_date: effectiveDate.toISOString().slice(0, 10),
    expiry_date: expiryDate.toISOString().slice(0, 10),
    renewal_notice_days: 30,
    renewal_status: "active",
  };
}
