import React, { useEffect, useMemo, useState } from "react";

import DocumentPreview from "./DocumentPreview";
import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";

import {
  getDocumentById,
  getLegalCounsels,
  getLoggedDocuments,
  routeToLegal,
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

export function ManageSubmissions() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] =
    useState(null);

  const [legalCounsels, setLegalCounsels] = useState([]);
  const [legalCounselId, setLegalCounselId] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [loadingDocument, setLoadingDocument] =
    useState(false);
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

  useEffect(() => {
    loadDocuments();
    loadLegalCounsels();
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
    setLoadingDocument(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const document =
        await getDocumentById(documentId);

      setSelectedDocument(document);
      setChecklist(INITIAL_CHECKLIST);
      setLegalCounselId("");
      setAdminRemarks("");
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
      setLoadingDocument(false);
    }
  }

  function handleBackToQueue() {
    setSelectedDocument(null);
    setChecklist(INITIAL_CHECKLIST);
    setLegalCounselId("");
    setAdminRemarks("");
    setStatusMessage("");
    setErrorMessage("");
  }

  function handleChecklistChange(key) {
    setChecklist((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function handleValidateAndRoute() {
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

    if (!legalCounselId) {
      setStatusMessage(
        "Please select a Legal Counsel before routing."
      );
      return;
    }

    setSubmitting(true);

    try {
      await routeToLegal(
        selectedDocument.id,
        legalCounselId
      );

      setStatusMessage(
        "Document successfully validated and routed to Legal Counsel."
      );

      await loadDocuments();

      window.setTimeout(() => {
        handleBackToQueue();
      }, 1500);
    } catch (error) {
      console.error(
        "Unable to route document to Legal Counsel:",
        error
      );

      setStatusMessage(
        error?.message ||
          "Unable to route the document. Check the Laravel server and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const departments = useMemo(() => {
    const departmentValues = documents
      .map(
        (document) =>
          document.departments?.name ||
          document.department_name ||
          document.department_id
      )
      .filter(Boolean);

    return ["All", ...new Set(departmentValues)];
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return documents.filter((document) => {
      const department =
        document.departments?.name ||
        document.department_name ||
        document.department_id ||
        "";

      const matchesSearch =
        !search ||
        [
          document.tracking_number,
          document.partner_institution,
          document.document_type,
          document.status,
          department,
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

            <div className="card-block">
              <h3>Completeness Check</h3>

              {CHECKLIST_ITEMS.map((item) => (
                <label
                  className="checkline"
                  key={item.key}
                >
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    onChange={() =>
                      handleChecklistChange(item.key)
                    }
                    disabled={submitting}
                  />

                  <span>{item.label}</span>
                </label>
              ))}
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
                    submitting || loadingCounsels
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
                onClick={handleValidateAndRoute}
                disabled={submitting}
              >
                {submitting
                  ? "Routing to Legal..."
                  : "Validate & Route to Legal"}
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
        title="Manage Submissions"
        subtitle="Review logged submissions, validate records, and route approved documents to Legal Counsel."
        action="Refresh Queue"
        onAction={loadDocuments}
      />

      <div className="manage-submission-filters">
        <input
          type="search"
          placeholder="Search tracking number, partner, type, or department..."
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
          <option value="Logged">Logged</option>
          <option value="Under Legal Review">
            Under Legal Review
          </option>
          <option value="Corrections Needed">
            Sent Back
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

      <Panel title="Submission Management Queue">
        {loading && <p>Loading submissions...</p>}

        {loadingDocument && (
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
            <p>No logged submissions found.</p>
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
                      document.departments?.name ||
                      document.department_name ||
                      document.department_id ||
                      "Unknown Department";

                    return (
                      <tr key={document.id}>
                        <td>
                          {document.tracking_number ||
                            "N/A"}
                        </td>

                        <td>{department}</td>

                        <td>
                          {document.partner_institution ||
                            "N/A"}
                        </td>

                        <td>
                          <span className="badge">
                            {document.document_type ||
                              "N/A"}
                          </span>
                        </td>

                        <td>
                          {document.assigned_iro_staff ||
                            "Unassigned"}
                        </td>

                        <td>
                          <span className="badge active">
                            {document.status ||
                              "Unknown"}
                          </span>
                        </td>

                        <td>
                          {document.updated_at
                            ? new Date(
                                document.updated_at
                              ).toLocaleString()
                            : "N/A"}
                        </td>

                        <td>
                          <button
                            className="btn primary small"
                            type="button"
                            disabled={loadingDocument}
                            onClick={() =>
                              handleReview(document.id)
                            }
                          >
                            Review
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