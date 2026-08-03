import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import DocumentPreview from "./DocumentPreview";
import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";

import {
  getDocumentById,
  getLegalCounsels,
  getLoggedDocuments,
  routeToLegal,
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
    label: "GDPR Compliance",
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

  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] =
    useState("All");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [checklist, setChecklist] =
    useState(INITIAL_CHECKLIST);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [sentBackReason, setSentBackReason] = useState("");

  useEffect(() => {
    loadDocuments();
    loadLegalCounsels();
  }, []);

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

      setDocuments(Array.isArray(data) ? data : []);
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
      setLegalCounselId("");
      setAdminRemarks(document.review_form?.admin_remarks || "");
      setSentBackReason(document.review_form?.sent_back_reason || "");
    } catch (error) {
      console.error(
        "Unable to load selected document:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to load the selected document."
      );
    } finally {
      setLoadingDocumentId(null);
    }
  }

  function handleBackToQueue() {
    navigate("/app/incoming");
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
      await validateReviewForm(selectedDocument.id, adminRemarks);
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
        await validateReviewForm(selectedDocument.id, adminRemarks);
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

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepartment
      );
    });
  }, [
    documents,
    searchTerm,
    statusFilter,
    departmentFilter,
  ]);

  if (selectedDocument) {
    const hasReviewForm = Boolean(selectedDocument.review_form);
    const reviewFormStatus =
      selectedDocument.review_form?.review_form_status;
    const isSubmitted = hasReviewForm && reviewFormStatus === "submitted";
    const isValidated = reviewFormStatus === "validated";
    const isLogged =
      selectedDocument.status === "Logged" || !hasReviewForm;

    return (
      <section className="page iro-admin-page manage-review-page">
        <PageTitle
          title="Administrative Review"
          subtitle="Validate the logged submission before routing it to Legal Counsel."
        />

        <button
          className="btn outline"
          type="button"
          onClick={handleBackToQueue}
          disabled={submitting}
        >
          Back to Manage Submissions
        </button>

        <div className="two-col manage-review-layout">
          <div>
            <DocumentPreview
              document={selectedDocument}
            />
          </div>

          <aside className="review-sidebar dark-card admin-review">
            <h2>Administrative Review</h2>

            {!selectedDocument.review_form && (
              <div className="card-block">
                <h3>Ready for Administrative Review</h3>
                <p>
                  IRO Staff logged this submission. Review its contents and
                  complete the checklist below.
                </p>
              </div>
            )}

            <div className="card-block">
              <h3>Completeness Check</h3>
              {selectedDocument.review_form && <p>
                Staff:{" "}
                {selectedDocument.review_form?.preparer?.full_name ||
                  selectedDocument.review_form?.preparer?.email ||
                  "Not available"}
              </p>}

              {CHECKLIST_ITEMS.map((item) => (
                <label
                  className="checkline"
                  key={item.key}
                >
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    readOnly={!isLogged}
                    disabled={!isLogged || submitting}
                    onChange={() =>
                      isLogged && setChecklist((current) => ({
                        ...current,
                        [item.key]: !current[item.key],
                      }))
                    }
                  />

                  <span>{item.label}</span>
                </label>
              ))}
              {selectedDocument.review_form && <label>
                Staff Remarks
                <textarea
                  value={selectedDocument.review_form?.staff_remarks || ""}
                  readOnly
                />
              </label>}
            </div>

            {(isLogged || isSubmitted || isValidated) && (
            <div className="card-block route-card">
              <label>
                Route To

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
                      {counsel.full_name ||
                        counsel.email ||
                        "Legal Counsel"}
                      {counsel.email
                        ? ` — ${counsel.email}`
                        : ""}
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
            </div>
            )}

            <div className="card-block">
              <label>
                Admin Remarks

                <textarea
                  value={adminRemarks}
                  onChange={(event) =>
                    setAdminRemarks(
                      event.target.value
                    )
                  }
                  placeholder="Add validation notes..."
                  readOnly={isValidated}
                  disabled={submitting}
                />
              </label>
              {isSubmitted && hasReviewForm && (
              <label>
                Send-back Reason
                <textarea
                  value={sentBackReason}
                  onChange={(event) => setSentBackReason(event.target.value)}
                  placeholder="Explain what IRO Staff must correct..."
                  disabled={
                    submitting ||
                    !isSubmitted
                  }
                />
              </label>
              )}
            </div>

            <div className="review-actions">
              {statusMessage && (
                <p
                  className="review-status"
                  role="alert"
                  style={{
                    marginBottom: "12px",
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#004b32",
                    lineHeight: 1.4,
                  }}
                >
                  {statusMessage}
                </p>
              )}

              {isSubmitted && hasReviewForm && (
                  <button
                    className="btn outline wide-inline"
                    type="button"
                    onClick={handleSendBack}
                    disabled={submitting}
                  >
                    Send Back as Incomplete
                  </button>
              )}

              {(isLogged || isSubmitted || isValidated) && (
                <button
                  className="btn primary large wide-inline route-action"
                  type="button"
                  onClick={handleSubmitToLegal}
                  disabled={submitting || !legalCounselId}
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit to Legal for Checking"}
                </button>
              )}

              <button
                className="btn outline wide-inline"
                type="button"
                onClick={handleBackToQueue}
                disabled={submitting}
              >
                Cancel Review
              </button>
            </div>
          </aside>
        </div>
      </section>
    );
  }

  if (!queueMode) {
    if (loadingDocumentId) {
      return (
        <section className="page iro-admin-page">
          <PageTitle
            title="Review Forms"
            subtitle="Loading the selected submission for administrative review."
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
          title="Review Forms"
          subtitle="Select a submission from Incoming Submissions to validate it and route it to Legal Counsel."
          action="Open Incoming Submissions"
          onAction={() => navigate("/app/incoming")}
        />
        <Panel title="No Submission Selected">
          {errorMessage ? (
            <div className="error-message">
              <p>{errorMessage}</p>
              <button
                className="btn outline"
                type="button"
                onClick={() =>
                  handleReview(
                    selectedDocumentId || searchParams.get("document")
                  )
                }
              >
                Retry
              </button>
            </div>
          ) : (
            <p className="empty-state">
              Open Incoming Submissions and choose Review Submission.
            </p>
          )}
        </Panel>
      </section>
    );
  }

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Incoming Submissions"
        subtitle="Documents logged and forwarded by IRO Staff for administrative review."
        action="Refresh Queue"
        onAction={loadDocuments}
        actionDisabled={loading}
      />

      <div className="manage-submission-filters">
        <input
          type="search"
          placeholder="Search tracking, department, partner, type, staff, or status..."
          value={searchTerm}
          onChange={(event) =>
            setSearchTerm(event.target.value)
          }
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
        >
          <option value="All">All Statuses</option>
          <option value="Logged">Logged by IRO Staff</option>
          <option value="Review Form Submitted">
            Awaiting Validation
          </option>
          <option value="Admin Validated">
            Validated
          </option>
        </select>

        <select
          value={departmentFilter}
          onChange={(event) =>
            setDepartmentFilter(event.target.value)
          }
        >
          {departments.map((department) => (
            <option
              key={department}
              value={department}
            >
              {department === "All"
                ? "All Departments"
                : department}
            </option>
          ))}
        </select>
      </div>

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
                    <th>Last Updated</th>
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
                      <tr key={document.id}>
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
                          {formatUpdatedAt(document.updated_at)}
                        </td>

                        <td className="manage-action-cell">
                          <button
                            className="btn primary small"
                            type="button"
                            disabled={Boolean(loadingDocumentId)}
                            onClick={() =>
                              handleReview(document.id)
                            }
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
