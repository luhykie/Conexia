import React from "react";
import { ArrowLeft, ArrowRight, FilePlus2, X } from "lucide-react";
import { apiGet } from "../api/apiClient";
import "./PreSubmissionModal.css";

const initialAnswers = {
  agreementType: "MOA",
  submissionType: "new",
  partnerClassification: "local",
  partnerDepartmentId: "",
  partnerInstitution: "",
  requestingOffice: "",
  contactPerson: "",
  position: "",
  emailAddress: "",
  contactNumber: "",
  requestedCompletionDate: "",
  agreementTitle: "",
  urgencyLevel: "normal",
};

export function PreSubmissionModal({ open, onClose, onConfirm, account, loading = false }) {
  const [step, setStep] = React.useState(1);
  const [answers, setAnswers] = React.useState(initialAnswers);
  const [error, setError] = React.useState("");
  const [departments, setDepartments] = React.useState([]);

  React.useEffect(() => {
    if (!open) return;
    setAnswers((current) => ({
      ...current,
      requestingOffice: current.requestingOffice || account?.department || account?.departmentCode || account?.office || "",
      emailAddress: current.emailAddress || account?.email || "",
    }));
  }, [open, account]);

  function update(name, value) {
    setAnswers((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function chooseDepartment(value) {
    const department = departments.find((item) => item.id === value);
    setAnswers((current) => ({
      ...current,
      partnerDepartmentId: value,
      partnerInstitution: department?.name || "",
    }));
    setError("");
  }

  function next() {
    if (step === 2 && !answers.partnerInstitution.trim()) {
      setError(answers.partnerClassification === "Departmental" ? "Please select a partner department." : "Please enter the partner institution name.");
      return;
    }
    if (step === 3 && (!answers.requestingOffice.trim() || !answers.contactPerson.trim() || !answers.position.trim() || !answers.emailAddress.trim() || !answers.contactNumber.trim())) {
      setError("Please complete all Requesting Office Information fields.");
      return;
    }
    if (step === 3 && !isValidEmail(answers.emailAddress)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (step === 3 && !isValidPhoneNumber(answers.contactNumber)) {
      setError("Please enter a valid contact number with 7 to 15 digits.");
      return;
    }
    if (step === 4 && (!answers.requestedCompletionDate || !answers.agreementTitle.trim())) {
      setError("Please provide the agreement title and requested completion date.");
      return;
    }
    if (step === 4) {
      onConfirm(answers);
      return;
    }
    setStep((current) => current + 1);
  }

  function close() {
    if (!loading) {
      setStep(1);
      setError("");
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="pre-submission-overlay" role="presentation">
      <div className="pre-submission-modal" role="dialog" aria-modal="true" aria-labelledby="pre-submission-title">
        <div className="pre-submission-header">
          <div className="pre-submission-hero">
            <span className="pre-submission-icon"><FilePlus2 size={22} /></span>
            <p className="pre-submission-step">Step {step} of 4 · Pre-submission</p>
            <h2 id="pre-submission-title">Start a New Agreement Submission</h2>
            <p className="pre-submission-intro">Complete the required agreement information before uploading your document for review.</p>
          </div>
          <button type="button" className="close-button" onClick={close} aria-label="Close" disabled={loading}><X size={20} /></button>
        </div>

        <div className="pre-submission-content">
          {step === 1 && <>
            <fieldset className="pre-submission-field"><legend>What type of agreement are you initiating?</legend><OptionGroup name="agreementType" value={answers.agreementType} onChange={update} options={[["MOA", "MOA", "Memorandum of Agreement"], ["MOU", "MOU", "Memorandum of Understanding"], ["MOF", "MOF", "Memorandum of Friendship"]]} disabled={loading} /></fieldset>
            <fieldset className="pre-submission-field"><legend>Is this a new partnership or a renewal of an existing one?</legend><OptionGroup name="submissionType" value={answers.submissionType} onChange={update} options={[["new", "New Partnership"], ["renewal", "Renewal"]]} disabled={loading} /></fieldset>
            <fieldset className="pre-submission-field"><legend>Is the partner institution local, international, or Departmental?</legend><OptionGroup name="partnerClassification" value={answers.partnerClassification} onChange={update} options={[["local", "Local"], ["international", "International"], ["Departmental", "Departmental"]]} disabled={loading} /></fieldset>
          </>}

          {step === 2 && <fieldset className="pre-submission-field"><legend>Partner / engagement information</legend>
            {answers.partnerClassification === "Departmental" ? <label className="pre-submission-input">Which department are you collaborating with?<select value={answers.partnerDepartmentId} onChange={(event) => chooseDepartment(event.target.value)} disabled={loading}><option value="">Select partner department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code ? `${department.code} — ` : ""}{department.name}</option>)}</select></label> : <label className="pre-submission-input">Partner Institution / Organization Name<input value={answers.partnerInstitution} onChange={(event) => update("partnerInstitution", event.target.value)} disabled={loading} placeholder="e.g. Global Tech University" /></label>}
          </fieldset>}

          {step === 3 && <fieldset className="pre-submission-field"><legend>Requesting Office Information</legend>
            <div className="pre-submission-grid">
              <label className="pre-submission-input">Office / Department<input value={answers.requestingOffice} onChange={(event) => update("requestingOffice", event.target.value)} disabled={loading} /></label>
              <label className="pre-submission-input">Contact Person<input value={answers.contactPerson} onChange={(event) => update("contactPerson", event.target.value)} disabled={loading} /></label>
              <label className="pre-submission-input">Position<input value={answers.position} onChange={(event) => update("position", event.target.value)} disabled={loading} /></label>
              <label className="pre-submission-input">Email Address<input type="email" value={answers.emailAddress} onChange={(event) => update("emailAddress", event.target.value)} disabled={loading} /></label>
            </div>
            <label className="pre-submission-input">Contact Number<input type="tel" inputMode="numeric" pattern="[0-9]{7,15}" maxLength="15" title="Use a valid contact number with 7 to 15 digits." value={answers.contactNumber} onChange={(event) => update("contactNumber", numbersOnly(event.target.value))} disabled={loading} /></label>
          </fieldset>}

          {step === 4 && <fieldset className="pre-submission-field"><legend>Agreement Details</legend>
            <div className="pre-submission-grid">
              <label className="pre-submission-input">Title of Agreement<input value={answers.agreementTitle} onChange={(event) => update("agreementTitle", event.target.value)} disabled={loading} placeholder="Enter agreement title" /></label>
              <label className="pre-submission-input">Requested Date of Completion<input type="date" value={answers.requestedCompletionDate} onChange={(event) => update("requestedCompletionDate", event.target.value)} disabled={loading} /></label>
            </div>
            <fieldset className="pre-submission-field pre-submission-field--nested"><legend>Urgency Level</legend><OptionGroup name="urgencyLevel" value={answers.urgencyLevel} onChange={update} options={[["normal", "Normal"], ["urgent", "Urgent"], ["highly_urgent", "Highly Urgent"]]} disabled={loading} /></fieldset>
          </fieldset>}
          {error && <div className="auth-error">{error}</div>}
        </div>

        <div className="pre-submission-footer">
          <button type="button" className="outline" onClick={step === 1 ? close : () => setStep((current) => current - 1)} disabled={loading}>{step === 1 ? "Cancel" : <><ArrowLeft size={16} /> Back</>}</button>
          <button type="button" className="primary" onClick={next} disabled={loading}>{loading ? "Loading..." : step === 4 ? "Continue to Upload" : "Next"}<ArrowRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function OptionGroup({ name, value, onChange, options, disabled }) {
  return <div className={`radio-group radio-group--${options.length}`}>{options.map(([optionValue, label, detail]) => <label className={value === optionValue ? "selected" : ""} key={optionValue}><input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={(event) => onChange(name, event.target.value)} disabled={disabled} /><span><b>{label}</b>{detail && <small>{detail}</small>}</span></label>)}</div>;
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
