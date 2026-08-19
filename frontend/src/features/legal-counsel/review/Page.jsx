import React from "react";
import { FileText } from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { DocumentFilesPanel } from "../../../components/DocumentFilesPanel";
import { DepartmentalPdfReview } from "../../../components/DepartmentalPdfReview";
import { PdfViewer, getPdfTextSelection } from "../../../components/DocumentReviewPanel";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { SubmissionDetails, SubmissionDetailSection } from "../../../components/SubmissionDetails";
import { DocumentChat } from "../../../components/DocumentChat";
import {
  getReviewDocuments,
  submitLegalDecision,
} from "../../../services/legalCounselServices";
import { createNotification } from "../../../utils/notifications";
import { reportClientError } from "../../../utils/reportClientError";
import {
  getDocumentAnnotations,
  getDocumentFiles,
  createDocumentAnnotation,
  updateDocumentAnnotation,
  removeDocumentAnnotation,
} from "../../../services/documentFileService";
import "./Page.css";

export default function LegalCounselReviewPage() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [legalNotes, setLegalNotes] = React.useState("");
  const [complianceVerified, setComplianceVerified] = React.useState(false);
  const [legalAnnotations, setLegalAnnotations] = React.useState([]);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
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
        if (!current || !loadedDocuments.length) return null;

        return loadedDocuments.find(
          (document) => document.id === current.id,
        ) || null;
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
    setLegalAnnotations([]);
    setSelectedFiles([]);
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

        {!selectedDocument && <Panel title="Routed Documents">
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
        </Panel>}
      </div>

      {selectedDocument && <div className="legal-review-workspace">
      <main className="legal-document-area">
        <button
          type="button"
          className="table-action legal-review-back"
          onClick={() => setSelectedDocument(null)}
        >
          ← Back to Review Queue
        </button>
        <LegalDocumentPreview documentId={selectedDocument.id} onAnnotationsChange={setLegalAnnotations} onFilesChange={setSelectedFiles} />
      </main>

      <SubmissionDetails document={selectedDocument}>
            {false && <div className="legal-review-document-summary">
              <FileText />
              <div><b>{selectedDocument.title}</b><p>{selectedDocument.tracking_number} · {selectedDocument.document_type}</p></div>
            </div>}

            {false && <dl className="legal-review-metadata">
              <LegalDetail label="Tracking Number" value={selectedDocument.tracking_number} />
              <LegalDetail label="Partnership Scope" value={selectedDocument.partnership_scope} />
              <LegalDetail label="Date Submitted" value={formatReviewDate(selectedDocument.submitted_at)} />
              <LegalDetail label="Requesting Department" value={selectedDocument.department?.name || selectedDocument.department?.code} />
              <LegalDetail label="Contact Person" value={selectedDocument.contact_person} />
              <LegalDetail label="Contact Position" value={selectedDocument.contact_position} />
              <LegalDetail label="Contact Email" value={selectedDocument.contact_email || selectedDocument.partner_email} />
              <LegalDetail label="Contact Number" value={selectedDocument.contact_number} />
              <LegalDetail label="Requested Completion" value={formatReviewDate(selectedDocument.requested_completion_date)} />
              <LegalDetail label="Urgency" value={selectedDocument.urgency} />
              <div><dt>Partner Institution</dt><dd>{selectedDocument.partner_institution}</dd></div>
              <div><dt>Agreement Type</dt><dd>{selectedDocument.document_type}</dd></div>
              <div><dt>Status</dt><dd>{selectedDocument.status}</dd></div>
              <div><dt>Date Routed</dt><dd>{selectedDocument.updated_at ? new Date(selectedDocument.updated_at).toLocaleDateString() : "—"}</dd></div>
            </dl>}

            {false && selectedDocument.description && (
              <p>
                <b>Description:</b> {selectedDocument.description}
              </p>
            )}

            {selectedFiles.length > 0 && <section className="legal-review-attachments"><h3>Attached Files</h3>{selectedFiles.map((file) => <p key={file.id}>Version {file.version} · {file.filename}</p>)}</section>}

            {legalAnnotations.length > 0 && (
              <section className="legal-review-annotations">
                <h3>Highlight Compilation</h3>
                {legalAnnotations.map((annotation, index) => (
                  <article key={annotation.id}>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <blockquote>{annotation.highlight}</blockquote>
                    <p>{annotation.comment}</p>
                  </article>
                ))}
              </section>
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
      </SubmissionDetails>
      <DocumentChat documentId={selectedDocument.id} variant="drawer" />
      </div>}
    </section>
  );
}

