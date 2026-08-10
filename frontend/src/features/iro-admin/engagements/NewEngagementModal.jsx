import React from "react";

import { Dropzone } from "../../../components/SharedViews";
import { createIroDocument } from "../../../services/iroStaffService";
import { uploadDocumentFile } from "../../../services/documentFileService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

const initialForm = {
  document_type: "MOA",
  partnership_type: "New Partnership",
  partnership_scope: "Local",
  title: "",
  partner_institution: "",
  description: "",
  contact_person: "",
  contact_position: "",
  contact_email: "",
  contact_number: "",
  urgency: "Normal",
  requested_completion_date: "",
};

export function IroNewEngagementModal({ open, onClose, onCreated }) {
  const [modalStep, setModalStep] = React.useState(1);
  const [form, setForm] = React.useState(initialForm);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [modalError, setModalError] = React.useState("");
  const [modalSuccess, setModalSuccess] = React.useState("");
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setModalStep(1);
    setForm(initialForm);
    setSelectedFile(null);
    setSubmitting(false);
    setModalError("");
    setModalSuccess("");
  }, [open]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setModalError("");
    setModalSuccess("");
  }

  function validateStep(currentStep) {
    if (currentStep === 1) {
      if (!form.document_type) {
        return "Select a document classification.";
      }
      if (!form.partnership_type) {
        return "Select a partnership status.";
      }
      if (!form.partnership_scope) {
        return "Select a partnership scope.";
      }
    }

    if (currentStep === 2) {
      if (!form.title.trim()) {
        return "Enter a document title.";
      }
      if (!form.partner_institution.trim()) {
        return "Enter a partner institution.";
      }
    }

    if (currentStep === 3) {
      if (!form.contact_person.trim()) {
        return "Enter a contact person.";
      }
      if (!form.contact_email.trim()) {
        return "Enter a contact email.";
      }
    }

    if (currentStep === 4) {
      if (!selectedFile) {
        return "Attach the draft MOA/MOU/MOF file.";
      }
    }

    return "";
  }

  function advanceStep() {
    const validationMessage = validateStep(modalStep);

    if (validationMessage) {
      setModalError(validationMessage);
      return;
    }

    setModalError("");
    setModalStep((current) => Math.min(current + 1, 4));
  }

  function previousStep() {
    setModalError("");
    setModalStep((current) => Math.max(current - 1, 1));
  }

  function closeModal() {
    if (submitting) return;
    setModalStep(1);
    setForm(initialForm);
    setSelectedFile(null);
    setModalError("");
    setModalSuccess("");
    onClose?.();
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return "-";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function submitNewEngagement(event) {
    event.preventDefault();

    const validationMessage = validateStep(4);
    if (validationMessage) {
      setModalError(validationMessage);
      return;
    }

    setSubmitting(true);
    setModalError("");
    setModalSuccess("");

    try {
      const response = await createIroDocument({
        title: form.title.trim(),
        document_type: form.document_type,
        partner_institution: form.partner_institution.trim(),
        partner_email: null,
        description: form.description.trim() || null,
        partnership_type: form.partnership_type,
        partnership_scope: form.partnership_scope,
        contact_person: form.contact_person.trim(),
        contact_position: form.contact_position.trim() || null,
        contact_email: form.contact_email.trim(),
        contact_number: form.contact_number.trim() || null,
        urgency: form.urgency,
        requested_completion_date: form.requested_completion_date || null,
      });

      const document = response.document ?? response.data;
      if (!document?.id) {
        throw new Error("Unable to create the new engagement.");
      }

      await uploadDocumentFile(document.id, selectedFile);
      setModalSuccess("New engagement created and document attached successfully.");
      if (mountedRef.current) {
        setSubmitting(false);
      }
      onClose?.();
      await onCreated?.();
    } catch (requestError) {
      reportClientError("Unable to create engagement:", requestError);
      setModalError(requestError.message || "Unable to create the engagement.");
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="engagement-modal-backdrop" role="presentation" onClick={closeModal}>
      <section
        className="engagement-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="engagement-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="engagement-modal-title">New Engagement</h2>
            <p>Collect engagement details and attach the draft agreement.</p>
          </div>
          <button type="button" aria-label="Close" onClick={closeModal}>
            Close
          </button>
        </header>

        <div className="engagement-steps">
          <span className={modalStep >= 1 ? "active" : ""}>1. Classification</span>
          <span className={modalStep >= 2 ? "active" : ""}>2. Details</span>
          <span className={modalStep >= 3 ? "active" : ""}>3. Contact</span>
          <span className={modalStep >= 4 ? "active" : ""}>4. Attachments</span>
        </div>

        <form className="engagement-form" onSubmit={submitNewEngagement}>
          {modalStep === 1 && (
            <div className="form-step">
              <label>
                Agreement Type
                <select name="document_type" value={form.document_type} onChange={updateForm}>
                  <option value="MOA">MOA</option>
                  <option value="MOU">MOU</option>
                  <option value="MOF">MOF</option>
                </select>
              </label>

              <label>
                Partnership Status
                <select name="partnership_type" value={form.partnership_type} onChange={updateForm}>
                  <option value="New Partnership">New Partnership</option>
                  <option value="Renewal">Renewal</option>
                </select>
              </label>

              <label>
                Partnership Scope
                <select name="partnership_scope" value={form.partnership_scope} onChange={updateForm}>
                  <option value="Local">Local</option>
                  <option value="International">International</option>
                </select>
              </label>
            </div>
          )}

          {modalStep === 2 && (
            <div className="form-step">
              <label>
                Title
                <input
                  name="title"
                  value={form.title}
                  onChange={updateForm}
                  placeholder="Agreement title"
                />
              </label>

              <label>
                Partner Institution
                <input
                  name="partner_institution"
                  value={form.partner_institution}
                  onChange={updateForm}
                  placeholder="Partner institution name"
                />
              </label>

              <label>
                Description / Purpose
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  rows={4}
                  placeholder="Describe the engagement purpose."
                />
              </label>
            </div>
          )}

          {modalStep === 3 && (
            <div className="form-step">
              <label>
                Contact Person
                <input
                  name="contact_person"
                  value={form.contact_person}
                  onChange={updateForm}
                  placeholder="Contact person name"
                />
              </label>

              <label>
                Position
                <input
                  name="contact_position"
                  value={form.contact_position}
                  onChange={updateForm}
                  placeholder="Contact position"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  name="contact_email"
                  value={form.contact_email}
                  onChange={updateForm}
                  placeholder="Contact email"
                />
              </label>

              <label>
                Contact Number
                <input
                  name="contact_number"
                  value={form.contact_number}
                  onChange={updateForm}
                  placeholder="Contact phone or mobile"
                />
              </label>
            </div>
          )}

          {modalStep === 4 && (
            <div className="form-step">
              <label className="file-label">
                Upload Draft MOA/MOU/MOF
                <Dropzone
                  selectedFile={selectedFile}
                  detail={selectedFile ? formatFileSize(selectedFile.size) : "PDF, DOCX, ODT - required"}
                  onFileSelect={(file) => setSelectedFile(file)}
                  onRemove={() => setSelectedFile(null)}
                />
              </label>

              <label>
                Requested Completion Date
                <input
                  type="date"
                  name="requested_completion_date"
                  value={form.requested_completion_date}
                  onChange={updateForm}
                />
              </label>

              <label>
                Urgency
                <select name="urgency" value={form.urgency} onChange={updateForm}>
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Highly Urgent">Highly Urgent</option>
                </select>
              </label>
            </div>
          )}

          {modalError && <p className="auth-error">{modalError}</p>}
          {modalSuccess && <p className="success-message">{modalSuccess}</p>}

          <div className="engagement-modal-actions">
            {modalStep > 1 ? (
              <button type="button" className="outline" onClick={previousStep} disabled={submitting}>
                Back
              </button>
            ) : (
              <button type="button" className="outline" onClick={closeModal} disabled={submitting}>
                Cancel
              </button>
            )}

            {modalStep < 4 ? (
              <button type="button" onClick={advanceStep} disabled={submitting}>
                Continue
              </button>
            ) : (
              <button type="submit" disabled={submitting || !selectedFile}>
                {submitting ? "Creating..." : "Create Engagement"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
