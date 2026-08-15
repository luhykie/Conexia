import React from "react";
import {
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from "libphonenumber-js/max";

import { Dropzone } from "../../../components/SharedViews";
import { createIroDocument } from "../../../services/iroStaffService";
import { uploadDocumentFile } from "../../../services/documentFileService";
import { getDepartments } from "../../../services/departmentService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

const initialForm = {
  document_type: "MOA",
  partnership_type: "New Partnership",
  partnership_scope: "Local",
  title: "",
  partner_institution: "",
  department_id: "",
  description: "",
  contact_person: "",
  contact_position: "",
  contact_email: "",
  contact_country: "PH",
  contact_number: "",
  urgency: "Normal",
  requested_completion_date: "",
};

const countries = [
  { name: "Philippines", code: "+63", iso: "PH" },
  { name: "Australia", code: "+61", iso: "AU" },
  { name: "Canada", code: "+1", iso: "CA" },
  { name: "China", code: "+86", iso: "CN" },
  { name: "France", code: "+33", iso: "FR" },
  { name: "Germany", code: "+49", iso: "DE" },
  { name: "Hong Kong", code: "+852", iso: "HK" },
  { name: "India", code: "+91", iso: "IN" },
  { name: "Indonesia", code: "+62", iso: "ID" },
  { name: "Japan", code: "+81", iso: "JP" },
  { name: "Malaysia", code: "+60", iso: "MY" },
  { name: "New Zealand", code: "+64", iso: "NZ" },
  { name: "Singapore", code: "+65", iso: "SG" },
  { name: "South Korea", code: "+82", iso: "KR" },
  { name: "Taiwan", code: "+886", iso: "TW" },
  { name: "Thailand", code: "+66", iso: "TH" },
  { name: "United Arab Emirates", code: "+971", iso: "AE" },
  { name: "United Kingdom", code: "+44", iso: "GB" },
  { name: "United States", code: "+1", iso: "US" },
  { name: "Vietnam", code: "+84", iso: "VN" },
];

function getPhoneNumber(number, country) {
  if (!/^\d+$/.test(number) || (country === "PH" && number.length !== 10)) {
    return null;
  }

  const phoneNumber = parsePhoneNumberFromString(number, country);
  return phoneNumber?.isValid() ? phoneNumber : null;
}

export function IroNewEngagementModal({ open, onClose, onCreated }) {
  const [modalStep, setModalStep] = React.useState(1);
  const [form, setForm] = React.useState(initialForm);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [departments, setDepartments] = React.useState([]);
  const [loadingDepartments, setLoadingDepartments] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState({});
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
    setFieldErrors({});
    setModalError("");
    setModalSuccess("");
    loadDepartments();
  }, [open]);

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

  function updateForm(event) {
    const { name, value } = event.target;
    const trimmedValue = value.trim();

    if (name === "contact_number" && !/^\d*$/.test(value)) {
      setModalError("");
      setModalSuccess("");
      setFieldErrors((current) => ({
        ...current,
        contact_number: "Please enter a valid contact number.",
      }));
      return;
    }

    if (
      name === "contact_number"
      && value
      && (form.contact_country === "PH"
        ? value.length > 10
        : validatePhoneNumberLength(value, form.contact_country) === "TOO_LONG")
    ) {
      return;
    }

    setForm((current) => {
      const nextForm = {
        ...current,
        [name]: value,
      };

      return nextForm;
    });

    setModalError("");
    setModalSuccess("");
    setFieldErrors((current) => {
      const isValid = name === "contact_email"
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
        : name === "contact_number"
          ? Boolean(getPhoneNumber(value, form.contact_country))
          : Boolean(trimmedValue);
      const nextErrors = { ...current };
      if (name === "contact_country" && getPhoneNumber(form.contact_number, value)) {
        delete nextErrors.contact_number;
        delete nextErrors._form;
      } else if (name === "contact_country" && form.contact_number) {
        nextErrors.contact_number = "Please enter a valid contact number.";
      }
      if (name === "contact_number" && getPhoneNumber(value, form.contact_country)) {
        delete nextErrors.contact_number;
        delete nextErrors._form;
      }
      if (isValid) delete nextErrors[name];
      if (isValid) delete nextErrors._form;
      return nextErrors;
    });
  }

  function validateStep(currentStep) {
    const errors = {};
    let requiredValues = [];

    if (currentStep === 1) {
      requiredValues = [form.document_type, form.partnership_type, form.partnership_scope];
      if (!form.document_type) {
        errors.document_type = "Please select an agreement type.";
      }
      if (!form.partnership_type) {
        errors.partnership_type = "Please select a partnership type.";
      }
      if (!form.partnership_scope) {
        errors.partnership_scope = "Please select a partnership scope.";
      }
    }

    if (currentStep === 2) {
      requiredValues = [form.title, form.partner_institution, form.description, form.department_id];
      if (!form.title.trim()) {
        errors.title = "Agreement title is required.";
      }
      if (!form.department_id) {
        errors.department_id = "Please select a responsible office.";
      }
      if (!form.partner_institution.trim()) {
        errors.partner_institution = "Partner organization is required.";
      }
      if (!form.description.trim()) {
        errors.description = "Description or purpose is required.";
      }
    }

    if (currentStep === 3) {
      requiredValues = [
        form.contact_person,
        form.contact_position,
        form.contact_email,
        form.contact_number,
      ];
      if (!form.contact_person.trim()) {
        errors.contact_person = "Contact person is required.";
      }
      if (!form.contact_position.trim()) {
        errors.contact_position = "Contact position is required.";
      }
      if (!form.contact_email.trim()) {
        errors.contact_email = "Contact email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
        errors.contact_email = "Please enter a valid contact email.";
      }
      if (!form.contact_number.trim()) {
        errors.contact_number = "Contact number is required.";
      } else if (!getPhoneNumber(form.contact_number, form.contact_country)) {
        errors.contact_number = "Please enter a valid contact number.";
      }
    }

    if (currentStep === 4) {
      requiredValues = [selectedFile, form.requested_completion_date, form.urgency];
      if (!selectedFile) {
        errors.attachment = "Draft MOA/MOU/MOF file is required.";
      }
      if (!form.requested_completion_date) {
        errors.requested_completion_date = "Requested completion date is required.";
      }
      if (!form.urgency) {
        errors.urgency = "Please select an urgency level.";
      }
    }

    const allRequiredFieldsEmpty = requiredValues.length > 0
      && requiredValues.every((value) => !value || (typeof value === "string" && !value.trim()));

    if (allRequiredFieldsEmpty) {
      return { _form: "All required fields must be filled out." };
    }

    return errors;
  }

  function advanceStep() {
    const errors = validateStep(modalStep);

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setModalError("");
    setModalStep((current) => Math.min(current + 1, 4));
  }

  function previousStep() {
    setFieldErrors({});
    setModalError("");
    setModalStep((current) => Math.max(current - 1, 1));
  }

  function navigateToStep(targetStep) {
    if (submitting || targetStep === modalStep) return;

    if (targetStep < modalStep) {
      setFieldErrors({});
      setModalError("");
      setModalStep(targetStep);
      return;
    }

    for (let step = 1; step < targetStep; step += 1) {
      const errors = validateStep(step);
      if (Object.keys(errors).length) {
        setFieldErrors(errors);
        setModalError("");
        setModalStep(step);
        return;
      }
    }

    setFieldErrors({});
    setModalError("");
    setModalStep(targetStep);
  }

  function closeModal() {
    if (submitting) return;
    setModalStep(1);
    setForm(initialForm);
    setSelectedFile(null);
    setFieldErrors({});
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

    const errors = validateStep(4);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
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
        department_id: form.department_id === "pair_iro" ? null : form.department_id,
        partner_email: null,
        description: form.description.trim() || null,
        partnership_type: form.partnership_type,
        partnership_scope: form.partnership_scope,
        contact_person: form.contact_person.trim(),
        contact_position: form.contact_position.trim() || null,
        contact_email: form.contact_email.trim(),
        contact_number: getPhoneNumber(form.contact_number, form.contact_country).number,
        urgency: form.urgency,
        requested_completion_date: form.requested_completion_date || null,
      });

      const document = response.document ?? response.data;
      if (!document?.id) {
        throw new Error("Unable to create the new engagement.");
      }

      await uploadDocumentFile(document.id, selectedFile);
      setModalSuccess("New engagement created and agreement attached successfully.");
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
          {["Classification", "Details", "Contact", "Attachments"].map((label, index) => {
            const step = index + 1;
            return (
              <button
                key={label}
                type="button"
                className={modalStep >= step ? "active" : ""}
                aria-current={modalStep === step ? "step" : undefined}
                onClick={() => navigateToStep(step)}
                disabled={submitting}
              >
                {step}. {label}
              </button>
            );
          })}
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
                {fieldErrors.document_type && <span className="field-error">{fieldErrors.document_type}</span>}
              </label>

              <label>
                Partnership Type
                <select name="partnership_type" value={form.partnership_type} onChange={updateForm}>
                  <option value="New Partnership">New Partnership</option>
                  <option value="Renewal">Renewal</option>
                </select>
                {fieldErrors.partnership_type && <span className="field-error">{fieldErrors.partnership_type}</span>}
              </label>

              <label>
                Partnership Scope
                <select name="partnership_scope" value={form.partnership_scope} onChange={updateForm}>
                  <option value="Departmental">Departmental</option>
                  <option value="Local">Local</option>
                  <option value="International">International</option>
                </select>
                {fieldErrors.partnership_scope && <span className="field-error">{fieldErrors.partnership_scope}</span>}
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
                {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
              </label>

              <label>
                  Responsible Office
                  <select
                    name="department_id"
                    value={form.department_id}
                    onChange={updateForm}
                    disabled={loadingDepartments}
                    required
                  >
                    <option value="">
                      {loadingDepartments
                        ? "Loading departments..."
                        : "Select responsible office"}
                    </option>
                    <option value="pair_iro">PAIR/IRO (no department applies)</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code} - {department.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.department_id && <span className="field-error">{fieldErrors.department_id}</span>}
                </label>

              <label>
                Partner Organization / Institution
                <input
                  name="partner_institution"
                  value={form.partner_institution}
                  onChange={updateForm}
                  placeholder="Partner organization name"
                />
                {fieldErrors.partner_institution && <span className="field-error">{fieldErrors.partner_institution}</span>}
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
                {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
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
                {fieldErrors.contact_person && <span className="field-error">{fieldErrors.contact_person}</span>}
              </label>

              <label>
                Position
                <input
                  name="contact_position"
                  value={form.contact_position}
                  onChange={updateForm}
                  placeholder="Contact position"
                />
                {fieldErrors.contact_position && <span className="field-error">{fieldErrors.contact_position}</span>}
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
                {fieldErrors.contact_email && <span className="field-error">{fieldErrors.contact_email}</span>}
              </label>

              <label>
                Contact Number
                <div className="contact-number-fields">
                  <select
                    name="contact_country"
                    value={form.contact_country}
                    onChange={updateForm}
                    aria-label="Country calling code"
                  >
                    {countries.map((country) => (
                      <option key={country.iso} value={country.iso}>
                        {country.name} ({country.code})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    name="contact_number"
                    value={form.contact_number}
                    onChange={updateForm}
                    placeholder="Contact phone or mobile"
                  />
                </div>
                {fieldErrors.contact_number && <span className="field-error">{fieldErrors.contact_number}</span>}
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
                  onFileSelect={(file) => {
                    setSelectedFile(file);
                    if (file) {
                      setFieldErrors((current) => {
                        const nextErrors = { ...current };
                        delete nextErrors.attachment;
                        delete nextErrors._form;
                        return nextErrors;
                      });
                    }
                  }}
                  onRemove={() => setSelectedFile(null)}
                />
                {fieldErrors.attachment && <span className="field-error">{fieldErrors.attachment}</span>}
              </label>

              <label>
                Requested Completion Date
                <input
                  type="date"
                  name="requested_completion_date"
                  value={form.requested_completion_date}
                  onChange={updateForm}
                />
                {fieldErrors.requested_completion_date && <span className="field-error">{fieldErrors.requested_completion_date}</span>}
              </label>

              <label>
                Urgency
                <select name="urgency" value={form.urgency} onChange={updateForm}>
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Highly Urgent">Highly Urgent</option>
                </select>
                {fieldErrors.urgency && <span className="field-error">{fieldErrors.urgency}</span>}
              </label>
            </div>
          )}

          {modalError && <p className="auth-error">{modalError}</p>}
          {fieldErrors._form && <p className="auth-error">{fieldErrors._form}</p>}
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
              <button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Engagement"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
