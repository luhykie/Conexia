import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";

import DocumentPreview from "./DocumentPreview";
import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";

import {
  assignRevisionToIroStaff,
  assignDistributionToIroStaff,
  getDocumentById,
  getDocumentFileBlob,
  getIroStaffProfiles,
  getLegalCounsels,
  getLoggedDocuments,
  reassignSubmission,
  routeToLegal,
  saveAdminReviewPending,
  sendBackReviewForm,
  submitReviewForm,
  validateReviewForm,
} from "../services/documentService";

const CHECKLIST_ITEMS = [
  {
    key: "signatures",
    label: "Signatures Present",
  },
  {
    key: "terms",
    label: "Terms Defined",
  },
  {
    key: "attachments",
    label: "Attachments Included",
  },
  {
    key: "gdpr",
    label: "Data Privacy Compliance",
  },
];

const INITIAL_CHECKLIST = {
  signatures: false,
  terms: false,
  attachments: false,
  gdpr: false,
};

function getDepartmentName(document) {
  return (
    document.department?.name ||
    document.departments?.name ||
    document.department_name ||
    "Department unavailable"
  );
}

function getAssignedStaffName(document) {
  const profile = document.assigned_iro_staff_profile;

  return (
    profile?.full_name ||
    profile?.email ||
    (document.assigned_iro_staff ? "Staff profile unavailable" : "Unassigned")
  );
}

