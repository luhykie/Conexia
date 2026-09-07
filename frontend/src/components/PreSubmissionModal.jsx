import React from "react";
import { ArrowLeft, ArrowRight, FilePlus2, X } from "lucide-react";
import { DepartmentSelect } from "./DepartmentSelect";
import "./PreSubmissionModal.css";

const initialAnswers = { agreementType: "MOA", submissionType: "new", partnerClassification: "local", departmentToDepartment: false, partnerDepartmentId: "", partnerInstitution: "", requestingOffice: "", contactPerson: "", position: "", emailAddress: "", contactNumber: "", urgencyLevel: "standard" };

export function PreSubmissionModal({ open, onClose, onConfirm, account, loading = false }) {
  const [step, setStep] = React.useState(1);
  const [answers, setAnswers] = React.useState(initialAnswers);
  const [error, setError] = React.useState("");
  React.useEffect(() => { if (open) setAnswers((current) => ({ ...current, requestingOffice: current.requestingOffice || account?.department || account?.departmentCode || account?.office || "", emailAddress: current.emailAddress || account?.email || "" })); }, [open, account]);
  function update(name, value) { setAnswers((current) => { const next = { ...current, [name]: value }; if (name === "partnerClassification" && value !== "local") { next.departmentToDepartment = false; next.partnerDepartmentId = ""; } if (name === "departmentToDepartment" && !value) next.partnerDepartmentId = ""; return next; }); setError(""); }
  function next() {
    if (step === 2 && answers.departmentToDepartment && !answers.partnerDepartmentId) { setError(answers.partnerInstitution.trim() ? "Please select a valid registered department." : "Please select a partner department."); return; }
    if (step === 2 && !answers.departmentToDepartment && !answers.partnerInstitution.trim()) { setError("Please enter the partner institution name."); return; }
    if (step === 3 && (!answers.requestingOffice.trim() || !answers.contactPerson.trim() || !answers.position.trim() || !answers.emailAddress.trim() || !answers.contactNumber.trim())) { setError("Please complete all Requesting Office Information fields."); return; }
    if (step === 3 && !isValidEmail(answers.emailAddress)) { setError("Please enter a valid email address."); return; }
    if (step === 3 && !isValidPhoneNumber(answers.contactNumber)) { setError("Please enter a valid contact number with 7 to 15 digits."); return; }
    if (step === 4) return onConfirm(answers);
    setStep((current) => current + 1);
  }
  function close() { if (!loading) { setStep(1); setError(""); onClose(); } }
  if (!open) return null;
  return <div className="pre-submission-overlay" role="presentation"><div className="pre-submission-modal" role="dialog" aria-modal="true" aria-labelledby="pre-submission-title">
    <div className="pre-submission-header"><div className="pre-submission-hero"><span className="pre-submission-icon"><FilePlus2 size={22} /></span><p className="pre-submission-step">Step {step} of 4 - Pre-submission</p><h2 id="pre-submission-title">Start a New Agreement Submission</h2><p className="pre-submission-intro">Complete the required agreement information before uploading your document for review.</p></div><button type="button" className="close-button" onClick={close} aria-label="Close" disabled={loading}><X size={20} /></button></div>
    <div className="pre-submission-content">
      {step === 1 && <><Field legend="What type of agreement are you initiating?"><OptionGroup name="agreementType" value={answers.agreementType} onChange={update} options={[["MOA", "MOA", "Memorandum of Agreement"], ["MOU", "MOU", "Memorandum of Understanding"]]} disabled={loading} /></Field><Field legend="Is this a new partnership or a renewal of an existing one?"><OptionGroup name="submissionType" value={answers.submissionType} onChange={update} options={[["new", "New Partnership"], ["renewal", "Renewal"]]} disabled={loading} /></Field><Field legend="Is the partner institution local or international?"><OptionGroup name="partnerClassification" value={answers.partnerClassification} onChange={update} options={[["local", "Local"], ["international", "International"]]} disabled={loading} /></Field></>}
      {step === 2 && <Field legend="Partner / engagement information">{answers.partnerClassification === "local" && <button type="button" className={`department-trigger ${answers.departmentToDepartment ? "is-active" : ""}`} role="switch" aria-checked={answers.departmentToDepartment} onClick={() => update("departmentToDepartment", !answers.departmentToDepartment)} disabled={loading}><span><b>Department-to-Department</b><small>{answers.departmentToDepartment ? "Partner department required" : "Normal Local submission"}</small></span><strong>{answers.departmentToDepartment ? "On" : "Off"}</strong></button>}{answers.departmentToDepartment ? <label className="pre-submission-input">Partner Department<DepartmentSelect value={answers.partnerDepartmentId} ownDepartmentId={account?.departmentId || account?.department_id} disabled={loading} onChange={(event) => { const departmentId = event.target.value; const department = event.target.selectedOptions[0]; update("partnerDepartmentId", departmentId); update("partnerInstitution", departmentId ? department.textContent : ""); }} /></label> : <label className="pre-submission-input">Partner Institution / Organization Name<input value={answers.partnerInstitution} onChange={(event) => update("partnerInstitution", event.target.value)} disabled={loading} placeholder="e.g. Global Tech University" /></label>}</Field>}
      {step === 3 && <Field legend="Requesting Office Information"><div className="pre-submission-grid"><Label text="Office / Department" value={answers.requestingOffice} onChange={(value) => update("requestingOffice", value)} disabled={loading} /><Label text="Contact Person" value={answers.contactPerson} onChange={(value) => update("contactPerson", value)} disabled={loading} /><Label text="Position" value={answers.position} onChange={(value) => update("position", value)} disabled={loading} /><Label text="Email Address" type="email" value={answers.emailAddress} onChange={(value) => update("emailAddress", value)} disabled={loading} /></div><Label text="Contact Number" value={answers.contactNumber} onChange={(value) => update("contactNumber", numbersOnly(value))} disabled={loading} /></Field>}
      {step === 4 && <Field legend="Agreement Details"><Field legend="Urgency Level"><OptionGroup name="urgencyLevel" value={answers.urgencyLevel} onChange={update} options={[["standard", "Standard"], ["urgent", "Urgent"]]} disabled={loading} /></Field></Field>}
      {error && <div className="auth-error">{error}</div>}
    </div><div className="pre-submission-footer"><button type="button" className="outline" onClick={step === 1 ? close : () => setStep((current) => current - 1)} disabled={loading}>{step === 1 ? "Cancel" : <><ArrowLeft size={16} /> Back</>}</button><button type="button" className="primary" onClick={next} disabled={loading}>{loading ? "Loading..." : step === 4 ? "Continue to Upload" : "Next"}<ArrowRight size={16} /></button></div>
  </div></div>;
}
function Field({ legend, children }) { return <fieldset className="pre-submission-field"><legend>{legend}</legend>{children}</fieldset>; }
function Label({ text, type = "text", value, onChange, disabled }) { return <label className="pre-submission-input">{text}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /></label>; }
function OptionGroup({ name, value, onChange, options, disabled }) { return <div className={`radio-group radio-group--${options.length}`}>{options.map(([optionValue, label, detail]) => <label className={value === optionValue ? "selected" : ""} key={optionValue}><input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={(event) => onChange(name, event.target.value)} disabled={disabled} /><span><b>{label}</b>{detail && <small>{detail}</small>}</span></label>)}</div>; }
function isValidEmail(value) { return /^\S+@\S+\.\S+$/.test(value.trim()); }
function isValidPhoneNumber(value) { return /^\d{7,15}$/.test(value); }
function numbersOnly(value) { return value.replace(/\D/g, "").slice(0, 15); }
