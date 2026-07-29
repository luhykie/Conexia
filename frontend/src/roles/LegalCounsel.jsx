import React from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Gavel,
  ShieldCheck,
} from "lucide-react";
import {
  getReviewDocuments,
  submitLegalDecision,
  getNotarizationDocuments,
  submitForNotarization,
  completeNotarization as completeNotarizationRequest,
  getLegalHistory,
} from "../services/legalCounselServices";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import {
  DashboardView,
  ExpiryView,
  FilterBar,
} from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { createNotification } from "../utils/notifications";  
import { NotificationsPage } from "../components/NotificationsPage";
import { DocumentFilesPanel } from "../components/DocumentFilesPanel";
import {
  getExpirySummary,
  requestDocumentRenewal,
} from "../services/workflowSummaryService";
import { reportClientError } from "../utils/reportClientError";

// Routes all Legal Counsel pages through one role-owned component.
export function LegalCounsel({ page }) {
  if (page === "review") {
    return <ReviewQueue />;
  }

  if (page === "notarization") {
    return <NotarizationTracker />;
  }

  if (page === "expiry") {
    return (
      <ExpiryView
        title="Institutional Workspace"
        action="New Submission"
      />
    );
  }

  if (page === "history") {
    return <ActionHistory />;
  }

  if (page === "notifications") {
    return <NotificationsPage />;
  }

  return (
    <DashboardView
      roleKey="legal"
      title="Legal Counsel Dashboard"
      subtitle="Prioritized legal review, approval, return, and notarization workload."
      action="Open Document"
    />
  );
}

// Provides a legal review queue with a side panel for findings and decisions.
function ReviewQueue() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] =
    React.useState(null);

  const [legalNotes, setLegalNotes] =
    React.useState("");

  const [complianceVerified, setComplianceVerified] =
    React.useState(false);

  const [loading, setLoading] =
    React.useState(true);

  const [processing, setProcessing] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [success, setSuccess] =
    React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

