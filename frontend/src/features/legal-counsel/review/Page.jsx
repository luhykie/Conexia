import React from "react";
import { FileText } from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { DocumentFilesPanel } from "../../../components/DocumentFilesPanel";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  getReviewDocuments,
  submitLegalDecision,
} from "../../../services/legalCounselServices";
import { createNotification } from "../../../utils/notifications";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function LegalCounselReviewPage() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [legalNotes, setLegalNotes] = React.useState("");
  const [complianceVerified, setComplianceVerified] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
  const {
    filters,
    queryParams,
    updateFilter,
    clearFilters,
  } = useDocumentFilters();

  function changeFilter(key, value) {
    updateFilter(key, value);
    setPage(1);
  }

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const response = await getReviewDocuments({
        page,
        ...queryParams,
      });
      const loadedDocuments = response.documents ?? response.data ?? [];

      setDocuments(loadedDocuments);
      setMeta(response.meta ?? null);
      setSelectedDocument((current) => {
        if (!loadedDocuments.length) return null;

        return (
          loadedDocuments.find((document) => document.id === current?.id) ||
          loadedDocuments[0]
        );
      });
    } catch (requestError) {
      reportClientError("Unable to load review documents:", requestError);
      setError(requestError.message);
      setDocuments([]);
      setSelectedDocument(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDocuments();
  }, [page, queryParams]);

  React.useEffect(() => {
    setLegalNotes(
      selectedDocument?.status === "Corrections Needed"
        ? selectedDocument?.legal_notes || ""
        : "",
    );
    setComplianceVerified(false);
    setError("");
    setSuccess("");
  }, [selectedDocument]);

  async function submitDecision(newStatus) {
    if (!selectedDocument?.id) {
      setError("Select a document first.");
      return;
    }

    const notes = legalNotes.trim();

    if (newStatus === "Corrections Needed" && !notes) {
      setError("Enter the required corrections before returning the document.");
      return;
    }

    if (newStatus === "Approved" && !complianceVerified) {
      setError("Check Compliance Verified before approving.");
      return;
    }

    const confirmed = window.confirm(
      newStatus === "Approved"
        ? "Approve this document?"
        : "Return this document for corrections?",
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      await submitLegalDecision(selectedDocument.id, {
        status: newStatus,
        legal_notes: notes || null,
      });
    } catch (requestError) {
      reportClientError("Unable to save the Legal decision:", requestError);
      setError(requestError.message);
      setProcessing(false);
      return;
    }

    if (selectedDocument.submitted_by) {
      const notificationResult = await createNotification({
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
        reportClientError("Notification failed:", notificationResult.error);
      }
    }

    setSuccess(
      newStatus === "Approved"
        ? "Document approved successfully."
        : "Document returned for corrections.",
    );
    setLegalNotes("");
    setComplianceVerified(false);

    await loadDocuments();
    setProcessing(false);
  }

  const rows = documents.map((document) => [
    document.tracking_number,
    document.partner_institution,
    document.document_type,
    document.updated_at
      ? new Date(document.updated_at).toLocaleDateString()
      : "-",
    <span
      key={`status-${document.id}`}
      className={`badge ${
        document.status === "Corrections Needed" ? "danger" : "pending"
      }`}
    >
      {document.status}
    </span>,
    <button
      key={`open-${document.id}`}
      type="button"
      className="table-action"
      onClick={() => setSelectedDocument(document)}
    >
      Open
    </button>,
  ]);

  return (
    <section className="page legal-page legal-counsel-review-page">
      <div>
        <PageTitle
          title="Review Queue"
          subtitle="Manage documents explicitly routed for your counsel."
        />

        <Panel title="Routed Documents">
          <DocumentFilters
            filters={filters}
            onChange={changeFilter}
            onClear={() => {
              clearFilters();
              setPage(1);
            }}
            statusOptions={["Under Legal Review", "Corrections Needed"]}
            showDepartment
            unsupported={{
              document_type: true,
              partnership_scope: true,
              date_from: true,
              date_to: true,
              department: true,
            }}
          />
          {loading && <p>Loading routed documents...</p>}
          {error && !selectedDocument && <p className="auth-error">{error}</p>}

          {!loading && !error && documents.length === 0 && (
            <p>No documents are currently assigned to you.</p>
          )}

          {!loading && documents.length > 0 && (
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

      <div className="legal-review-workspace">
      <main className="legal-document-area">
        {!selectedDocument ? (
          <Panel title="Document Preview"><p>Select a routed document to view its attached file.</p></Panel>
        ) : (
          <DocumentFilesPanel documentId={selectedDocument.id} embeddedPreview />
        )}
      </main>

      <aside className="review-sidebar legal-review-details">
        <h2>Submission Details</h2>

        {!selectedDocument ? (
          <p>Select a routed document to begin reviewing.</p>
        ) : (
          <>
            <div className="legal-review-document-summary">
              <FileText />
              <div><b>{selectedDocument.title}</b><p>{selectedDocument.tracking_number} · {selectedDocument.document_type}</p></div>
            </div>

            <dl className="legal-review-metadata">
              <div><dt>Partner Institution</dt><dd>{selectedDocument.partner_institution}</dd></div>
              <div><dt>Agreement Type</dt><dd>{selectedDocument.document_type}</dd></div>
              <div><dt>Status</dt><dd>{selectedDocument.status}</dd></div>
              <div><dt>Date Routed</dt><dd>{selectedDocument.updated_at ? new Date(selectedDocument.updated_at).toLocaleDateString() : "—"}</dd></div>
            </dl>

            {selectedDocument.description && (
              <p>
                <b>Description:</b> {selectedDocument.description}
              </p>
            )}

            <label>
              Liability Assessment and Legal Findings
              <textarea
                value={legalNotes}
                onChange={(event) => setLegalNotes(event.target.value)}
                placeholder="Enter findings, corrections, or approval remarks..."
              />
            </label>

            <label className="checkline">
              <input
                type="checkbox"
                checked={complianceVerified}
                onChange={(event) =>
                  setComplianceVerified(event.target.checked)
                }
              />
              Compliance Verified
            </label>

            {error && <p className="auth-error">{error}</p>}
            {success && <p className="success-message">{success}</p>}

            <footer>
              <button
                type="button"
                className="outline danger"
                disabled={processing}
                onClick={() => submitDecision("Corrections Needed")}
              >
                {processing ? "Saving..." : "Return"}
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() => submitDecision("Approved")}
              >
                {processing ? "Saving..." : "Approve"}
              </button>
            </footer>
          </>
        )}
      </aside>
      </div>
    </section>
  );
}
