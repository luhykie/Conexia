import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2, CalendarClock, ChevronLeft, ChevronRight, FileText,
  Globe2, History, MapPin, Plus, Search, Users, X,
} from "lucide-react";
import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";
import { StatGrid } from "./StatGrid";
import {
  createEngagement,
  getEngagementOptions,
  getEngagements,
} from "../services/engagementService";

const emptyForm = {
  client_submission_id: "",
  agreement_type: "",
  engagement_type: "",
  partner_classification: "",
  partner_name: "",
  partner_email: "",
  partner_contact: "",
  partner_address: "",
  agreement_title: "",
  agreement_summary: "",
  effective_date: "",
  expiry_date: "",
  department_ids: [],
  distribution_recipient_ids: [],
  draft: null,
  attachments: [],
};

export function Engagements() {
  const [searchParams] = useSearchParams();
  const [engagements, setEngagements] = React.useState([]);
  const [options, setOptions] = React.useState({ departments: [], distributionRecipients: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [classification, setClassification] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(
    searchParams.get("new") === "1"
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [items, metadata] = await Promise.all([
        getEngagements(),
        getEngagementOptions(),
      ]);
      setEngagements(Array.isArray(items) ? items : []);
      setOptions(metadata || { departments: [], distributionRecipients: [] });
    } catch (loadError) {
      setError(loadError.message || "Unable to load engagements.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const normalized = engagements.map((item) => ({
    ...item,
    displayStatus: engagementStatus(item),
  }));
  const visible = normalized.filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [
      item.partner_name,
      item.agreement_title,
      item.document?.tracking_number,
      item.document?.document_type,
      ...(item.departments || []).map((department) => department.name),
    ].some((value) => String(value || "").toLowerCase().includes(term));
    return matchesSearch
      && (classification === "all" || item.partner_classification === classification)
      && (status === "all" || item.displayStatus.toLowerCase() === status);
  });

  const stats = [
    [String(normalized.length), "All Engagements", Building2],
    [String(normalized.filter((item) => item.partner_classification === "International").length), "International", Globe2],
    [String(normalized.filter((item) => item.displayStatus === "Expiring").length), "Expiring", CalendarClock, "", "warn"],
    [String(normalized.filter((item) => item.displayStatus === "Expired").length), "Expired", CalendarClock, "", "danger"],
  ];

  async function handleCreated() {
    setModalOpen(false);
    setMessage("Engagement submitted and added to Manage Submissions.");
    await load();
  }

  return (
    <section className="page iro-admin-page engagements-page">
      <PageTitle
        title="Engagements"
        subtitle="Institutional partnerships and their linked agreement workflow."
        action="New Engagement"
        onAction={() => setModalOpen(true)}
      />
      {message && <p className="workflow-message success" role="status">{message}</p>}
      <StatGrid stats={stats} />
      <div className="engagement-toolbar" aria-label="Engagement filters">
        <label className="engagement-search">
          <span className="sr-only">Search engagements</span>
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search partner, agreement, tracking number, or department"
          />
        </label>
        <select aria-label="Partner classification" value={classification} onChange={(event) => setClassification(event.target.value)}>
          <option value="all">All classifications</option>
          <option value="Local">Local</option>
          <option value="International">International</option>
        </select>
        <select aria-label="Engagement status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring</option>
          <option value="expired">Expired</option>
          <option value="renewed">Renewed</option>
        </select>
        <button className="outline" type="button" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <Panel title={`${visible.length} ${visible.length === 1 ? "Engagement" : "Engagements"}`}>
        {loading ? (
          <p className="notification-state">Loading engagements...</p>
        ) : error ? (
          <div className="notification-state error"><p>{error}</p><button className="outline" type="button" onClick={load}>Try Again</button></div>
        ) : visible.length === 0 ? (
          <p className="notification-state">No engagements match the current filters.</p>
        ) : (
          <div className="engagement-grid">
            {visible.map((item) => (
              <button className="engagement-card" type="button" key={item.id} onClick={() => setSelected(item)}>
                <span className="engagement-card-top">
                  <span className="badge">{item.document?.document_type}</span>
                  <span className={`badge ${item.displayStatus.toLowerCase()}`}>{item.displayStatus}</span>
                </span>
                <strong>{item.agreement_title}</strong>
                <span>{item.partner_name}</span>
                <small><MapPin size={14} /> {item.partner_classification}</small>
                <small><Users size={14} /> {(item.departments || []).map((department) => department.name).join(", ")}</small>
                <span className="tracking-number">{item.document?.tracking_number}</span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      {selected && <EngagementDetail engagement={selected} onClose={() => setSelected(null)} />}
      {modalOpen && (
        <NewEngagementModal
          options={options}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </section>
  );
}

function EngagementDetail({ engagement, onClose }) {
  const events = [...(engagement.document?.workflow_events || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="engagement-detail-modal" role="dialog" aria-modal="true" aria-labelledby="engagement-detail-title">
        <header>
          <div><span className="eyebrow">{engagement.document?.tracking_number}</span><h2 id="engagement-detail-title">{engagement.agreement_title}</h2></div>
          <button className="icon-action" type="button" aria-label="Close engagement details" onClick={onClose}><X /></button>
        </header>
        <div className="engagement-detail-grid">
          <section><h3>Partner</h3><p><b>{engagement.partner_name}</b></p><p>{engagement.partner_classification}</p><p>{engagement.partner_email || "No email recorded"}</p><p>{engagement.partner_contact || "No contact number recorded"}</p><p>{engagement.partner_address || "No address recorded"}</p></section>
          <section><h3>Agreement</h3><p>{engagement.engagement_type}</p><p>{engagement.document?.document_type}</p><p>Status: {engagementStatus(engagement)}</p><p>Effective: {formatDate(engagement.effective_date)}</p><p>Expiry: {formatDate(engagement.expiry_date)}</p></section>
          <section><h3>Departments / Offices</h3>{(engagement.departments || []).map((item) => <p key={item.id}>{item.name}</p>)}</section>
          <section><h3>Distribution Recipients</h3>{(engagement.distribution_recipients || []).length ? engagement.distribution_recipients.map((item) => <p key={item.id}>{item.recipient_name} · {item.role_scope}</p>) : <p>No recipients selected.</p>}</section>
        </div>
        <section className="engagement-files"><h3><FileText size={18} /> Related Documents</h3>{(engagement.document?.files || []).map((file) => <p key={file.id}>{file.original_filename} <span>{file.file_category.replaceAll("_", " ")}</span></p>)}</section>
        <section className="engagement-history"><h3><History size={18} /> Agreement History</h3>{events.length ? events.map((event) => <article key={event.id}><b>{event.event_type.replaceAll("_", " ")}</b><p>{event.notes || `${event.from_status || "Created"} → ${event.to_status}`}</p><time>{new Date(event.created_at).toLocaleString()}</time></article>) : <p>No history recorded.</p>}</section>
      </section>
    </div>
  );
}

function NewEngagementModal({ options, onClose, onCreated }) {
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState(() => ({
    ...emptyForm,
    client_submission_id: crypto.randomUUID(),
  }));
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const recipients = (options.distributionRecipients || []).filter(
    (item) => !form.agreement_type || item.document_type === form.agreement_type
  );

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); setError(""); }
  function toggleList(field, id) {
    update(field, form[field].includes(id) ? form[field].filter((item) => item !== id) : [...form[field], id]);
  }
  function next() {
    const message = validateStep(step, form);
    if (message) return setError(message);
    setStep((current) => Math.min(5, current + 1));
  }
  async function submit() {
    const message = validateStep(4, form);
    if (message) return setError(message);
    setSubmitting(true); setError("");
    try { await createEngagement(form); await onCreated(); }
    catch (submitError) { setError(submitError.message || "Unable to submit engagement."); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <section className="engagement-wizard" role="dialog" aria-modal="true" aria-labelledby="new-engagement-title">
        <header><div><span className="eyebrow">Step {step} of 5</span><h2 id="new-engagement-title">New Engagement</h2></div><button className="icon-action" type="button" aria-label="Close" disabled={submitting} onClick={onClose}><X /></button></header>
        <div className="wizard-progress">{[1,2,3,4,5].map((number) => <span className={number <= step ? "active" : ""} key={number}>{number}</span>)}</div>
        <div className="wizard-body">
          {step === 1 && <ChoiceStep form={form} update={update} />}
          {step === 2 && <PartnerStep form={form} update={update} />}
          {step === 3 && <AgreementStep form={form} update={update} departments={options.departments || []} toggleList={toggleList} />}
          {step === 4 && <FilesStep form={form} update={update} recipients={recipients} toggleList={toggleList} />}
          {step === 5 && <ReviewStep form={form} options={options} />}
          {error && <p className="wizard-error" role="alert">{error}</p>}
        </div>
        <footer>
          <button className="outline" type="button" disabled={submitting} onClick={() => step === 1 ? onClose() : setStep(step - 1)}><ChevronLeft size={17} /> {step === 1 ? "Cancel" : "Back"}</button>
          {step < 5 ? <button className="primary" type="button" onClick={next}>Next <ChevronRight size={17} /></button> : <button className="primary" type="button" disabled={submitting} onClick={submit}>{submitting ? "Submitting..." : "Submit Engagement"}</button>}
        </footer>
      </section>
    </div>
  );
}

function ChoiceStep({ form, update }) {
  return <div className="wizard-section"><h3>Classify the engagement</h3><ChoiceGroup label="Agreement type" values={["MOA","MOU","MOF"]} value={form.agreement_type} onChange={(value) => update("agreement_type", value)} /><ChoiceGroup label="Engagement type" values={["New Partnership","Renewal of Existing Partnership"]} value={form.engagement_type} onChange={(value) => update("engagement_type", value)} /><ChoiceGroup label="Partner classification" values={["Local","International"]} value={form.partner_classification} onChange={(value) => update("partner_classification", value)} /></div>;
}
function ChoiceGroup({ label, values, value, onChange }) {
  return <fieldset className="choice-group"><legend>{label}</legend><div>{values.map((item) => <label className={value === item ? "selected" : ""} key={item}><input type="radio" checked={value === item} onChange={() => onChange(item)} />{item}</label>)}</div></fieldset>;
}
function PartnerStep({ form, update }) {
  return <div className="wizard-section"><h3>Partner information</h3><div className="wizard-form-grid"><label>Partner name<input required value={form.partner_name} onChange={(e) => update("partner_name", e.target.value)} /></label><label>Partner email<input type="email" value={form.partner_email} onChange={(e) => update("partner_email", e.target.value)} /></label><label>Contact number<input value={form.partner_contact} onChange={(e) => update("partner_contact", e.target.value)} /></label><label className="full-span">Address<textarea value={form.partner_address} onChange={(e) => update("partner_address", e.target.value)} /></label></div></div>;
}
function AgreementStep({ form, update, departments, toggleList }) {
  return <div className="wizard-section"><h3>Agreement information</h3><div className="wizard-form-grid"><label className="full-span">Agreement title<input required value={form.agreement_title} onChange={(e) => update("agreement_title", e.target.value)} /></label><label>Effective date<input type="date" value={form.effective_date} onChange={(e) => update("effective_date", e.target.value)} /></label><label>Expiry date<input type="date" min={form.effective_date} value={form.expiry_date} onChange={(e) => update("expiry_date", e.target.value)} /></label><label className="full-span">Agreement summary<textarea value={form.agreement_summary} onChange={(e) => update("agreement_summary", e.target.value)} /></label></div><fieldset className="check-grid"><legend>Involved departments or offices</legend>{departments.map((item) => <label key={item.id}><input type="checkbox" checked={form.department_ids.includes(item.id)} onChange={() => toggleList("department_ids", item.id)} />{item.name}</label>)}</fieldset></div>;
}
function FilesStep({ form, update, recipients, toggleList }) {
  return <div className="wizard-section"><h3>Documents and distribution</h3><div className="wizard-form-grid"><label className="full-span">Draft agreement<input required type="file" accept=".pdf,.doc,.docx,.odt" onChange={(e) => update("draft", e.target.files?.[0] || null)} /></label><label className="full-span">Supporting attachments<input type="file" multiple accept=".pdf,.doc,.docx,.odt,.xls,.xlsx" onChange={(e) => update("attachments", Array.from(e.target.files || []))} /></label></div><fieldset className="check-grid"><legend>Distribution recipients</legend>{recipients.length ? recipients.map((item) => <label key={item.id}><input type="checkbox" checked={form.distribution_recipient_ids.includes(item.id)} onChange={() => toggleList("distribution_recipient_ids", item.id)} /><span>{item.recipient_name}<small>{item.organization || item.recipient_email} · {item.role_scope}</small></span></label>) : <p>No active recipients are configured for {form.agreement_type || "this agreement type"}.</p>}</fieldset></div>;
}
function ReviewStep({ form, options }) {
  const departmentNames = options.departments.filter((item) => form.department_ids.includes(item.id)).map((item) => item.name);
  const recipientNames = options.distributionRecipients.filter((item) => form.distribution_recipient_ids.includes(item.id)).map((item) => item.recipient_name);
  return <div className="wizard-section"><h3>Review and submit</h3><div className="review-summary"><section><span>Agreement</span><b>{form.agreement_type} · {form.engagement_type}</b><p>{form.agreement_title}</p></section><section><span>Partner</span><b>{form.partner_name}</b><p>{form.partner_classification} · {form.partner_email || "No email"}</p></section><section><span>Departments</span><b>{departmentNames.join(", ")}</b></section><section><span>Files</span><b>{form.draft?.name}</b><p>{form.attachments.length} supporting attachment(s)</p></section><section><span>Distribution</span><b>{recipientNames.length ? recipientNames.join(", ") : "No recipients selected"}</b></section></div><p className="review-notice">Submitting creates the linked document record and sends it to Manage Submissions under the official CONEXIA review workflow.</p></div>;
}

function validateStep(step, form) {
  if (step === 1 && (!form.agreement_type || !form.engagement_type || !form.partner_classification)) return "Select all three engagement classifications.";
  if (step === 2 && !form.partner_name.trim()) return "Partner name is required.";
  if (step === 3 && (!form.agreement_title.trim() || form.department_ids.length === 0)) return "Enter an agreement title and select at least one department or office.";
  if (step === 4 && !form.draft) return "Attach the draft agreement before continuing.";
  return "";
}
function engagementStatus(item) {
  if (item.lifecycle_status === "Renewed") return "Renewed";
  if (!item.expiry_date) return "Active";
  const days = Math.ceil((new Date(item.expiry_date) - new Date()) / 86400000);
  if (days < 0) return "Expired";
  if (days <= 90) return "Expiring";
  return "Active";
}
function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "Not specified";
}

export default Engagements;