async function loadDocuments() {
  setLoading(true);
  setError("");

  try {
    const response =
      await getReviewDocuments({ page });

    const loadedDocuments =
      response.documents ??
      response.data ??
      [];

    setDocuments(loadedDocuments);
    setMeta(response.meta ?? null);

    setSelectedDocument((current) => {
      if (!loadedDocuments.length) {
        return null;
      }

      return (
        loadedDocuments.find(
          (document) =>
            document.id === current?.id
        ) || loadedDocuments[0]
      );
    });
  } catch (requestError) {
    reportClientError(
      "Unable to load review documents:",
      requestError
    );

    setError(requestError.message);
    setDocuments([]);
    setSelectedDocument(null);
  } finally {
    setLoading(false);
  }
}

  React.useEffect(() => {
    loadDocuments();
  }, []);

  React.useEffect(() => {
    setLegalNotes(
      selectedDocument?.status === "Corrections Needed"
        ? selectedDocument?.legal_notes || ""
        : ""
    );

    setComplianceVerified(false);
    setError("");
    setSuccess("");
  }, [selectedDocument]);

  async function submitDecision(newStatus) {
    if (!selectedDocument?.id) {
      setError("Invalid document.");
      return;
    }

    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    const notes = legalNotes.trim();

    if (
      newStatus === "Corrections Needed" &&
      !notes
    ) {
      setError(
        "Enter the required corrections before returning the document."
      );

      return;
    }

    if (
      newStatus === "Approved" &&
      !complianceVerified
    ) {
      setError(
        "Check Compliance Verified before approving."
      );

      return;
    }

    const confirmed = window.confirm(
      newStatus === "Approved"
        ? "Approve this document?"
        : "Return this document for corrections?"
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");
      
      try {
        await submitLegalDecision(
          selectedDocument.id,
          {
            status: newStatus,
            legal_notes: notes || null,
          }
        );
      } catch (requestError) {
        reportClientError(
          "Unable to save the Legal decision:",
          requestError
        );

        setError(requestError.message);
        setProcessing(false);
        return;
      }

    if (selectedDocument.submitted_by) {
      const notificationResult =
        await createNotification({
          userId: selectedDocument.submitted_by,
          documentId: selectedDocument.id,

          title:
            newStatus === "Approved"
              ? "Document Approved"
              : "Corrections Required",

          message:
            newStatus === "Approved"
              ? `${selectedDocument.tracking_number} has been approved by Legal Counsel.`
              : `${selectedDocument.tracking_number} requires corrections. Please review the remarks and resubmit.`,

          type:
            newStatus === "Approved"
              ? "document_approved"
              : "corrections_required",
        });

      if (!notificationResult.success) {
        reportClientError(
          "Notification failed:",
          notificationResult.error
        );
      }
    }

    setSuccess(
      newStatus === "Approved"
        ? "Document approved successfully."
        : "Document returned for corrections."
    );

    setLegalNotes("");
    setComplianceVerified(false);

    await loadDocuments();

    setProcessing(false);
  }

  const rows = documents.map(
    (document) => [
      document.tracking_number,

      document.partner_institution,

      document.document_type,

      document.updated_at
        ? new Date(
            document.updated_at
          ).toLocaleDateString()
        : "-",

      <span
        key={`status-${document.id}`}
        className={`badge ${
          document.status ===
          "Corrections Needed"
            ? "danger"
            : "pending"
        }`}
      >
        {document.status}
      </span>,

      <button
        key={`open-${document.id}`}
        type="button"
        className="table-action"
        onClick={() =>
          setSelectedDocument(document)
        }
      >
        Open
      </button>,
    ]
  );

  return (
    <section className="page split-page legal-page">
      <div>
        <PageTitle
          title="Review Queue"
          subtitle="Manage documents explicitly routed for your counsel."
        />

        <FilterBar
          labels={[
            "All Routed",
            "Under Legal Review",
            "Corrections Needed",
          ]}
        />

        <Panel title="Routed Documents">
          {loading && (
            <p>Loading routed documents...</p>
          )}

          {error && !selectedDocument && (
            <p className="auth-error">
              {error}
            </p>
          )}

          {!loading &&
            !error &&
            documents.length === 0 && (
              <p>
                No documents are currently
                assigned to you.
              </p>
            )}

          {!loading &&
            documents.length > 0 && (
              <DataTable
                headers={[
                  "Tracking #",
                  "Partner",
                  "Document Type",
                  "Route Date",
                  "Status",
                  "Action",
                ]}
                rows={rows}
                meta={meta}
                onPageChange={setPage}
              />
            )}
        </Panel>
      </div>

      <aside className="review-sidebar">
        <h2>Review Sidebar</h2>

        {!selectedDocument ? (
          <p>
            Select a routed document to begin
            reviewing.
          </p>
        ) : (
          <>
            <div className="dropzone">
              <FileText />

              <b>
                {selectedDocument.title}
              </b>

              <p>
                {
                  selectedDocument.tracking_number
                }
                {" · "}
                {
                  selectedDocument.document_type
                }
              </p>
            </div>

            <p>
              <b>Partner:</b>{" "}
              {
                selectedDocument.partner_institution
              }
            </p>

            <p>
              <b>Status:</b>{" "}
              {selectedDocument.status}
            </p>

            {selectedDocument.description && (
              <p>
                <b>Description:</b>{" "}
                {
                  selectedDocument.description
                }
              </p>
            )}

            <DocumentFilesPanel
              documentId={selectedDocument.id}
            />

            <label>
              Liability Assessment and Legal
              Findings

              <textarea
                value={legalNotes}
                onChange={(event) =>
                  setLegalNotes(
                    event.target.value
                  )
                }
                placeholder="Enter findings, corrections, or approval remarks..."
              />
            </label>

            <label className="checkline">
              <input
                type="checkbox"
                checked={complianceVerified}
                onChange={(event) =>
                  setComplianceVerified(
                    event.target.checked
                  )
                }
              />

              Compliance Verified
            </label>

            {error && (
              <p className="auth-error">
                {error}
              </p>
            )}

            {success && (
              <p className="success-message">
                {success}
              </p>
            )}

            <footer>
              <button
                type="button"
                className="outline danger"
                disabled={processing}
                onClick={() =>
                  submitDecision(
                    "Corrections Needed"
                  )
                }
              >
                {processing
                  ? "Saving..."
                  : "Return"}
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() =>
                  submitDecision("Approved")
                }
              >
                {processing
                  ? "Saving..."
                  : "Approve"}
              </button>
            </footer>
          </>
        )}
      </aside>
    </section>
  );
}