function LegalDocumentPreview({ documentId, onAnnotationsChange, onFilesChange }) {
  const [files, setFiles] = React.useState([]);
  const [filesLoading, setFilesLoading] = React.useState(true);
  const [fileId, setFileId] = React.useState("");
  const [annotations, setAnnotations] = React.useState([]);
  const [error, setError] = React.useState("");
  const [selection, setSelection] = React.useState(null);
  const [comment, setComment] = React.useState("");
  const [savingAnnotation, setSavingAnnotation] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setFileId(""); setFiles([]); setFilesLoading(true); setAnnotations([]); setSelection(null); onAnnotationsChange([]); onFilesChange([]);
    getDocumentFiles(documentId, { per_page: 100 })
      .then((response) => {
        if (!active) return;
        const loaded = response.files ?? response.data ?? [];
        setFiles(loaded); onFilesChange(loaded);
        setFileId(loaded[0]?.id || "");
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setFilesLoading(false));
    return () => { active = false; };
  }, [documentId, onAnnotationsChange, onFilesChange]);

  React.useEffect(() => {
    let active = true;
    setAnnotations([]); onAnnotationsChange([]);
    if (!fileId) return () => { active = false; };
    getDocumentAnnotations(documentId, fileId)
      .then((response) => {
        if (!active) return;
        const loaded = response.annotations ?? response.data ?? [];
        setAnnotations(loaded); onAnnotationsChange(loaded);
      })
      .catch(() => active && setAnnotations([]));
    return () => { active = false; };
  }, [documentId, fileId, onAnnotationsChange]);

  const selectedFile = files.find((file) => file.id === fileId);
  function captureSelection() {
    const captured = getPdfTextSelection();
    if (captured) setSelection(captured);
  }
  async function saveAnnotation(event) { event.preventDefault(); if (!selection || !comment.trim()) return; setSavingAnnotation(true); setError(""); try { const response = await createDocumentAnnotation(documentId, fileId, { highlight: selection.text, comment: comment.trim(), geometry: selection }); const annotation = response.annotation ?? response.data; setAnnotations((current) => [...current, annotation]); onAnnotationsChange((current) => [...current, annotation]); setSelection(null); setComment(""); window.getSelection()?.removeAllRanges(); } catch (requestError) { setError(requestError.message); } finally { setSavingAnnotation(false); } }
  async function updateAnnotation(annotationId, nextComment) { const response = await updateDocumentAnnotation(documentId, fileId, annotationId, nextComment); const annotation = response.annotation ?? response.data; setAnnotations((current) => current.map((item) => item.id === annotationId ? { ...item, ...annotation } : item)); onAnnotationsChange((current) => current.map((item) => item.id === annotationId ? { ...item, ...annotation } : item)); return annotation; }
  async function removeAnnotation(annotationId) { const previous = annotations; setAnnotations((current) => current.filter((item) => item.id !== annotationId)); onAnnotationsChange((current) => current.filter((item) => item.id !== annotationId)); try { await removeDocumentAnnotation(documentId, fileId, annotationId); } catch (requestError) { setAnnotations(previous); onAnnotationsChange(previous); setError(requestError.message); } }
  if (error) return <Panel title="Document Preview"><p className="auth-error">{error}</p></Panel>;
  if (filesLoading) return <Panel title="Document Preview"><p>Loading document preview...</p></Panel>;
  if (!fileId) return <Panel title="Document Preview"><p>No attached document is available for preview.</p></Panel>;
  if (!selectedFile?.mime_type?.includes("pdf")) return <DocumentFilesPanel documentId={documentId} embeddedPreview previewFileId={fileId} />;
  return <Panel title="Document Preview">
    {files.length > 1 && <label className="legal-review-version">Document Version<select value={fileId} onChange={(event) => setFileId(event.target.value)}>{files.map((file) => <option key={file.id} value={file.id}>Version {file.version} — {file.filename}</option>)}</select></label>}
    <DepartmentalPdfReview documentId={documentId} fileId={fileId} annotations={annotations} canAnnotate onCreateAnnotation={async (payload) => { const response = await createDocumentAnnotation(documentId, fileId, payload); const annotation = response.annotation ?? response.data; setAnnotations((current) => [...current, annotation]); onAnnotationsChange((current) => [...current, annotation]); }} onRemoveAnnotation={removeAnnotation} />
  </Panel>;
}

function LegalDetail({ label, value }) { return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>; }
function formatReviewDate(value) { return value ? new Date(value).toLocaleDateString() : "—"; }
