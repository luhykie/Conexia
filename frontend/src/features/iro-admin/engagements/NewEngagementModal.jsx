import React from "react";
import { ArrowLeft, ArrowRight, FilePlus2, X } from "lucide-react";
import { getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString, validatePhoneNumberLength } from "libphonenumber-js/max";
import { Dropzone } from "../../../components/SharedViews";
import "../../../components/PreSubmissionModal.css";
import { getCountryDirectory } from "../../../services/countryService";
import { getDepartments } from "../../../services/departmentService";
import { uploadDocumentFile } from "../../../services/documentFileService";
import { createIroDocument } from "../../../services/iroAdminService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

const initialForm = { document_type: "MOA", partnership_type: "New Partnership", partnership_scope: "Local", partner_institution: "", partner_email: "", department_id: "", contact_person: "", contact_position: "", contact_email: "", contact_country: "PH", contact_number: "", urgency: "Normal" };
const philippinesFallback = { name: "Philippines", code: "+63", iso: "PH" };
const stepLabels = ["Classification", "Institution Details", "Contact Information", "Attachments"];

function getPhoneNumber(number, country) {
  if (!/^\d+$/.test(number) || (country === "PH" && number.length !== 10)) return null;
  const phoneNumber = parsePhoneNumberFromString(number, country);
  return phoneNumber?.isValid() ? phoneNumber : null;
}