// Records and verifies notarization events.
function NotarizationTracker() {
  const [documents, setDocuments] =
    React.useState([]);

  const [
    selectedDocument,
    setSelectedDocument,
  ] = React.useState(null);

  const [
    referenceNumber,
    setReferenceNumber,
  ] = React.useState("");

  const [
    notarizationDate,
    setNotarizationDate,
  ] = React.useState("");

  const [
    signatureCode,
    setSignatureCode,
  ] = React.useState("");

  const [loading, setLoading] =
    React.useState(true);

  const [processing, setProcessing] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [success, setSuccess] =
    React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const response =
        await getNotarizationDocuments({ page });

      const loadedDocuments =
        response.documents ??
        response.data ??
        [];

      setDocuments(loadedDocuments);
      setMeta(response.meta ?? null);

      setSelectedDocument((current) => {
        if (!loadedDocuments.length) {
          return null;
        }

        const currentDocument =
          loadedDocuments.find(
            (document) =>
              document.id === current?.id
          );

        return (
          currentDocument ||
          loadedDocuments[0]
        );
      });
    } catch (requestError) {
      reportClientError(
        "Unable to load notarization documents:",
        requestError
      );

      setError(requestError.message);
      setDocuments([]);
      setSelectedDocument(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDocuments();
  }, []);

  React.useEffect(() => {
    setReferenceNumber(
      selectedDocument
        ?.notarial_reference_number || ""
    );

    setNotarizationDate(
      selectedDocument
        ?.notarization_date || ""
    );

    setSignatureCode(
      selectedDocument
        ?.notary_signature_code || ""
    );

    setError("");
    setSuccess("");
  }, [selectedDocument]);

  function validateNotarizationFields() {
    if (
      !referenceNumber.trim() ||
      !notarizationDate ||
      !signatureCode.trim()
    ) {
      setError(
        "Complete the reference number, notarization date, and signature code."
      );

      return false;
    }

    return true;
  }

  async function submitNotarization() {
    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    if (
      selectedDocument.status !== "Approved"
    ) {
      setError(
        "Only approved documents can be submitted for notarization."
      );

      return;
    }

    if (!validateNotarizationFields()) {
      return;
    }

    const confirmed = window.confirm(
      "Submit this document for notarization?"
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    if (selectedDocument.submitted_by) {
      const notificationResult =
        await createNotification({
          userId: selectedDocument.submitted_by,
          documentId: selectedDocument.id,
          title: "Pending Notarization",
          message: `${selectedDocument.tracking_number} has been submitted for notarization.`,
          type: "pending_notarization",
        });

      if (!notificationResult.success) {
        reportClientError(
          "Notification failed:",
          notificationResult.error
        );
      }
    }

    try {
      await submitForNotarization(
        selectedDocument.id,
        {
          notarial_reference_number:
            referenceNumber.trim(),
          notarization_date:
            notarizationDate,
          notary_signature_code:
            signatureCode.trim(),
        }
      );
    } catch (requestError) {
      reportClientError(
        "Unable to submit document for notarization:",
        requestError
      );

      setError(requestError.message);
      setProcessing(false);
      return;
    }

    setSuccess(
      "Document submitted for notarization successfully."
    );

    await loadDocuments();

    setProcessing(false);
  }

  async function completeNotarization() {
    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    if (
      selectedDocument.status !==
      "Pending Notarization"
    ) {
      setError(
        "Only documents pending notarization can be completed."
      );

      return;
    }

    if (!validateNotarizationFields()) {
      return;
    }

    const confirmed = window.confirm(
      "Mark this document as notarized?"
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    if (selectedDocument.submitted_by) {
      const notificationResult =
        await createNotification({
          userId: selectedDocument.submitted_by,
          documentId: selectedDocument.id,
          title: "Document Notarized",
          message: `${selectedDocument.tracking_number} has been successfully notarized.`,
          type: "document_notarized",
        });

      if (!notificationResult.success) {
        reportClientError(
          "Notification failed:",
          notificationResult.error
        );
      }
    }

    try {
      await completeNotarizationRequest(
        selectedDocument.id,
        {
          notarial_reference_number:
            referenceNumber.trim(),
          notarization_date:
            notarizationDate,
          notary_signature_code:
            signatureCode.trim(),
        }
      );
    } catch (requestError) {
      reportClientError(
        "Unable to complete notarization:",
        requestError
      );

      setError(requestError.message);
      setProcessing(false);
      return;
    }

    setSuccess(
      "Document notarization completed successfully."
    );

    await loadDocuments();

    setProcessing(false);
  }

  const totalQueue = documents.length;

  const pendingCount =
    documents.filter(
      (document) =>
        document.status ===
        "Pending Notarization"
    ).length;

  const completedCount =
    documents.filter(
      (document) =>
        document.status === "Notarized"
    ).length;

  const rows = documents.map(
    (document) => [
      document.tracking_number,

      document.partner_institution,

      <span
        key={`status-${document.id}`}
        className={`badge ${
          document.status === "Notarized"
            ? "active"
            : document.status ===
                "Pending Notarization"
              ? "pending"
              : ""
        }`}
      >
        {document.status}
      </span>,

      document.updated_at
        ? new Date(
            document.updated_at
          ).toLocaleDateString()
        : "-",

      <button
        key={`select-${document.id}`}
        type="button"
        className="table-action"
        onClick={() =>
          setSelectedDocument(document)
        }
      >
        Select
      </button>,
    ]
  );

  const canEdit =
    selectedDocument &&
    [
      "Approved",
      "Pending Notarization",
    ].includes(selectedDocument.status);

  return (
    <section className="page legal-page">
      <PageTitle
        title="Notarization Tracker"
        subtitle="Track approved documents and pending notarization records."
      />

      <StatGrid
        stats={[
          [
            String(totalQueue).padStart(
              2,
              "0"
            ),
            "Total Queue",
            Gavel,
          ],

          [
            String(pendingCount).padStart(
              2,
              "0"
            ),
            "Pending Notarization",
            CalendarClock,
            "",
            "blue",
          ],

          [
            String(
              completedCount
            ).padStart(2, "0"),
            "Completed",
            CheckCircle2,
          ],
        ]}
      />

      <div className="two-col">
        <Panel title="Document Tracking Queue">
          {loading && (
            <p>
              Loading notarization
              documents...
            </p>
          )}

          {error &&
            !selectedDocument && (
              <p className="auth-error">
                {error}
              </p>
            )}

          {!loading &&
            !error &&
            documents.length === 0 && (
              <p>
                No documents are ready for
                notarization.
              </p>
            )}

          {!loading &&
            documents.length > 0 && (
              <DataTable
                headers={[
                  "Document ID",
                  "Entity / Client",
                  "Status",
                  "Last Activity",
                  "Action",
                ]}
                rows={rows}
                meta={meta}
                onPageChange={setPage}
              />
            )}
        </Panel>

        <aside className="form-card">
          <h2>Record Notarization</h2>

          <label>
            Selected Document ID

            <input
              value={
                selectedDocument
                  ?.tracking_number || ""
              }
              readOnly
              placeholder="Select a document"
            />
          </label>

          <label>
            Notarial Reference Number

            <input
              value={referenceNumber}
              disabled={
                processing || !canEdit
              }
              onChange={(event) =>
                setReferenceNumber(
                  event.target.value
                )
              }
              placeholder="Enter reference number"
            />
          </label>

          <label>
            Date of Notarization

            <input
              type="date"
              value={notarizationDate}
              disabled={
                processing || !canEdit
              }
              onChange={(event) =>
                setNotarizationDate(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Notary Public Signature Code

            <input
              value={signatureCode}
              disabled={
                processing || !canEdit
              }
              onChange={(event) =>
                setSignatureCode(
                  event.target.value
                )
              }
              placeholder="Enter signature code"
            />
          </label>

          {selectedDocument && (
            <p>
              <b>Status:</b>{" "}
              {selectedDocument.status}
            </p>
          )}

          {selectedDocument?.status ===
            "Notarized" && (
            <div className="notice">
              <b>
                Notarization Completed
              </b>

              <p>
                Reference Number:{" "}
                {selectedDocument
                  .notarial_reference_number ||
                  "-"}
              </p>

              <p>
                Notarization Date:{" "}
                {selectedDocument
                  .notarization_date || "-"}
              </p>

              <p>
                Signature Code:{" "}
                {selectedDocument
                  .notary_signature_code || "-"}
              </p>
            </div>
          )}

          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}

          {success && (
            <p className="success-message">
              {success}
            </p>
          )}

          {selectedDocument?.status ===
            "Approved" && (
            <button
              type="button"
              disabled={processing}
              onClick={submitNotarization}
            >
              {processing
                ? "Submitting..."
                : "Submit for Notarization"}
            </button>
          )}

          {selectedDocument?.status ===
            "Pending Notarization" && (
            <button
              type="button"
              disabled={processing}
              onClick={
                completeNotarization
              }
            >
              {processing
                ? "Completing..."
                : "Complete Notarization"}
            </button>
          )}

          {selectedDocument?.status ===
            "Notarized" && (
            <button
              type="button"
              disabled
            >
              Notarization Completed
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}

// Lists the legal team's review and notarization history.
function ActionHistory() {
  const [historyItems, setHistoryItems] =
    React.useState([]);

  const [loading, setLoading] =
    React.useState(true);

  const [error, setError] =
    React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  const [expiryItems, setExpiryItems] =
    React.useState([]);

  const [expiryError, setExpiryError] =
    React.useState("");

  const [expiryProcessingId, setExpiryProcessingId] =
    React.useState(null);

  React.useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response =
          await getLegalHistory({ page });

        const loadedHistory =
          response.history ??
          response.data ??
          response.items ??
          [];

        setHistoryItems(loadedHistory);
        setMeta(response.meta ?? null);
      } catch (requestError) {
        reportClientError(
          "Unable to load legal action history:",
          requestError
        );

        setError(requestError.message);
        setHistoryItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [page]);

  React.useEffect(() => {
    async function loadExpiry() {
      setExpiryError("");

      try {
        const response = await getExpirySummary();

        setExpiryItems(
          response.data?.records ??
            response.data?.upcoming ??
            []
        );
      } catch (requestError) {
        reportClientError(
          "Unable to load legal expiry records:",
          requestError
        );

        setExpiryError(requestError.message);
        setExpiryItems([]);
      }
    }

    loadExpiry();
  }, [page]);

  async function requestRenewal(record) {
    if (!record?.id) return;

    setExpiryProcessingId(record.id);
    setExpiryError("");

    try {
      await requestDocumentRenewal(record.id);
      const response = await getExpirySummary();

      setExpiryItems(
        response.data?.records ??
          response.data?.upcoming ??
          []
      );
    } catch (requestError) {
      reportClientError(
        "Unable to flag document for renewal:",
        requestError
      );

      setExpiryError(requestError.message);
    } finally {
      setExpiryProcessingId(null);
    }
  }

  return (
    <section className="page legal-page">
      <PageTitle
        title="Legal Action History"
        subtitle="Audit Log & Activity"
        action="Download Report"
      />

      <FilterBar
        labels={[
          "All Entities",
          "Date Range",
          "Any Status",
        ]}
      />

      <div className="two-col">
        <Panel title="Audit Log & Activity">
          {loading && (
            <p>Loading legal action history...</p>
          )}

          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}

          {!loading &&
            !error &&
            historyItems.length === 0 && (
              <p>No legal actions recorded yet.</p>
            )}

          {!loading &&
            !error &&
            historyItems.map(
              (item, index) => {
                const title =
                  Array.isArray(item)
                    ? item[0]
                    : item.title ||
                      item.action ||
                      item.status ||
                      "Legal action";

                const detail =
                  Array.isArray(item)
                    ? item[1]
                    : item.detail ||
                      item.description ||
                      item.message ||
                      item.legal_notes ||
                      "";

                const status =
                  Array.isArray(item)
                    ? item[2]
                    : item.badge ||
                      item.status ||
                      item.type ||
                      "Recorded";

                const isDanger =
                  status === "Correction" ||
                  status ===
                    "Corrections Needed" ||
                  status === "Rejected";

                return (
              <div
                className={`timeline-item ${
                  isDanger
                    ? "danger"
                    : ""
                }`}
                key={`${title}-${index}`}
              >
                <b>{title}</b>

                <p>{detail}</p>

                <span
                  className={`badge ${
                    isDanger
                      ? "danger"
                      : ""
                  }`}
                >
                  {status}
                </span>
              </div>
                );
              }
            )}
          {!loading &&
            !error &&
            historyItems.length > 0 &&
            meta && (
              <div className="table">
                <footer>
                  Showing {meta.from || 0}-{meta.to || 0} of {meta.total} records
                  <div>
                    <button
                      disabled={meta.current_page <= 1}
                      onClick={() => setPage(meta.current_page - 1)}
                    >
                      &lt;
                    </button>
                    <button className="active-page">
                      {meta.current_page}
                    </button>
                    <button
                      disabled={meta.current_page >= meta.last_page}
                      onClick={() => setPage(meta.current_page + 1)}
                    >
                      &gt;
                    </button>
                  </div>
                </footer>
              </div>
            )}
        </Panel>

        <Panel title="Expiring Soon">
          {expiryError && (
            <p className="auth-error">
              {expiryError}
            </p>
          )}

          {!expiryError &&
            expiryItems.length === 0 && (
              <p>No assigned documents are expiring soon.</p>
            )}

          {!expiryError &&
            expiryItems.map((record) => (
              <div
                className={`notice ${
                  record.classification === "expired"
                    ? "danger"
                    : "warn"
                }`}
                key={record.id}
              >
                <b>
                  {record.partner_institution ||
                    record.document_name ||
                    record.tracking_number}
                </b>

                <p>
                  {record.expiry} -{" "}
                  {record.tracking_number}
                </p>

                <button
                  className={
                    record.classification === "expired"
                      ? "primary"
                      : "outline"
                  }
                  disabled={
                    expiryProcessingId === record.id ||
                    record.renewal_status ===
                      "renewal_requested"
                  }
                  onClick={() =>
                    requestRenewal(record)
                  }
                >
                  {expiryProcessingId === record.id
                    ? "Flagging..."
                    : record.renewal_status ===
                        "renewal_requested"
                      ? "Renewal Flagged"
                      : "Flag for Renewal"}
                </button>
              </div>
            ))}

          <section className="dark-card">
            <ShieldCheck />

            <div>
              <h2>
                Compliance Status
              </h2>

              <p>
                {expiryItems.length} assigned
                agreement
                {expiryItems.length === 1
                  ? ""
                  : "s"} require renewal
                attention.
              </p>
            </div>
          </section>
        </Panel>
      </div>
    </section>
  );
}
