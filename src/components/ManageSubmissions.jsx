import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DocumentPreview from "./DocumentPreview";
import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";

import {
  getDocumentById,
  getLegalCounsels,
  getLoggedDocuments,
  routeToLegal,
  sendBackReviewForm,
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

export function ManageSubmissions() {
  const [searchParams, setSearchParams] = useSearchParams();
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
    const documentId = searchParams.get("document");

    if (documentId) {
      handleReview(documentId);
    }
  }, []);

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
    setSearchParams({}, { replace: true });
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
                <h3>Waiting for IRO Staff</h3>
                <p>
                  This document has not yet received a submitted Review Form.
                  IRO Admin validation and legal routing are unavailable until
                  IRO Staff completes and submits the form.
                </p>
              </div>
            )}

            <div className="card-block">
              <h3>Completeness Check</h3>
              <p>
                Staff:{" "}
                {selectedDocument.review_form?.preparer?.full_name ||
                  selectedDocument.review_form?.preparer?.email ||
                  "Not available"}
              </p>

              {CHECKLIST_ITEMS.map((item) => (
                <label
                  className="checkline"
                  key={item.key}
                >
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    readOnly
                    disabled
                  />

                  <span>{item.label}</span>
                </label>
              ))}
              <label>
                Staff Remarks
                <textarea
                  value={selectedDocument.review_form?.staff_remarks || ""}
                  readOnly
                />
              </label>
            </div>

            <div className="card-block">
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
                    loadingCounsels ||
                    selectedDocument.review_form?.review_form_status !== "validated"
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
                  disabled={submitting}
                />
              </label>
              <label>
                Send-back Reason
                <textarea
                  value={sentBackReason}
                  onChange={(event) => setSentBackReason(event.target.value)}
                  placeholder="Explain what IRO Staff must correct..."
                  disabled={
                    submitting ||
                    selectedDocument.review_form?.review_form_status !== "submitted"
                  }
                />
              </label>
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

              <button
                className="btn primary large wide-inline"
                type="button"
                onClick={handleValidate}
                disabled={
                  submitting ||
                  selectedDocument.review_form?.review_form_status !== "submitted"
                }
              >
                {submitting
                  ? "Processing..."
                  : "Validate Review Form"}
              </button>

              <button
                className="btn outline wide-inline"
                type="button"
                onClick={handleSendBack}
                disabled={
                  submitting ||
                  selectedDocument.review_form?.review_form_status !== "submitted"
                }
              >
                Send Back as Incomplete
              </button>

              <button
                className="btn primary large wide-inline"
                type="button"
                onClick={handleRouteToLegal}
                disabled={
                  submitting ||
                  selectedDocument.review_form?.review_form_status !== "validated" ||
                  !legalCounselId
                }
              >
                Route Validated Form to Legal
              </button>

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

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Review & Validate"
        subtitle="Review submitted IRO Staff forms, validate complete records, and route validated documents to Legal Counsel."
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

      <Panel title="Review Forms Awaiting Admin Action">
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
              No submitted Review Forms match the selected filters.
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
                              : "Review"}
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