function formatUpdatedAt(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ManageSubmissions({
  queueMode = false,
  selectedDocumentId = "",
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] =
    useState(null);

  const [legalCounsels, setLegalCounsels] = useState([]);
  const [legalCounselId, setLegalCounselId] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [loadingDocumentId, setLoadingDocumentId] =
    useState(null);
  const [loadingCounsels, setLoadingCounsels] =
    useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [counselError, setCounselError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] =
    useState("All");
  const [statusFilter, setStatusFilter] =
    useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [staffFilter, setStaffFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [iroStaff, setIroStaff] = useState([]);
  const [reassignReason, setReassignReason] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);

  const [checklist, setChecklist] =
    useState(INITIAL_CHECKLIST);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [sentBackReason, setSentBackReason] = useState("");
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [distributionInstructions, setDistributionInstructions] = useState("");

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    const linkedSearch = searchParams.get("search") || "";
    setSearchInput(linkedSearch);
    setSearchTerm(linkedSearch);
  }, [searchParams]);

  useEffect(() => {
    const documentId =
      selectedDocumentId || searchParams.get("document");

    if (documentId) {
      handleReview(documentId);
    }
  }, [selectedDocumentId]);

  async function loadDocuments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getLoggedDocuments();
      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
      setIroStaff(Array.isArray(data?.iroStaff) ? data.iroStaff : []);
      setLegalCounsels(Array.isArray(data?.legalCounsels) ? data.legalCounsels : []);
      setLoadingCounsels(false);
    } catch (error) {
      console.error(
        "Unable to load managed submissions:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to load submissions."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadLegalCounsels() {
    setLoadingCounsels(true);
    setCounselError("");

    try {
      const data = await getLegalCounsels();

      setLegalCounsels(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Unable to load Legal Counsel accounts:",
        error
      );

      setLegalCounsels([]);

      setCounselError(
        error?.message ||
          "Unable to load Legal Counsel accounts."
      );
    } finally {
      setLoadingCounsels(false);
    }
  }

  async function handleReview(documentId) {
    if (queueMode) {
      navigate(`/app/manage-submissions?document=${documentId}`);
      return;
    }

    setLoadingDocumentId(documentId);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const document =
        await getDocumentById(documentId);

      setSelectedDocument(document);
      setChecklist({
        ...INITIAL_CHECKLIST,
        ...(document.review_form?.checklist_answers || {}),
      });
      setLegalCounselId(document.assigned_legal_counsel || "");
      setAdminRemarks(document.review_form?.admin_remarks || "");
      setSentBackReason(document.review_form?.sent_back_reason || "");
      setReassignReason("");
      setRevisionInstructions(document.admin_revision_instructions || "");
      setDistributionInstructions(document.admin_distribution_instructions || "");
    } catch (error) {
      console.error(
        "Unable to load selected document:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to load the selected document."
      );
      navigate("/app/manage-submissions", { replace: true });
    } finally {
      setLoadingDocumentId(null);
    }
  }

  function handleBackToQueue() {
    navigate("/app/manage-submissions");
    setSelectedDocument(null);
    setChecklist(INITIAL_CHECKLIST);
    setLegalCounselId("");
    setAdminRemarks("");
    setSentBackReason("");
    setStatusMessage("");
    setErrorMessage("");
  }

  async function refreshSelectedDocument() {
    const refreshed = await getDocumentById(selectedDocument.id);
    setSelectedDocument(refreshed);
    setChecklist({
      ...INITIAL_CHECKLIST,
      ...(refreshed.review_form?.checklist_answers || {}),
    });
    return refreshed;
  }

  async function handleValidate() {
    setStatusMessage("");
    setErrorMessage("");

    if (!selectedDocument?.id) {
      setStatusMessage("No submission is selected.");
      return;
    }

    const incompleteItems = CHECKLIST_ITEMS.filter(
      (item) => !checklist[item.key]
    );

    if (incompleteItems.length > 0) {
      setStatusMessage(
        `Complete the following requirements: ${incompleteItems
          .map((item) => item.label)
          .join(", ")}.`
      );
      return;
    }

    setSubmitting(true);

    try {
      if (
        selectedDocument.status === "Logged" ||
        !selectedDocument.review_form
      ) {
        await submitReviewForm(selectedDocument.id, {
          checklist_answers: checklist,
          staff_remarks: null,
        });
      }
      await validateReviewForm(selectedDocument.id, adminRemarks, checklist);
      await refreshSelectedDocument();
      setStatusMessage("Review Form validated. You may now route it to Legal Counsel.");
    } catch (error) {
      setStatusMessage(
        error?.message ||
          "Unable to validate the Review Form."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendBack() {
    if (!sentBackReason.trim()) {
      setStatusMessage("A send-back reason is required.");
      return;
    }

    setSubmitting(true);
    setStatusMessage("");
    try {
      await sendBackReviewForm(
        selectedDocument.id,
        sentBackReason,
        adminRemarks
      );
      await loadDocuments();
      setStatusMessage("Review Form sent back to IRO Staff.");
      setReturnOpen(false);
      window.setTimeout(handleBackToQueue, 1200);
    } catch (error) {
      setStatusMessage(error.message || "Unable to send back the Review Form.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRouteToLegal() {
    if (selectedDocument?.review_form?.review_form_status !== "validated") {
      setStatusMessage("Validate the Review Form before routing.");
      return;
    }
    if (!legalCounselId) {
      setStatusMessage("Please select a Legal Counsel before routing.");
      return;
    }

    setSubmitting(true);
    setStatusMessage("");
    try {
      await routeToLegal(selectedDocument.id, legalCounselId);
      await loadDocuments();
      setStatusMessage("Validated document routed to Legal Counsel.");
      window.setTimeout(handleBackToQueue, 1200);
    } catch (error) {
      setStatusMessage(error.message || "Unable to route the document.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePending() {
    if (!selectedDocument?.id) return;
    setSubmitting(true);
    setStatusMessage("");
    try {
      await saveAdminReviewPending(selectedDocument.id, adminRemarks, checklist);
      await refreshSelectedDocument();
      setStatusMessage("Administrative review saved as pending.");
    } catch (error) {
      setStatusMessage(error.message || "Unable to save the pending review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReassign() {
    if (!reassignReason.trim()) {
      setStatusMessage("Enter a reason for returning the submission.");
      return;
    }
    setSubmitting(true);
    setStatusMessage("");
    try {
      await reassignSubmission(selectedDocument.id, reassignReason);
      await refreshSelectedDocument();
      await loadDocuments();
      setReassignReason("");
      setStatusMessage("Submission returned to IRO Staff.");
    } catch (error) {
      setStatusMessage(error.message || "Unable to update the assignment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignRevision() {
    setSubmitting(true);
    setStatusMessage("");
    try {
      await assignRevisionToIroStaff(selectedDocument.id, revisionInstructions);
      await refreshSelectedDocument();
      await loadDocuments();
      setStatusMessage("Revision handling assigned to IRO Staff.");
    } catch (error) {
      setStatusMessage(error.message || "Unable to assign revision handling.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openAttachment(file) {
    try {
      const blob = await getDocumentFileBlob(selectedDocument.id, file.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setStatusMessage(error.message || "Unable to open the attachment.");
    }
  }

  async function handleSubmitToLegal() {
    if (!selectedDocument?.id) {
      setStatusMessage("No submission is selected.");
      return;
    }

    const incompleteItems = CHECKLIST_ITEMS.filter(
      (item) => !checklist[item.key]
    );
    if (!selectedDocument.review_form?.validated_at && incompleteItems.length) {
      setStatusMessage(
        `Complete the following requirements: ${incompleteItems
          .map((item) => item.label)
          .join(", ")}.`
      );
      return;
    }
    if (!legalCounselId) {
      setStatusMessage("Select a Legal Counsel before submitting.");
      return;
    }

    setSubmitting(true);
    setStatusMessage("Validating and submitting to Legal Counsel...");
    try {
      if (
        !["submitted", "validated"].includes(
          selectedDocument.review_form?.review_form_status
        )
      ) {
        await submitReviewForm(selectedDocument.id, {
          checklist_answers: checklist,
          staff_remarks: null,
        });
      }
      if (selectedDocument.review_form?.review_form_status !== "validated") {
        await validateReviewForm(selectedDocument.id, adminRemarks, checklist);
      }
      await routeToLegal(selectedDocument.id, legalCounselId);
      await loadDocuments();
      setStatusMessage("Document submitted to Legal Counsel for checking.");
      window.setTimeout(handleBackToQueue, 1200);
    } catch (error) {
      setStatusMessage(
        error?.message || "Unable to submit the document to Legal Counsel."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const departments = useMemo(() => {
    const departmentValues = documents
      .map(
        (document) =>
          getDepartmentName(document)
      )
      .filter(Boolean);

    return ["All", ...new Set(departmentValues)];
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return documents.filter((document) => {
      const department = getDepartmentName(document);
      const assignedStaff = getAssignedStaffName(document);

      const matchesSearch =
        !search ||
        [
          document.tracking_number,
          document.partner_institution,
          document.document_type,
          document.status,
          department,
          assignedStaff,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(search)
          );

      const matchesStatus =
        statusFilter === "All" ||
        document.status === statusFilter;

      const matchesDepartment =
        departmentFilter === "All" ||
        department === departmentFilter;
      const matchesType = typeFilter === "All" || document.document_type === typeFilter;
      const matchesStaff = staffFilter === "All" || (
        staffFilter === "Unassigned"
          ? !document.assigned_iro_staff
          : document.assigned_iro_staff === staffFilter
      );
      const matchesDate = !dateFilter || (
        document.submitted_at
        && new Date(document.submitted_at).toISOString().slice(0, 10) === dateFilter
      );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepartment &&
        matchesType &&
        matchesStaff &&
        matchesDate
      );
    });
  }, [
    documents,
    searchTerm,
    statusFilter,
    departmentFilter,
    typeFilter,
    staffFilter,
    dateFilter,
  ]);

  function clearFilters() {
    setSearchInput("");
    setSearchTerm("");
    setStatusFilter("All");
    setTypeFilter("All");
    setDepartmentFilter("All");
    setStaffFilter("All");
    setDateFilter("");
  }

  async function handleAssignDistribution() {
    setSubmitting(true);
    setStatusMessage("");
    try {
      await assignDistributionToIroStaff(selectedDocument.id, distributionInstructions);
      await refreshSelectedDocument();
      await loadDocuments();
      setStatusMessage("Approved document assigned to IRO Staff for distribution.");
    } catch (error) {
      setStatusMessage(error.message || "Unable to assign distribution.");
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedDocument) {
    const hasReviewForm = Boolean(selectedDocument.review_form);
    const reviewFormStatus =
      selectedDocument.review_form?.review_form_status;
    const isSubmitted = hasReviewForm && reviewFormStatus === "submitted";
    const isValidated = reviewFormStatus === "validated";
    const isLogged =
      selectedDocument.status === "Logged" || !hasReviewForm;
    const isCheckedRevision = selectedDocument.status === "Logged" &&
      (selectedDocument.workflow_events || []).some(
        (event) => event.event_type === "revision_checked"
      );
    const incompleteChecklist = CHECKLIST_ITEMS.filter(
      (item) => !checklist[item.key]
    );
    const routeDisabledReason = loadingCounsels
      ? "Legal Counsel accounts are still loading."
      : incompleteChecklist.length
        ? `Complete: ${incompleteChecklist.map((item) => item.label).join(", ")}.`
        : !legalCounselId
          ? "Select a Legal Counsel before routing."
          : "";

    return (
      <section className="page iro-admin-page manage-review-page">
        <PageTitle
          title="Administrative Review"
          subtitle="Validate the logged submission before routing it to Legal Counsel."
        />

        <button
          className="btn outline review-back-button"
          type="button"
          onClick={handleBackToQueue}
          disabled={submitting}
        >
          <span aria-hidden="true">←</span> Back to Manage Submissions
        </button>

        <div className="two-col manage-review-layout">
          <div>
            <Panel title="Submission Information">
              <dl className="submission-information-grid">
                <div><dt>Tracking Number</dt><dd>{selectedDocument.tracking_number}</dd></div>
                <div><dt>Department</dt><dd>{getDepartmentName(selectedDocument)}</dd></div>
                <div><dt>Partner</dt><dd>{selectedDocument.partner_institution}</dd></div>
                <div><dt>Document Type</dt><dd>{selectedDocument.document_type}</dd></div>
                <div><dt>Current Assignee</dt><dd>{getAssignedStaffName(selectedDocument)}</dd></div>
                <div><dt>Date Submitted</dt><dd>{formatUpdatedAt(selectedDocument.submitted_at)}</dd></div>
              </dl>
            </Panel>
            <DocumentPreview
              document={selectedDocument}
            />
            <Panel title="Supporting Attachments">
              {(selectedDocument.files || []).filter((file) => file.file_category !== "original_draft").length ? (
                <div className="attachment-list">
                  {(selectedDocument.files || []).filter((file) => file.file_category !== "original_draft").map((file) => (
                    <div key={file.id}>
                      <span><b>{file.original_filename}</b><small>{file.file_category.replaceAll("_", " ")}</small></span>
                      <button className="outline" type="button" onClick={() => openAttachment(file)}>Open / Download</button>
                    </div>
                  ))}
                </div>
              ) : <p className="notification-state">No supporting attachments were submitted.</p>}
            </Panel>
            <Panel title="Revision and Activity History">
              {(selectedDocument.workflow_events || []).length ? (
                <div className="submission-history">
                  {[...selectedDocument.workflow_events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((event) => (
                    <article key={event.id}>
                      <b>{String(event.event_type).replaceAll("_", " ")}</b>
                      <p>{event.notes || `${event.from_status || "Created"} → ${event.to_status}`}</p>
                      <time>{formatUpdatedAt(event.created_at)}</time>
                    </article>
                  ))}
                </div>
              ) : <p className="notification-state">No activity has been recorded.</p>}
            </Panel>
          </div>

          <aside className="review-sidebar admin-review">
            {selectedDocument.status === "Approved" ? (
              <>
                <header className="admin-review-intro">
                  <h2>Legal Approval Result</h2>
                  <p>Assign the approved document for distribution to its designated departments.</p>
                </header>
                <div className="card-block distribution-handoff-card">
                  <p className="revision-status"><span>Status</span><strong>Approved</strong></p>
                  <label>Designated Department<input value={getDepartmentName(selectedDocument)} readOnly /></label>
                  <label>Instructions to IRO Staff <span className="optional-label">Optional</span><textarea value={distributionInstructions} disabled={submitting} onChange={(event) => setDistributionInstructions(event.target.value)} placeholder="Add distribution instructions..." /></label>
                  <button className="btn primary large" type="button" disabled={submitting || iroStaff.length !== 1} onClick={handleAssignDistribution}>{submitting ? "Assigning..." : "Assign Distribution to IRO Staff"}</button>
                  {iroStaff.length !== 1 && <p className="assignment-unavailable">The action requires exactly one active IRO Staff account.</p>}
                  {statusMessage && <p className="review-status" role="alert">{statusMessage}</p>}
                </div>
              </>
            ) : selectedDocument.status === "Corrections Needed" ? (
              <>
                <header className="admin-review-intro">
                  <h2>Legal Review Result</h2>
                  <p>Process the revision request returned by Legal Counsel.</p>
                </header>
                <div className="card-block revision-handoff-card">
                  <p className="revision-status"><span>Status</span><strong>Corrections Needed</strong></p>
                  <label>Legal Counsel Comments<textarea value={selectedDocument.legal_notes || "No comments provided."} readOnly /></label>
                  <label>Designated Department<input value={getDepartmentName(selectedDocument)} readOnly /></label>
                  <label>Instructions to IRO Staff <span className="optional-label">Optional</span><textarea value={revisionInstructions} disabled={submitting} onChange={(event) => setRevisionInstructions(event.target.value)} placeholder="Add forwarding instructions..." /></label>
                  <button className="btn primary large" type="button" disabled={submitting || iroStaff.length !== 1} onClick={handleAssignRevision}>{submitting ? "Assigning..." : "Assign to IRO Staff"}</button>
                  {iroStaff.length !== 1 && <p className="assignment-unavailable">The action requires exactly one active IRO Staff account.</p>}
                  {statusMessage && <p className="review-status" role="alert">{statusMessage}</p>}
                </div>
              </>
            ) : (
            <>
            <header className="admin-review-intro">
              <h2>{isCheckedRevision ? "Revised Document Review" : "Administrative Review"}</h2>
              <p>{isCheckedRevision
                ? "Confirm and forward the revised document to Legal Counsel."
                : "Review and process the selected submission."}</p>
            </header>

            <div className="card-block">
              <h3>Completeness Check</h3>
              <p className="reviewed-by">
                <span>Reviewed by</span>
                <strong>
                {selectedDocument.review_form?.preparer?.full_name ||
                  selectedDocument.review_form?.preparer?.email ||
                  getAssignedStaffName(selectedDocument) || "Not available"}
                </strong>
              </p>

              {CHECKLIST_ITEMS.map((item) => (
                <label
                  className="checkline"
                  key={item.key}
                >
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    readOnly={isValidated}
                    disabled={isValidated || submitting}
                    onChange={() =>
                      !isValidated && setChecklist((current) => ({
                        ...current,
                        [item.key]: !current[item.key],
                      }))
                    }
                  />

                  <span>{item.label}</span>
                </label>
              ))}
              <label>
                IRO Staff Remarks
                <textarea
                  value={selectedDocument.review_form?.staff_remarks || ""}
                  readOnly
                  placeholder="No remarks were provided."
                />
              </label>
            </div>

            {!isCheckedRevision && <div className="card-block assignment-card">
              <h3>Assignment</h3>
              <label>
                Reason for Reassignment <span className="required-mark">Required</span>
                <textarea
                  value={reassignReason}
                  disabled={submitting}
                  onChange={(event) => setReassignReason(event.target.value)}
                  placeholder="Explain why the document is being reassigned..."
                />
              </label>
              <button
                className="btn warning-outline wide-inline"
                type="button"
                disabled={submitting || !reassignReason.trim() || iroStaff.length !== 1}
                onClick={handleReassign}
              >
                {submitting ? "Returning..." : "Reassign to IRO Staff"}
              </button>
              {iroStaff.length !== 1 && (
                <p className="assignment-unavailable">The action requires exactly one active IRO Staff account.</p>
              )}
            </div>}

            {(isLogged || isSubmitted || isValidated) && (
            <div className="card-block route-card">
              <h3>Legal Routing</h3>
              <label>
                Assign Legal Counsel

                <select
                  value={legalCounselId}
                  onChange={(event) =>
                    setLegalCounselId(
                      event.target.value
                    )
                  }
                  disabled={
                    submitting ||
                    loadingCounsels
                  }
                >
                  <option value="">
                    {loadingCounsels
                      ? "Loading Legal Counsel..."
                      : "Select Legal Counsel..."}
                  </option>

                  {legalCounsels.map((counsel) => (
                    <option
                      key={counsel.id}
                      value={counsel.id}
                    >
                      {counsel.full_name && !["legal", "legal counsel"].includes(counsel.full_name.trim().toLowerCase())
                        ? counsel.full_name
                        : "Legal Counsel"}
                    </option>
                  ))}
                </select>
              </label>

              {!loadingCounsels &&
                !counselError &&
                legalCounsels.length === 0 && (
                  <p className="review-status">
                    No active Legal Counsel account was
                    found.
                  </p>
                )}

              {counselError && (
                <div className="error-message">
                  <p>{counselError}</p>

                  <button
                    className="btn outline small"
                    type="button"
                    onClick={loadLegalCounsels}
                    disabled={loadingCounsels}
                  >
                    Reload Legal Counsel
                  </button>
                </div>
              )}
              <label>
                Administrative Remarks <span className="optional-label">Optional</span>
                <textarea
                  value={adminRemarks}
                  onChange={(event) => setAdminRemarks(event.target.value)}
                  placeholder="Add optional notes..."
                  readOnly={isValidated}
                  disabled={submitting}
                />
              </label>
            </div>
            )}

            <div className="admin-decision-actions">
              {statusMessage && <p className="review-status" role="alert">{statusMessage}</p>}
              {!isValidated && (
                <button
                  className="btn outline wide-inline"
                  type="button"
                  onClick={handleSavePending}
                  disabled={submitting}
                >
                  Save as Pending
                </button>
              )}
              {isSubmitted && hasReviewForm && (
                  <button
                    className="btn warning-outline wide-inline"
                    type="button"
                    onClick={() => {
                      setSentBackReason("");
                      setStatusMessage("");
                      setReturnOpen(true);
                    }}
                    disabled={submitting}
                  >
                    Return to IRO Staff
                  </button>
              )}

              {(isLogged || isSubmitted || isValidated) && (
                <button
                  className="btn primary large wide-inline route-action"
                  type="button"
                  onClick={handleSubmitToLegal}
                  disabled={submitting || Boolean(routeDisabledReason)}
                >
                  {submitting
                    ? "Submitting..."
                    : isCheckedRevision
                      ? "Forward Revised Document to Legal"
                      : "Validate and Route to Legal"}
                </button>
              )}
              {routeDisabledReason && !isValidated && <p className="action-disabled-reason">{routeDisabledReason}</p>}
            </div>
            </>
            )}
          </aside>
        </div>

        {returnOpen && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => !submitting && setReturnOpen(false)}>
            <div className="action-modal" role="dialog" aria-modal="true" aria-labelledby="return-title" onMouseDown={(event) => event.stopPropagation()}>
              <header><div><h2 id="return-title">Return to IRO Staff</h2><p>Tell the assigned staff member what must be corrected.</p></div><button type="button" aria-label="Close" onClick={() => setReturnOpen(false)}>×</button></header>
              <div className="action-modal-body"><label>Return reason <span className="required-mark">Required</span><textarea autoFocus value={sentBackReason} disabled={submitting} onChange={(event) => setSentBackReason(event.target.value)} placeholder="Describe the required corrections..." /></label></div>
              <footer><button className="btn outline" type="button" disabled={submitting} onClick={() => setReturnOpen(false)}>Cancel</button><button className="btn warning" type="button" disabled={submitting || !sentBackReason.trim()} onClick={handleSendBack}>{submitting ? "Returning..." : "Return Submission"}</button></footer>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (!queueMode && loadingDocumentId) {
    return (
      <section className="page iro-admin-page">
        <PageTitle
          title="Manage Submissions"
          subtitle="Opening the selected submission for administrative review."
        />
        <Panel title="Opening Submission">
          <p className="empty-state">Loading document...</p>
        </Panel>
      </section>
    );
  }

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Manage Submissions"
        subtitle="Submitted documents requiring administrative action."
      />

      <form
        className="manage-filter-toolbar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearchTerm(searchInput);
        }}
      >
        <div className="manage-search-control">
          <label className="sr-only" htmlFor="manage-search">Search documents</label>
          <Search size={18} aria-hidden="true" />
          <input
            id="manage-search"
            type="search"
            placeholder="Search documents..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <button className="manage-search-button" type="submit">Search</button>

        <label className="manage-filter-field" htmlFor="manage-status">
          <span>Status</span>
          <select id="manage-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Logged">Logged by IRO Staff</option>
            <option value="Review Form Submitted">Awaiting Validation</option>
            <option value="Admin Validated">Validated</option>
          </select>
        </label>

        <label className="manage-filter-field manage-type-filter" htmlFor="manage-type">
          <span>Document Type</span>
          <select id="manage-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="All">All Types</option>
            <option value="MOA">MOA</option>
            <option value="MOU">MOU</option>
            <option value="MOF">MOF</option>
          </select>
        </label>

        <label className="manage-filter-field manage-department-filter" htmlFor="manage-department">
          <span>Department</span>
          <select id="manage-department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department === "All" ? "All Departments" : department}
              </option>
            ))}
          </select>
        </label>

        <label className="manage-filter-field manage-staff-filter" htmlFor="manage-staff">
          <span>Assigned IRO Staff</span>
          <select id="manage-staff" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}>
            <option value="All">All IRO Staff</option>
            <option value="Unassigned">Unassigned</option>
            {iroStaff.map((staff) => (
              <option key={staff.id} value={staff.id}>{staff.full_name || staff.email}</option>
            ))}
          </select>
        </label>

        <label className="manage-filter-field manage-date-filter" htmlFor="manage-date">
          <span>Date Submitted</span>
          <input id="manage-date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </label>

        <button className="manage-clear-button" type="button" onClick={clearFilters}>Clear Filters</button>
        <button className="manage-refresh-button" type="button" onClick={loadDocuments} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" className={loading ? "spin" : ""} />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </form>

      <Panel title="Submissions Awaiting Admin Action">
        {loading && <p>Loading submissions...</p>}

        {loadingDocumentId && (
          <p>Opening document...</p>
        )}

        {!loading && errorMessage && (
          <div className="error-message">
            <p>{errorMessage}</p>

            <button
              className="btn outline"
              type="button"
              onClick={loadDocuments}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          filteredDocuments.length === 0 && (
            <p className="empty-state">
              No submissions from IRO Staff match the selected filters.
            </p>
          )}

        {!loading &&
          !errorMessage &&
          filteredDocuments.length > 0 && (
            <div className="table-responsive">
              <table className="manage-submissions-table">
                <thead>
                  <tr>
                    <th>Tracking #</th>
                    <th>Department</th>
                    <th>Partner</th>
                    <th>Type</th>
                    <th>Assigned Staff</th>
                    <th>Status</th>
                    <th>Date Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDocuments.map((document) => {
                    const department =
                      getDepartmentName(document);
                    const assignedStaff =
                      getAssignedStaffName(document);

                    return (
                      <tr
                        className="clickable-submission-row"
                        key={document.id}
                        tabIndex={0}
                        onClick={() => handleReview(document.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleReview(document.id);
                          }
                        }}
                      >
                        <td className="manage-tracking-cell">
                          {document.tracking_number ||
                            "N/A"}
                        </td>

                        <td className="manage-department-cell">
                          {department}
                        </td>

                        <td className="manage-partner-cell">
                          {document.partner_institution ||
                            "N/A"}
                        </td>

                        <td className="manage-type-cell">
                          <span className="badge">
                            {document.document_type ||
                              "N/A"}
                          </span>
                        </td>

                        <td className="manage-staff-cell">
                          {assignedStaff}
                        </td>

                        <td className="manage-status-cell">
                          <span className="badge active">
                            {document.status ||
                              "Unknown"}
                          </span>
                        </td>

                        <td className="manage-date-cell">
                          {formatUpdatedAt(document.submitted_at)}
                        </td>

                        <td className="manage-action-cell">
                          <button
                            className="btn primary small"
                            type="button"
                            disabled={Boolean(loadingDocumentId)}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleReview(document.id)
                            }}
                          >
                            {loadingDocumentId === document.id
                              ? "Opening..."
                              : "Review Submission"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Panel>
    </section>
  );
}

export default ManageSubmissions;
