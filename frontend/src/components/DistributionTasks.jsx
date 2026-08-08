import React from "react";
import { CheckCircle2, RefreshCw, Send } from "lucide-react";
import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";
import { completeDocumentDistribution, getDocumentDistributions, markDistributionDelivered, prepareDocumentDistribution } from "../services/documentService";

export default function DistributionTasks() {
  const [documents, setDocuments] = React.useState([]);
  const [notes, setNotes] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    setLoading(true); setError("");
    try { setDocuments(await getDocumentDistributions()); }
    catch (loadError) { setError(loadError.message || "Unable to load distribution assignments."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);
  async function run(key, action, success) {
    setBusy(key); setMessage(""); setError("");
    try { await action(); setMessage(success); await load(); }
    catch (actionError) { setError(actionError.message || "Unable to update distribution."); }
    finally { setBusy(""); }
  }
  return <section className="page iro-staff-page">
    <PageTitle title="Distribution Tasks" subtitle="Distribute approved documents assigned by IRO Admin." action="Refresh" onAction={load} actionIcon={RefreshCw} actionDisabled={loading} />
    {message && <p className="workflow-message success" role="status">{message}</p>}
    {error && <p className="workflow-message error" role="alert">{error}</p>}
    <Panel title="Assigned Approved Documents">
      {loading ? <p className="notification-state">Loading distribution assignments...</p> : documents.length === 0 ? <p className="notification-state">No approved documents are assigned for distribution.</p> : <div className="distribution-document-list">
        {documents.map((document) => {
          const recipients = document.distributions || [];
          const required = recipients.filter((item) => item.is_required !== false);
          const delivered = required.filter((item) => item.delivery_status === "Delivered").length;
          return <article className="distribution-document-card" key={document.id}>
            <div className="distribution-document-heading"><div><strong>{document.tracking_number}</strong><p>{document.document_type} · {document.partner_institution}</p><p className="distribution-department"><b>Originating Department:</b> {document.department?.name || document.department_name || "Department unavailable"}</p></div><span className="badge">{document.status}</span></div>
            {document.admin_distribution_instructions && <p><b>Admin instructions:</b> {document.admin_distribution_instructions}</p>}
            {["Assigned for Distribution", "Notarized"].includes(document.status) ? <button className="primary" type="button" disabled={Boolean(busy)} onClick={() => run(document.id, () => prepareDocumentDistribution(document.id), "Distribution recipients prepared.")}><Send size={17} /> Prepare Distribution</button> : <>
              <p>{delivered} of {required.length} required deliveries recorded</p>
              <div className="submission-table-wrap"><table className="submission-table"><thead><tr><th>Recipient</th><th>Role</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead><tbody>{recipients.map((item) => <tr key={item.id}><td>{item.recipient_name}<small>{item.recipient_email}</small></td><td>{item.role_scope}</td><td><span className="badge">{item.delivery_status}</span></td><td>{item.delivery_status === "Delivered" ? item.delivery_notes || "—" : <input aria-label={`Delivery notes for ${item.recipient_name}`} value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} />}</td><td>{item.delivery_status === "Delivered" ? new Date(item.distributed_at).toLocaleString() : <button className="outline" type="button" disabled={Boolean(busy)} onClick={() => run(item.id, () => markDistributionDelivered(document.id, item.id, notes[item.id]), `Delivery to ${item.recipient_name} recorded.`)}>Mark Delivered</button>}</td></tr>)}</tbody></table></div>
              {document.status === "Ready for Distribution" && <button className="primary distribution-complete-button" type="button" disabled={!required.length || delivered !== required.length || Boolean(busy)} onClick={() => run(document.id, () => completeDocumentDistribution(document.id), "Distribution completed and returned to IRO Admin for archival.")}><CheckCircle2 size={17} /> Complete Distribution</button>}
            </>}
          </article>;
        })}
      </div>}
    </Panel>
  </section>;
}
