import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  FileCheck2,
  Folder,
  Gauge,
  ShieldCheck,
} from "lucide-react";

import { DataTable } from "../components/DataTable";
import LogReviewPage from "../components/LogReviewPage";
import ManageSubmissions from "../components/ManageSubmissions";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { NotificationsView } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import {
  archiveDocument,
  completeDocumentDistribution,
  createDistributionRecipient,
  getDocumentDistributions,
  getDistributionRecipients,
  getIroAdminOverview,
  getIroAdminReports,
  markDistributionDelivered,
  prepareDocumentDistribution,
  reassignSubmission,
  updateDistributionRecipient,
} from "../services/documentService";

export function IroAdmin({ page, account }) {
  if (page === "incoming") return <ManageSubmissions queueMode />;
  if (page === "manage-submissions") return <AdminReviewForms account={account} />;
  if (page === "reassign") return <ReassignSubmissions />;
  if (page === "distribution-lists") return <DistributionLists />;
  if (page === "reports") return <PerformanceReports />;
  if (page === "archive") return <ArchivePage />;
  if (page === "expiry") return <AdminExpiryPage />;
  if (page === "notifications") return <NotificationsView roleKey="admin" />;

  return <IroAdminDashboard />;
}

function AdminReviewForms({ account }) {
  const [searchParams] = useSearchParams();
  const selectedDocumentId = searchParams.get("document") || "";
  const isPreparing =
    searchParams.get("mode") === "prepare" &&
    Boolean(selectedDocumentId);

  return isPreparing
    ? <LogReviewPage account={account} />
    : <ManageSubmissions selectedDocumentId={selectedDocumentId} />;
}

function useAdminOverview() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getIroAdminOverview());
    } catch (loadError) {
      setError(loadError.message || "Unable to load IRO Admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    window.addEventListener("conexia:workflow-changed", refresh);
    return () =>
      window.removeEventListener("conexia:workflow-changed", refresh);
  }, [refresh]);

  return { data, loading, error, refresh };
}

