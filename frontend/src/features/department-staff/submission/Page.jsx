import React from "react";
import { UploadCloud } from "lucide-react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Dropzone } from "../../../components/SharedViews";
import { createDepartmentDocument } from "../../../services/departmentStaffService";
import { uploadDocumentFile } from "../../../services/documentFileService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

const initialForm = {
  partnerInstitution: "",
  agreementType: "MOA",
  expectedDuration: "5 Years",
  partnerEmail: "",
  description: "",
};

export default function Page({ account }) {
  const [form, setForm] = React.useState(initialForm);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setError("");
    setSuccess("");
  }

  async function submitDocument(event) {
    event.preventDefault();

    if (!form.partnerInstitution.trim()) {
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
      const response = await createDepartmentDocument({
        tracking_number: createTrackingNumber(),
        title: `${form.partnerInstitution.trim()} ${form.agreementType}`,
        document_type: form.agreementType,
        partner_institution: form.partnerInstitution.trim(),
        partner_email: form.partnerEmail.trim() || null,
        description: form.description.trim() || null,
        ...expiryPayload(form.expectedDuration),
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

    setSuccess(
      `Document submitted successfully. Tracking number: ${document.tracking_number}`,
    );
    setForm(initialForm);
    setSelectedFile(null);
    setSubmitting(false);
  }

  return (
    <section className="department-submission-page">
      <PageTitle
        title="Submit New Document"
        subtitle={`Initiate a formal review process from ${account?.department || account?.departmentCode || "your department"}.`}
      />

      <form onSubmit={submitDocument}>
        <div className="department-submission-layout">
          <div className="department-submission-main">
            <Panel title="Partner Institution Details">
              <div className="department-form-grid">
                <label>
                  Partner Institution Name
                  <input
                    name="partnerInstitution"
                    value={form.partnerInstitution}
                    onChange={updateForm}
                    disabled={submitting}
                    placeholder="e.g. Global Tech University"
                    required
                  />
                </label>

                <label>
                  Agreement Type
                  <select
                    name="agreementType"
                    value={form.agreementType}
                    onChange={updateForm}
                    disabled={submitting}
                  >
                    <option value="MOA">Memorandum of Agreement (MOA)</option>
                    <option value="MOU">Memorandum of Understanding (MOU)</option>
                    <option value="MOF">Memorandum of Funding (MOF)</option>
                  </select>
                </label>

                <label>
                  Expected Duration
                  <select
                    name="expectedDuration"
                    value={form.expectedDuration}
                    onChange={updateForm}
                    disabled={submitting}
                  >
                    <option value="5 Years">5 Years (Standard)</option>
                    <option value="3 Years">3 Years</option>
                    <option value="1 Year">1 Year</option>
                  </select>
                </label>

                <label>
                  Partner Contact Email
                  <input
                    name="partnerEmail"
                    type="email"
                    value={form.partnerEmail}
                    onChange={updateForm}
                    disabled={submitting}
                    placeholder="contact@partner.edu"
                  />
                </label>

                <label className="department-form-wide">
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateForm}
                    disabled={submitting}
                    placeholder="Briefly describe the agreement."
                    rows="4"
                  />
                </label>
              </div>
            </Panel>

            <Panel title="Document Upload">
              <Dropzone
                label={selectedFile?.name || "Drag and drop agreement draft here"}
                detail="PDF, DOCX, ODT - MAX 25MB"
              />
              <input
                type="file"
                accept=".pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
                disabled={submitting}
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] || null)
                }
              />
            </Panel>

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="success-message">{success}</div>}
          </div>

          <aside className="department-summary-card">
            <h2>Review Summary</h2>
            <p>Intended Partner: <b>{form.partnerInstitution || "-"}</b></p>
            <p>Agreement Class: <b>{form.agreementType}</b></p>
            <p>Processing Office: <b>{account?.departmentCode || "Assigned Department"}</b></p>
            <p>Initial Status: <b>Submitted</b></p>

            <button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit for Review"}
              {!submitting && <UploadCloud size={18} />}
            </button>

            <button type="button" disabled>
              Save Draft - Backend Required
            </button>
          </aside>
        </div>
      </form>
    </section>
  );
}

function createTrackingNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `CONEXIA-${datePart}-${randomPart}`;
}

function expiryPayload(expectedDuration) {
  const effectiveDate = new Date();
  const expiryDate = new Date(effectiveDate);
  const years = Number.parseInt(expectedDuration, 10);

  if (!Number.isFinite(years)) {
    return {};
  }

  expiryDate.setFullYear(effectiveDate.getFullYear() + years);

  return {
    effective_date: effectiveDate.toISOString().slice(0, 10),
    expiry_date: expiryDate.toISOString().slice(0, 10),
    renewal_notice_days: 30,
    renewal_status: "active",
  };
}