export function IroNewEngagementModal({ open, onClose, onCreated }) {
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState(initialForm);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [departments, setDepartments] = React.useState([]);
  const [countries, setCountries] = React.useState([philippinesFallback]);
  const [countriesLoading, setCountriesLoading] = React.useState(true);
  const [countriesError, setCountriesError] = React.useState("");
  const [loadingDepartments, setLoadingDepartments] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState({});
  const [modalError, setModalError] = React.useState("");
  const mountedRef = React.useRef(true);

  React.useEffect(() => () => { mountedRef.current = false; }, []);
  React.useEffect(() => { loadCountries(); }, []);
  React.useEffect(() => {
    if (!open) return;
    setStep(1); setForm(initialForm); setSelectedFile(null); setSubmitting(false); setFieldErrors({}); setModalError("");
    loadDepartments();
  }, [open]);

  async function loadCountries() {
    setCountriesLoading(true); setCountriesError("");
    try {
      const directory = await getCountryDirectory();
      const options = directory.filter((country) => isSupportedCountry(country.iso)).map((country) => ({ ...country, name: country.iso === "PH" ? philippinesFallback.name : country.name, code: `+${getCountryCallingCode(country.iso)}` })).sort((a, b) => a.name.localeCompare(b.name, "en"));
      if (!options.some((country) => country.iso === "PH")) options.push(philippinesFallback);
      if (!options.length) throw new Error("No supported countries were returned.");
      if (mountedRef.current) setCountries(options);
    } catch (error) {
      reportClientError("Unable to load country directory:", error);
      if (mountedRef.current) { setCountries([philippinesFallback]); setCountriesError("Country list unavailable. Philippines (+63) remains available."); }
    } finally { if (mountedRef.current) setCountriesLoading(false); }
  }

  async function loadDepartments() {
    setLoadingDepartments(true);
    try {
      const response = await getDepartments({ per_page: 100 });
      setDepartments(response.data ?? response.departments ?? []);
    } catch (error) {
      reportClientError("Unable to load departments:", error); setDepartments([]);
    } finally { setLoadingDepartments(false); }
  }

  function update(name, value) {
    if (name === "contact_number" && !/^\d*$/.test(value)) return;
    if (name === "contact_number" && value && (form.contact_country === "PH" ? value.length > 10 : validatePhoneNumberLength(value, form.contact_country) === "TOO_LONG")) return;
    const nextForm = { ...form, [name]: value };
    setForm(nextForm);
    setFieldErrors((current) => {
      const next = { ...current };
      if (isValidField(name, value, nextForm)) delete next[name];
      if (name === "contact_country" && isValidField(name, value, nextForm)) delete next.contact_number;
      return next;
    });
    if (requiredValues(step, nextForm, selectedFile).some(hasValue)) setModalError("");
  }

  function validate(currentStep) {
    const errors = {};
    if (currentStep === 2) {
      if (!form.partner_institution.trim()) errors.partner_institution = "Name of Institution is required.";
      if (!form.partner_email.trim()) errors.partner_email = "Partner Contact Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.partner_email.trim())) errors.partner_email = "Please enter a valid partner contact email.";
      if (!form.department_id) errors.department_id = "Please select a responsible office.";
    }
    if (currentStep === 3) {
      if (!form.contact_person.trim()) errors.contact_person = "Contact Person is required.";
      if (!form.contact_position.trim()) errors.contact_position = "Position is required.";
      if (!form.contact_email.trim()) errors.contact_email = "Email Address is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) errors.contact_email = "Please enter a valid email address.";
      if (!form.contact_number.trim()) errors.contact_number = "Contact Number is required.";
      else if (!getPhoneNumber(form.contact_number, form.contact_country)) errors.contact_number = "Please enter a valid contact number.";
    }
    if (currentStep === 4) {
      if (!selectedFile) errors.attachment = "Please upload the draft document.";
      else if (!isSupportedDraft(selectedFile)) errors.attachment = "Upload a PDF, DOCX, or ODT document up to 25 MB.";
    }
    return {
      errors,
      allBlank: requiredValues(currentStep, form, selectedFile).every((value) => !hasValue(value)),
    };
  }

  function next() {
    const { errors, allBlank } = validate(step);
    if (Object.keys(errors).length) {
      setFieldErrors(allBlank ? {} : errors);
      setModalError(allBlank ? "Please complete all required fields." : "");
      return;
    }
    setFieldErrors({}); setModalError(""); setStep((current) => Math.min(current + 1, 4));
  }

  function close() {
    if (submitting) return;
    setStep(1); setFieldErrors({}); setModalError(""); onClose?.();
  }

  function selectDraft(file) {
    setSelectedFile(file);
    setModalError("");
    setFieldErrors((current) => ({
      ...current,
      ...(isSupportedDraft(file)
        ? { attachment: undefined }
        : { attachment: "Upload a PDF, DOCX, or ODT document up to 25 MB." }),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const { errors, allBlank } = validate(4);
    if (Object.keys(errors).length) {
      setFieldErrors(allBlank ? {} : errors);
      setModalError(allBlank ? "Please complete all required fields." : "");
      return;
    }
    setSubmitting(true); setModalError("");
    try {
      const institutionName = form.partner_institution.trim();
      const response = await createIroDocument({ title: institutionName, document_type: form.document_type, partner_institution: institutionName, department_id: form.department_id, partner_email: form.partner_email.trim(), description: null, partnership_type: form.partnership_type, partnership_scope: form.partnership_scope, contact_person: form.contact_person.trim(), contact_position: form.contact_position.trim(), contact_email: form.contact_email.trim(), contact_number: getPhoneNumber(form.contact_number, form.contact_country).number, urgency: form.urgency });
      const document = response.document ?? response.data;
      if (!document?.id) throw new Error("Unable to create the new engagement.");
      await uploadDocumentFile(document.id, selectedFile); onClose?.(); await onCreated?.();
    } catch (error) {
      reportClientError("Unable to create engagement:", error); setModalError(error.message || "Unable to create the engagement.");
    } finally { if (mountedRef.current) setSubmitting(false); }
  }

  if (!open) return null;
  return <div className="pre-submission-overlay" role="presentation"><form className="pre-submission-modal" role="dialog" aria-modal="true" aria-labelledby="iro-engagement-title" onSubmit={submit}>
    <div className="pre-submission-header"><div className="pre-submission-hero"><span className="pre-submission-icon"><FilePlus2 size={22} /></span><p className="pre-submission-step">Step {step} of 4 · {stepLabels[step - 1]}</p><h2 id="iro-engagement-title">New Engagement</h2><p className="pre-submission-intro">Complete the required agreement information and upload the draft document.</p></div><button type="button" className="close-button" onClick={close} aria-label="Close" disabled={submitting}><X size={20} /></button></div>
    <div className="pre-submission-content">
      {step === 1 && <><ChoiceField legend="What type of agreement are you initiating?" name="document_type" value={form.document_type} onChange={update} options={[["MOA", "MOA", "Memorandum of Agreement"], ["MOU", "MOU", "Memorandum of Understanding"]]} disabled={submitting} /><ChoiceField legend="Is this a new partnership or a renewal of an existing one?" name="partnership_type" value={form.partnership_type} onChange={update} options={[["New Partnership", "New Partnership"], ["Renewal", "Renewal"]]} disabled={submitting} /><ChoiceField legend="Is the partner institution local or international?" name="partnership_scope" value={form.partnership_scope} onChange={update} options={[["Local", "Local"], ["International", "International"]]} disabled={submitting} /></>}
      {step === 2 && <fieldset className="pre-submission-field"><legend>Institution Details</legend><div className="pre-submission-grid"><Input label="Name of Institution" error={fieldErrors.partner_institution} wide><input value={form.partner_institution} onChange={(event) => update("partner_institution", event.target.value)} disabled={submitting} placeholder="e.g. Global Tech University" /></Input><Input label="Partner Contact Email" error={fieldErrors.partner_email} wide><input type="email" value={form.partner_email} onChange={(event) => update("partner_email", event.target.value)} disabled={submitting} placeholder="contact@partner.edu" /></Input><Input label="Responsible Office" error={fieldErrors.department_id}><select value={form.department_id} onChange={(event) => update("department_id", event.target.value)} disabled={submitting || loadingDepartments}><option value="">{loadingDepartments ? "Loading departments..." : "Select responsible office"}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code ? `${department.code} — ` : ""}{department.name}</option>)}</select></Input></div></fieldset>}
      {step === 3 && <fieldset className="pre-submission-field"><legend>Contact Information</legend><div className="pre-submission-grid"><Input label="Contact Person" error={fieldErrors.contact_person}><input value={form.contact_person} onChange={(event) => update("contact_person", event.target.value)} disabled={submitting} /></Input><Input label="Position" error={fieldErrors.contact_position}><input value={form.contact_position} onChange={(event) => update("contact_position", event.target.value)} disabled={submitting} /></Input><Input label="Email Address" error={fieldErrors.contact_email}><input type="email" value={form.contact_email} onChange={(event) => update("contact_email", event.target.value)} disabled={submitting} /></Input><Input label="Contact Number" error={fieldErrors.contact_number}><div className="iro-contact-number"><select value={form.contact_country} onChange={(event) => update("contact_country", event.target.value)} aria-label="Country calling code" disabled={submitting || countriesLoading}>{countries.map((country) => <option key={country.iso} value={country.iso}>{country.name} ({country.code})</option>)}</select><input type="text" inputMode="numeric" pattern="[0-9]*" value={form.contact_number} onChange={(event) => update("contact_number", event.target.value)} disabled={submitting} /></div>{countriesError && <small className="country-list-error">{countriesError}<button type="button" className="outline" onClick={loadCountries}>Retry</button></small>}</Input></div></fieldset>}
      {step === 4 && <fieldset className="pre-submission-field"><legend>Attachments</legend><Input label="Upload the draft document" error={fieldErrors.attachment}><Dropzone selectedFile={selectedFile} detail={selectedFile ? formatFileSize(selectedFile.size) : "PDF, DOCX, ODT · required"} onFileSelect={selectDraft} onRemove={() => setSelectedFile(null)} /></Input><ChoiceField legend="Urgency level" name="urgency" value={form.urgency} onChange={update} options={[["Normal", "Normal"], ["Urgent", "Urgent"]]} disabled={submitting} nested /></fieldset>}
      {modalError && <div className="auth-error" role="alert">{modalError}</div>}
    </div>
    <div className="pre-submission-footer"><button type="button" className="outline" onClick={step === 1 ? close : () => { setStep((current) => current - 1); setFieldErrors({}); setModalError(""); }} disabled={submitting}>{step === 1 ? "Cancel" : <><ArrowLeft size={16} /> Back</>}</button>{step < 4 ? <button type="button" className="primary" onClick={next} disabled={submitting}>Next <ArrowRight size={16} /></button> : <button type="submit" className="primary" disabled={submitting}>{submitting ? "Creating..." : "Create Engagement"}<ArrowRight size={16} /></button>}</div>
  </form></div>;
}