function DataState({ loading, error, onRetry, children }) {
  if (loading) return <p className="notification-state">Loading current data...</p>;
  if (error) {
    return (
      <div className="notification-state error">
        <p>{error}</p>
        <button className="outline" type="button" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }
  return children;
}

function IroAdminDashboard() {
  const { data, loading, error, refresh } = useAdminOverview();
  const stats = data?.stats;
  const cards = stats
    ? [
        [String(stats.totalSubmissions), "Total Submissions", Folder],
        [String(stats.pendingValidation), "Pending Validation", CalendarClock, "", "warn"],
        [
          stats.averageTurnaroundHours === null
            ? "No data"
            : `${stats.averageTurnaroundHours} hrs`,
          "Completed Turnaround Avg.",
          Gauge,
        ],
        [String(stats.notarizedThisMonth), "Notarized This Month", FileCheck2, "", "dark"],
      ]
    : [];
  const activityRows = (data?.activities || []).map((event) => [
    event.document?.tracking_number || "Unavailable",
    event.document?.partner_institution || "Unavailable",
    event.event_type.replaceAll("_", " "),
    formatDateTime(event.created_at),
    event.to_status,
  ]);

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Office Overview"
        subtitle="Live institutional submission and workflow data."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <StatGrid stats={cards} />
        <Panel title="Recent Workflow Activity">
          {activityRows.length ? (
            <DataTable
              headers={["Tracking #", "Partner", "Event", "Timestamp", "Result"]}
              rows={activityRows}
            />
          ) : (
            <p className="notification-state">No workflow activity has been recorded.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function ReassignSubmissions() {
  const { data, loading, error, refresh } = useAdminOverview();
  const [selections, setSelections] = React.useState({});
  const [reasons, setReasons] = React.useState({});
  const [busyId, setBusyId] = React.useState("");
  const [message, setMessage] = React.useState("");

  async function handleReassign(document) {
    const staffId = selections[document.id];
    const reason = reasons[document.id]?.trim();
    if (!staffId) {
      setMessage("Select a new IRO Staff member.");
      return;
    }
    if (!reason) {
      setMessage("Enter a reason for the reassignment.");
      return;
    }

    setBusyId(document.id);
    setMessage("");
    try {
      await reassignSubmission(document.id, staffId, reason);
      setSelections((current) => ({
        ...current,
        [document.id]: "",
      }));
      setReasons((current) => ({ ...current, [document.id]: "" }));
      setMessage(
        `${document.tracking_number} was reassigned successfully.`
      );
      await refresh();
    } catch (actionError) {
      setMessage(
        actionError.message || "Unable to reassign the submission."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Reassign Submissions"
        subtitle="Current assigned workload from the database."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <Panel title="Assigned Submissions">
          {message && (
            <p className="workflow-message" role="alert">
              {message}
            </p>
          )}
          {(data?.assignedSubmissions || []).length ? (
            <div className="submission-table-wrap">
              <table className="submission-table reassignment-table">
                <thead>
                  <tr>
                    <th>Tracking #</th>
                    <th>Partner</th>
                    <th>Current Assignee</th>
                    <th>Status</th>
                    <th>New Assignee</th>
                    <th>Reason</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assignedSubmissions.map((document) => {
                    const currentStaffId = document.assigned_iro_staff;
                    const currentStaff =
                      document.assigned_iro_staff_profile;
                    const eligibleStaff = (data.activeIroStaff || [])
                      .filter((staff) => staff.id !== currentStaffId);

                    return (
                      <tr key={document.id}>
                        <td>{document.tracking_number}</td>
                        <td>{document.partner_institution}</td>
                        <td>
                          {currentStaff?.full_name ||
                            currentStaff?.email ||
                            "Profile unavailable"}
                        </td>
                        <td>
                          <span className="badge">{document.status}</span>
                        </td>
                        <td>
                          <select
                            aria-label={`New assignee for ${document.tracking_number}`}
                            value={selections[document.id] || ""}
                            disabled={busyId === document.id}
                            onChange={(event) =>
                              setSelections((current) => ({
                                ...current,
                                [document.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">
                              {eligibleStaff.length
                                ? "Select IRO Staff..."
                                : "No other active IRO Staff"}
                            </option>
                            {eligibleStaff.map((staff) => (
                                <option key={staff.id} value={staff.id}>
                                  {staff.full_name || staff.email}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td>
                          <textarea
                            aria-label={`Reassignment reason for ${document.tracking_number}`}
                            placeholder="Reason for reassignment"
                            maxLength={2000}
                            value={reasons[document.id] || ""}
                            disabled={busyId === document.id}
                            onChange={(event) =>
                              setReasons((current) => ({
                                ...current,
                                [document.id]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="primary"
                            type="button"
                            disabled={
                              busyId === document.id ||
                              !selections[document.id] ||
                              !reasons[document.id]?.trim() ||
                              eligibleStaff.length === 0
                            }
                            onClick={() => handleReassign(document)}
                          >
                            {busyId === document.id
                              ? "Reassigning..."
                              : "Reassign"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="notification-state">No active assigned submissions.</p>
          )}
        </Panel>
        <Panel title="Active IRO Staff">
          {(data?.activeIroStaff || []).length ? (
            <DataTable
              headers={["Name", "Email"]}
              rows={data.activeIroStaff.map((staff) => [
                staff.full_name || "Name unavailable",
                staff.email,
              ])}
            />
          ) : (
            <p className="notification-state">No active IRO Staff profiles found.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function DistributionLists() {
  const [searchParams] = useSearchParams();
  const selectedDocumentId = searchParams.get("document") || "";
  const emptyForm = {
    document_type: "MOA",
    recipient_name: "",
    recipient_email: "",
    organization: "",
    role_scope: "CC",
    access_level: "View Only",
    is_required: true,
    is_active: true,
  };
  const [recipients, setRecipients] = React.useState([]);
  const [filter, setFilter] = React.useState("MOA");
  const [form, setForm] = React.useState(emptyForm);
  const [editingId, setEditingId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecipients(await getDistributionRecipients());
    } catch (loadError) {
      setError(loadError.message || "Unable to load distribution recipients.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  function resetForm() {
    setForm({ ...emptyForm, document_type: filter });
    setEditingId("");
  }

  function editRecipient(recipient) {
    setEditingId(recipient.id);
    setForm({
      document_type: recipient.document_type,
      recipient_name: recipient.recipient_name,
      recipient_email: recipient.recipient_email,
      organization: recipient.organization || "",
      role_scope: recipient.role_scope,
      access_level: recipient.access_level,
      is_required: recipient.is_required ?? true,
      is_active: recipient.is_active,
    });
    setMessage("");
    setError("");
  }

  async function saveRecipient(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingId) {
        await updateDistributionRecipient(editingId, form);
        setMessage("Distribution recipient updated.");
      } else {
        await createDistributionRecipient(form);
        setMessage("Distribution recipient added.");
      }
      resetForm();
      await refresh();
    } catch (saveError) {
      setError(saveError.message || "Unable to save the distribution recipient.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecipient(recipient) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateDistributionRecipient(recipient.id, {
        document_type: recipient.document_type,
        recipient_name: recipient.recipient_name,
        recipient_email: recipient.recipient_email,
        organization: recipient.organization,
        role_scope: recipient.role_scope,
        access_level: recipient.access_level,
        is_required: recipient.is_required,
        is_active: !recipient.is_active,
      });
      setMessage(
        `${recipient.recipient_name} was ${recipient.is_active ? "deactivated" : "activated"}.`
      );
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Unable to update recipient status.");
    } finally {
      setSaving(false);
    }
  }

  const visibleRecipients = recipients.filter(
    (recipient) => recipient.document_type === filter
  );
  const summary = [
    [String(recipients.filter((recipient) => recipient.is_active).length), "Active Recipients", FileCheck2],
    [String(recipients.filter((recipient) => recipient.document_type === "MOA").length), "MOA Recipients", Folder],
    [String(recipients.filter((recipient) => recipient.document_type === "MOU").length), "MOU Recipients", ShieldCheck],
    [String(recipients.filter((recipient) => recipient.document_type === "MOF").length), "MOF Recipients", Gauge, "", "dark"],
  ];

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Distribution Lists"
        subtitle="Configure recipient groups for MOA, MOU, and MOF document routing."
        action="New Recipient"
        onAction={resetForm}
        actionDisabled={saving}
      />
      <StatGrid stats={summary} />
      <Panel title={editingId ? "Edit Distribution Recipient" : "Add Distribution Recipient"}>
        <form className="distribution-recipient-form" onSubmit={saveRecipient}>
          <label>
            Document Type
            <select
              value={form.document_type}
              disabled={saving}
              onChange={(event) => setForm({ ...form, document_type: event.target.value })}
            >
              <option value="MOA">MOA</option>
              <option value="MOU">MOU</option>
              <option value="MOF">MOF</option>
            </select>
          </label>
          <label>
            Recipient Name
            <input
              required
              maxLength={255}
              value={form.recipient_name}
              disabled={saving}
              onChange={(event) => setForm({ ...form, recipient_name: event.target.value })}
            />
          </label>
          <label>
            Email Address
            <input
              required
              type="email"
              maxLength={255}
              value={form.recipient_email}
              disabled={saving}
              onChange={(event) => setForm({ ...form, recipient_email: event.target.value })}
            />
          </label>
          <label>
            Organization
            <input
              maxLength={255}
              value={form.organization}
              disabled={saving}
              onChange={(event) => setForm({ ...form, organization: event.target.value })}
            />
          </label>
          <label>
            Role Scope
            <select
              value={form.role_scope}
              disabled={saving}
              onChange={(event) => setForm({ ...form, role_scope: event.target.value })}
            >
              <option value="Signatory">Signatory</option>
              <option value="Reviewer">Reviewer</option>
              <option value="CC">CC</option>
            </select>
          </label>
          <label>
            Access Level
            <select
              value={form.access_level}
              disabled={saving}
              onChange={(event) => setForm({ ...form, access_level: event.target.value })}
            >
              <option value="Full Access">Full Access</option>
              <option value="View Only">View Only</option>
            </select>
          </label>
          <label>
            Delivery Requirement
            <select
              value={form.is_required ? "required" : "optional"}
              disabled={saving}
              onChange={(event) => setForm({
                ...form,
                is_required: event.target.value === "required",
              })}
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
          </label>
          <div className="distribution-form-actions">
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Recipient"}
            </button>
            {editingId && (
              <button className="outline" type="button" disabled={saving} onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Panel>
      <Panel title="Distribution Recipients">
        <div className="distribution-tabs" role="tablist" aria-label="Distribution document types">
          {["MOA", "MOU", "MOF"].map((type) => (
            <button
              className={filter === type ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={filter === type}
              key={type}
              onClick={() => setFilter(type)}
            >
              {type} Recipients
            </button>
          ))}
        </div>
        {message && <p className="workflow-message" role="status">{message}</p>}
        {error && <p className="workflow-message error" role="alert">{error}</p>}
        {loading ? (
          <p className="notification-state">Loading distribution recipients...</p>
        ) : visibleRecipients.length ? (
          <div className="submission-table-wrap">
            <table className="submission-table distribution-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Recipient</th>
                  <th>Email</th>
                  <th>Role Scope</th>
                  <th>Access Level</th>
                  <th>Delivery</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecipients.map((recipient) => (
                  <tr key={recipient.id}>
                    <td>{recipient.document_type}</td>
                    <td>{recipient.recipient_name}</td>
                    <td>{recipient.recipient_email}</td>
                    <td><span className={`scope-badge scope-${recipient.role_scope.toLowerCase()}`}>{recipient.role_scope}</span></td>
                    <td>{recipient.access_level}</td>
                    <td><span className="badge">{recipient.is_required ? "Required" : "Optional"}</span></td>
                    <td><span className="badge">{recipient.is_active ? "Active" : "Inactive"}</span></td>
                    <td className="distribution-row-actions">
                      <button className="outline" type="button" disabled={saving} onClick={() => editRecipient(recipient)}>
                        Edit
                      </button>
                      <button className="outline" type="button" disabled={saving} onClick={() => toggleRecipient(recipient)}>
                        {recipient.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="notification-state">No distribution recipients match this filter.</p>
        )}
      </Panel>
      <DocumentDistributionWorkflow selectedDocumentId={selectedDocumentId} />
    </section>
  );
}

function DocumentDistributionWorkflow({ selectedDocumentId = "" }) {
  const [documents, setDocuments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState("");
  const [notes, setNotes] = React.useState({});
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await getDocumentDistributions());
    } catch (loadError) {
      setError(loadError.message || "Unable to load documents for distribution.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!loading && selectedDocumentId) {
      document
        .getElementById(`distribution-document-${selectedDocumentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, selectedDocumentId]);

  async function runAction(id, action, successMessage) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Unable to update document distribution.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <Panel
      title="Document Distribution"
      tools={(
        <button className="outline" type="button" disabled={loading || busyId} onClick={refresh}>
          Refresh
        </button>
      )}
    >
      {message && <p className="workflow-message" role="status">{message}</p>}
      {error && <p className="workflow-message error" role="alert">{error}</p>}
      {loading ? (
        <p className="notification-state">Loading notarized documents...</p>
      ) : documents.length ? (
        <div className="distribution-document-list">
          {documents.map((document) => {
            const distributions = document.distributions || [];
            const delivered = distributions.filter(
              (item) => item.delivery_status === "Delivered"
            ).length;
            const requiredDistributions = distributions.filter(
              (item) => item.is_required !== false
            );
            const requiredDelivered = requiredDistributions.filter(
              (item) => item.delivery_status === "Delivered"
            ).length;
            const readyToComplete = requiredDistributions.length > 0
              && requiredDelivered === requiredDistributions.length;

            return (
              <article
                className={`distribution-document-card${selectedDocumentId === document.id ? " selected" : ""}`}
                id={`distribution-document-${document.id}`}
                key={document.id}
              >
                <div className="distribution-document-heading">
                  <div>
                    <strong>{document.tracking_number}</strong>
                    <p>{document.document_type} · {document.partner_institution}</p>
                  </div>
                  <span className="badge">{document.status}</span>
                </div>
                {document.status === "Notarized" ? (
                  <button
                    className="primary"
                    type="button"
                    disabled={busyId === document.id}
                    onClick={() => runAction(
                      document.id,
                      () => prepareDocumentDistribution(document.id),
                      `${document.tracking_number} is ready for distribution.`
                    )}
                  >
                    Prepare Distribution
                  </button>
                ) : (
                  <>
                    <p className="distribution-progress">
                      {requiredDelivered} of {requiredDistributions.length} required deliveries recorded
                      {distributions.length > requiredDistributions.length
                        ? ` (${delivered} of ${distributions.length} total)`
                        : ""}
                    </p>
                    <div className="submission-table-wrap">
                      <table className="submission-table distribution-delivery-table">
                        <thead>
                          <tr>
                            <th>Recipient</th>
                            <th>Role</th>
                            <th>Access</th>
                            <th>Delivery</th>
                            <th>Status</th>
                            <th>Delivery Notes</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {distributions.map((item) => (
                            <tr key={item.id}>
                              <td>{item.recipient_name}<small>{item.recipient_email}</small></td>
                              <td>{item.role_scope}</td>
                              <td>{item.access_level}</td>
                              <td><span className="badge">{item.is_required ? "Required" : "Optional"}</span></td>
                              <td><span className="badge">{item.delivery_status}</span></td>
                              <td>
                                {item.delivery_status === "Delivered"
                                  ? item.delivery_notes || "—"
                                  : (
                                    <input
                                      aria-label={`Delivery notes for ${item.recipient_name}`}
                                      maxLength={2000}
                                      placeholder="Optional reference or method"
                                      value={notes[item.id] || ""}
                                      onChange={(event) => setNotes((current) => ({
                                        ...current,
                                        [item.id]: event.target.value,
                                      }))}
                                    />
                                  )}
                              </td>
                              <td>
                                {item.delivery_status === "Delivered" ? (
                                  new Date(item.distributed_at).toLocaleString()
                                ) : (
                                  <button
                                    className="outline"
                                    type="button"
                                    disabled={busyId === item.id || document.status !== "Ready for Distribution"}
                                    onClick={() => runAction(
                                      item.id,
                                      () => markDistributionDelivered(document.id, item.id, notes[item.id]),
                                      `Delivery to ${item.recipient_name} recorded.`
                                    )}
                                  >
                                    Mark Delivered
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {document.status === "Ready for Distribution" && (
                      <button
                        className="primary distribution-complete-button"
                        type="button"
                        disabled={!readyToComplete || busyId === document.id}
                        onClick={() => runAction(
                          document.id,
                          () => completeDocumentDistribution(document.id),
                          `${document.tracking_number} distribution is complete and ready for archival.`
                        )}
                      >
                        Mark Distribution Complete
                      </button>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="notification-state">No notarized documents are waiting for distribution.</p>
      )}
    </Panel>
  );
}

function PerformanceReports() {
  const [report, setReport] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await getIroAdminReports());
    } catch (loadError) {
      setError(loadError.message || "Unable to load performance reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    window.addEventListener("conexia:workflow-changed", refresh);
    return () =>
      window.removeEventListener("conexia:workflow-changed", refresh);
  }, [refresh]);

  const stats = report
    ? [
        [String(report.reviewed), "Review Forms Validated", FileCheck2],
        [String(report.returned), "Returned for Corrections", CalendarClock, "", "danger"],
        [String(report.approved), "Approved", ShieldCheck],
        [String(report.notarized), "Notarized", FileCheck2],
      ]
    : [];
  const stageLabels = {
    submissionToLogging: "Submission to logging",
    loggingToValidation: "Logging to validation",
    validationToLegalDecision: "Validation to legal decision",
    approvalToNotarization: "Approval to notarization",
  };

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Institutional Performance Reports"
        subtitle="Metrics calculated from current documents and workflow events."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <StatGrid stats={stats} />
        <Panel title="Average Time per Workflow Stage">
          {Object.entries(report?.averageStageHours || {}).map(([key, hours]) => (
            <div className="bar-row" key={key}>
              <span>{stageLabels[key] || key}</span>
              <b>{hours === null ? "Insufficient data" : `${hours} hours`}</b>
            </div>
          ))}
        </Panel>
        <Panel title="Departmental Breakdown">
          {(report?.departments || []).length ? (
            <DataTable
              headers={["Department", "Total", "Approved", "Returned"]}
              rows={report.departments.map((row) => [
                row.department,
                String(row.total),
                String(row.approved),
                String(row.returned),
              ])}
            />
          ) : (
            <p className="notification-state">No departmental report data available.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function ArchivePage() {
  const { data, loading, error, refresh } = useAdminOverview();
  const [busyId, setBusyId] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const rows = (data?.archivedDocuments || []).map((document) => [
    document.tracking_number,
    document.partner_institution,
    document.document_type,
    formatDateTime(document.archived_at),
    document.status,
  ]);

  async function archive(document) {
    setBusyId(document.id);
    setActionError("");
    try {
      await archiveDocument(document.id);
      await refresh();
    } catch (archiveError) {
      setActionError(archiveError.message || "Unable to archive this record.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Records Archive"
        subtitle="Records with persisted archive timestamps."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <Panel title="Ready to Archive">
          {actionError && <p className="workflow-message error" role="alert">{actionError}</p>}
          {(data?.readyToArchive || []).length ? (
            <div className="submission-table-wrap">
              <table className="submission-table">
                <thead><tr><th>Tracking ID</th><th>Partner</th><th>Type</th><th>Action</th></tr></thead>
                <tbody>
                  {data.readyToArchive.map((document) => (
                    <tr key={document.id}>
                      <td>{document.tracking_number}</td>
                      <td>{document.partner_institution}</td>
                      <td>{document.document_type}</td>
                      <td><button className="primary" type="button" disabled={busyId === document.id} onClick={() => archive(document)}>{busyId === document.id ? "Archiving..." : "Archive Record"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="notification-state">No distribution-complete records are waiting for archival.</p>}
        </Panel>
        <Panel title="Archive Records">
          {rows.length ? (
            <DataTable
              headers={["Tracking ID", "Partner", "Type", "Archived At", "Status"]}
              rows={rows}
            />
          ) : (
            <p className="notification-state">No records have been archived.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function AdminExpiryPage() {
  const { data, loading, error, refresh } = useAdminOverview();
  const rows = (data?.expiringDocuments || []).map((document) => [
    document.tracking_number,
    document.partner_institution,
    document.document_type,
    formatDate(document.expiry_date),
    expiryState(document.expiry_date),
  ]);

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Agreement Expiry Tracking"
        subtitle="Documents with persisted expiry dates."
        action="Refresh"
        onAction={refresh}
        actionDisabled={loading}
      />
      <DataState loading={loading} error={error} onRetry={refresh}>
        <Panel title="Expiry Records">
          {rows.length ? (
            <DataTable
              headers={["Tracking #", "Partner", "Type", "Expiry Date", "State"]}
              rows={rows}
            />
          ) : (
            <p className="notification-state">No documents have an expiry date.</p>
          )}
        </Panel>
      </DataState>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString();
}

function expiryState(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return "Expires today";
  return `${days} days remaining`;
}

export default IroAdmin;