function ChoiceField({ legend, name, value, onChange, options, disabled, nested = false }) { return <fieldset className={`pre-submission-field${nested ? " pre-submission-field--nested" : ""}`}><legend>{legend}</legend><div className={`radio-group radio-group--${options.length}`}>{options.map(([optionValue, label, detail]) => <label className={value === optionValue ? "selected" : ""} key={optionValue}><input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={(event) => onChange(name, event.target.value)} disabled={disabled} /><span><b>{label}</b>{detail && <small>{detail}</small>}</span></label>)}</div></fieldset>; }
function Input({ label, error, wide = false, children }) { return <label className={`pre-submission-input${wide ? " iro-engagement-field--wide" : ""}`}>{label}{children}{error && <span className="field-error">{error}</span>}</label>; }
function formatFileSize(bytes) { if (!Number.isFinite(bytes)) return "-"; return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`; }

function requiredValues(step, form, selectedFile) {
  if (step === 1) return [form.document_type, form.partnership_type, form.partnership_scope];
  if (step === 2) return [form.partner_institution, form.partner_email, form.department_id];
  if (step === 3) return [form.contact_person, form.contact_position, form.contact_email, form.contact_number];
  return [selectedFile, form.urgency];
}

function hasValue(value) { return (typeof value === "object" && value !== null) || (typeof value === "string" && value.trim() !== ""); }
function isValidField(name, value, form) {
  if (name === "contact_email" || name === "partner_email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  if (name === "contact_number") return Boolean(getPhoneNumber(value, form.contact_country));
  if (name === "contact_country") return Boolean(getPhoneNumber(form.contact_number, value));
  return typeof value === "string" && value.trim() !== "";
}
function isSupportedDraft(file) {
  return Boolean(file && file.size <= 25 * 1024 * 1024 && /\.(pdf|docx|odt)$/i.test(file.name));
}
