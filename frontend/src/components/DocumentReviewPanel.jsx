import React from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, History, MessageSquareText, RotateCcw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";
import { DocumentChat } from "./DocumentChat";
import { DepartmentalPdfReview } from "./DepartmentalPdfReview";
import {
  getActiveLegalCounselUsers,
  getIroDocumentHistory,
  returnAdminReviewForRevision,
  validateAdminReview,
} from "../services/iroAdminService";
import { getIroDocument } from "../services/iroDocumentService";
import {
  createDocumentAnnotation,
  getDocumentAnnotations,
  getDocumentFiles,
  getDocumentPreviewBlob,
  removeDocumentAnnotation,
  updateDocumentAnnotation,
} from "../services/documentFileService";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function DepartmentalDocumentHistory({ documentId, loadHistory, onViewVersion, onCloseVersion, viewingVersion, Section = SubmissionDetailSection }) {
  const [open, setOpen] = React.useState(false);
  const [original, setOriginal] = React.useState(null);
  const [versions, setVersions] = React.useState([]);
  const [approvedDocument, setApprovedDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setOpen(false); setOriginal(null); setVersions([]); setApprovedDocument(null); setError("");
  }, [documentId]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true); setError("");
    try {
      const response = await loadHistory(documentId);
      setOriginal(response.original ?? null);
      setVersions(response.versions ?? []);
      setApprovedDocument(response.approved_document ?? null);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  const chronologicalVersions = [...versions]
    .sort((left, right) => {
      const leftTime = Date.parse(left.file.created_at || "");
      const rightTime = Date.parse(right.file.created_at || "");
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
      return Number(left.file.version) - Number(right.file.version);
    });

  return <Section title="Document History"><div className="department-history">
    <button type="button" className="outline department-history__trigger" onClick={toggle}><History size={16} /> {open ? "Hide History" : "History"}</button>
    {viewingVersion && <button type="button" className="table-action" onClick={onCloseVersion}>Return to current version</button>}
    {open && <div className="department-history__events">
      {loading && <p>Loading history...</p>}
      {error && <p className="auth-error">{error}</p>}
      <div className="department-history__group"><b>Documents &amp; Revisions</b>
        {chronologicalVersions.map((version) => {
          const isOriginal = version.file.id === original?.file?.id;
          const isApproved = version.file.id === approvedDocument?.file?.id;
          const selectedVersion = isApproved ? { ...version, ...approvedDocument } : isOriginal ? { ...version, ...original } : version;
          const labels = [isOriginal ? "Original Document" : `Revision - Version ${version.file.version}`];
          if (isApproved) labels.push("Approved");
          if (version.latest) labels.push("Latest");
          const details = [version.file.filename, version.status || null];
          if (version.annotations?.length) details.push(`${version.annotations.length} saved annotation${version.annotations.length === 1 ? "" : "s"}`);
          if (version.file.created_at) details.push(new Date(version.file.created_at).toLocaleString());
          return <HistoryVersionRow key={`version-${version.file.id}`} version={selectedVersion} label={labels.join(" - ")} detail={details.filter(Boolean).join(" - ")} action="View Document" onViewVersion={onViewVersion} />;
        })}
        {!chronologicalVersions.length && !loading && !error && <p>No document versions found.</p>}
      </div>
    </div>}
  </div></Section>;
}

export function DepartmentalVersionAnnotations({ version, Section = SubmissionDetailSection, showHighlightNumbers = false, canManage = false, onUpdateComment, onRequestRemove }) {
  const [editingId, setEditingId] = React.useState("");
  const [draftComment, setDraftComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  if (!version) return null;

  async function saveComment(event, item) {
    event.preventDefault();
    const nextComment = draftComment.trim();
    if (!nextComment || saving) return;
    setSaving(true);
    setError("");
    try {
      await onUpdateComment(item.id, nextComment);
      setEditingId("");
      setDraftComment("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <Section title={`${version.label} Annotations`}><div className="department-history__annotations">
    <p><b>{version.status}</b>{version.approved_at ? ` · Approved ${new Date(version.approved_at).toLocaleString()}` : ""}</p>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {!version.annotations?.length && <p>No saved annotations for this version.</p>}
    {(version.annotations ?? []).map((item) => <article key={item.id}>
      <small>{showHighlightNumbers && <b className="departmental-review__marker">Highlight #{item.display_number}</b>}{item.department || annotationRoleLabel(item.actor_role) || "Department"} · {item.author || "Staff"}</small>
      {(item.selected_text || item.highlight) && <blockquote>{item.selected_text || item.highlight}</blockquote>}
      {editingId === item.id ? <form className="iro-admin-annotation-edit" onSubmit={(event) => saveComment(event, item)}>
        <label htmlFor={`annotation-comment-${item.id}`}>Edit Comment</label>
        <textarea id={`annotation-comment-${item.id}`} value={draftComment} onChange={(event) => setDraftComment(event.target.value)} maxLength={2000} rows={3} required autoFocus disabled={saving} />
        <div>
          <button type="button" className="outline" disabled={saving} onClick={() => { setEditingId(""); setDraftComment(""); setError(""); }}>Cancel</button>
          <button type="submit" disabled={saving || !draftComment.trim()}>{saving ? "Saving..." : "Save Comment"}</button>
        </div>
      </form> : <>
        {item.comment && <p>{item.comment}</p>}
        {canManage && item.can_manage !== false && <div className="iro-admin-annotation-actions">
          <button type="button" className="outline" onClick={() => { setEditingId(item.id); setDraftComment(item.comment || ""); setError(""); }}>Edit Comment</button>
          <button type="button" className="pdf-annotation-remove" onClick={() => onRequestRemove(item.id)}>Remove Highlight</button>
        </div>}
      </>}
    </article>)}
  </div></Section>;
}

function HistoryVersionRow({ version, label, detail, action, onViewVersion }) {
  return <article className="department-history__version"><div><b>{label}</b><small>{detail || version.file.filename}</small></div><button type="button" className="table-action" onClick={() => onViewVersion(version)}>{action}</button></article>;
}

function annotationRoleLabel(role) {
  return role ? String(role).split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : "";
}

function numberAnnotations(annotations) {
  const used = new Set();
  let next = 1;

  return [...annotations]
    .sort((left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0))
    .map((annotation) => {
      const preferred = Number(annotation.display_number);
      let displayNumber = Number.isInteger(preferred) && preferred > 0 && !used.has(preferred)
        ? preferred
        : next;
      while (used.has(displayNumber)) displayNumber += 1;
      used.add(displayNumber);
      while (used.has(next)) next += 1;
      return { ...annotation, display_number: displayNumber };
    });
}

export function DocumentReviewPage({ documentId }) {
  const navigate = useNavigate();
  const [document, setDocument] = React.useState(null);
  const [files, setFiles] = React.useState([]);
  const [fileId, setFileId] = React.useState("");
  const [previewUrl, setPreviewUrl] = React.useState("");
  const [annotations, setAnnotations] = React.useState([]);
  const [selection, setSelection] = React.useState(null);
  const [comment, setComment] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [decisionComments, setDecisionComments] = React.useState("");
  const [legalCounsel, setLegalCounsel] = React.useState([]);
  const [legalCounselId, setLegalCounselId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [confirmation, setConfirmation] = React.useState(null);
  const [expandedAction, setExpandedAction] = React.useState(null);
  const [historyVersion, setHistoryVersion] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      getIroDocument(documentId),
      getDocumentFiles(documentId, { per_page: 100 }),
      getActiveLegalCounselUsers(),
    ]).then(([documentResponse, filesResponse, counselResponse]) => {
      if (!active) return;
      const loadedDocument = documentResponse.document ?? documentResponse.data;
      const loadedFiles = filesResponse.files ?? filesResponse.data?.items ?? filesResponse.data ?? [];
      const users = counselResponse.users ?? counselResponse.data ?? [];
      const latestFile = [...loadedFiles].sort(
        (left, right) => Number(right.version) - Number(left.version),
      )[0];
      setDocument(loadedDocument);
      setFiles(loadedFiles);
      setFileId(latestFile?.id || "");
      setLegalCounsel(users);
      setLegalCounselId(users[0]?.id || "");
    }).catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [documentId]);

  React.useEffect(() => {
    let active = true;
    let objectUrl = "";
    setPreviewUrl("");
    setAnnotations([]);
    setSelection(null);
    if (!fileId) return () => { active = false; };
    const requestedFile = files.find((file) => file.id === fileId);
    const previewRequest = requestedFile?.mime_type === "application/pdf"
      ? Promise.resolve(null)
      : getDocumentPreviewBlob(documentId, fileId);
    Promise.all([
      previewRequest,
      getDocumentAnnotations(documentId, fileId),
    ]).then(([blob, response]) => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        if (!active) return URL.revokeObjectURL(objectUrl);
        setPreviewUrl(objectUrl);
      }
      setAnnotations(response.annotations ?? response.data ?? []);
    }).catch((requestError) => active && setError(requestError.message));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, fileId, files]);

  function captureSelection() {
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.isCollapsed || !browserSelection.rangeCount) return;
    const range = browserSelection.getRangeAt(0);
    const page = closestPdfPage(range.startContainer);
    if (!page || !page.contains(range.endContainer)) return;
    const bounds = page.getBoundingClientRect();
    const rects = normalizeSelectionRects([...range.getClientRects()], bounds);
    if (rects.length) setSelection({ text: browserSelection.toString().trim(), page: Number(page.dataset.page), rects });
  }

  async function saveAnnotation(event) {
    event.preventDefault();
    if (!selection?.text || !comment.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await createDocumentAnnotation(documentId, fileId, {
        highlight: selection.text,
        comment: comment.trim(),
        geometry: { page: selection.page, rects: selection.rects },
      });
      setAnnotations((current) => [...current, response.annotation ?? response.data]);
      setSelection(null);
      setComment("");
      window.getSelection()?.removeAllRanges();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function updateAnnotationComment(annotationId, nextComment) {
    setError("");
    try {
      const response = await updateDocumentAnnotation(documentId, fileId, annotationId, nextComment);
      const updated = response.annotation ?? response.data;
      setAnnotations((current) => current.map((annotation) =>
        annotation.id === annotationId
          ? { ...annotation, comment: updated.comment, updated_at: updated.updated_at }
          : annotation
      ));
      return updated;
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    }
  }

  async function removeAnnotation(annotationId) {
    setError("");
    try {
      await removeDocumentAnnotation(documentId, fileId, annotationId);
      setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    }
  }

  function returnForRevision() {
    if (!reason.trim()) return;
    setConfirmation({ type: "return" });
  }

  function validateAndRoute() {
    if (!legalCounselId) return;
    setConfirmation({ type: "validate" });
  }

  function requestAnnotationRemoval(annotationId) {
    setConfirmation({ type: "remove-annotation", annotationId });
  }

  async function confirmAction() {
    const pending = confirmation;
    if (!pending) return;
    setConfirmation(null);

    if (pending.type === "remove-annotation") {
      try {
        await removeAnnotation(pending.annotationId);
      } catch {
        // The request handler has already exposed the API error in the page.
      }
      return;
    }

    setBusy(true);
    try {
      if (pending.type === "return") {
        await returnAdminReviewForRevision(documentId, reason.trim());
      } else {
        await validateAdminReview(documentId, legalCounselId, decisionComments.trim());
      }
      navigate("/app/log-review", { replace: true });
    } catch (requestError) { setError(requestError.message); setBusy(false); }
  }

  const selectedFile = files.find((file) => file.id === fileId);
  const actionable = document?.status === "Logged";
  const numberedAnnotations = React.useMemo(() => numberAnnotations(annotations), [annotations]);
  const viewingOriginal = historyVersion?.history_view === "original";
  const visibleAnnotations = viewingOriginal ? [] : numberedAnnotations;
  const canAnnotateSelectedVersion = actionable && !viewingOriginal;
  const latestFile = [...files].sort(
    (left, right) => Number(right.version) - Number(left.version),
  )[0];

  const loadDepartmentalHistory = React.useCallback(async () => {
    const authoritativeHistory = await getIroDocumentHistory(documentId);
    const orderedFiles = [...files].sort(
      (left, right) => Number(left.version) - Number(right.version),
    );
    const versions = await Promise.all(orderedFiles.map(async (file) => {
      const response = await getDocumentAnnotations(documentId, file.id);
      const versionAnnotations = response.annotations ?? response.data ?? [];
      return {
        file,
        label: `Version ${file.version} — ${file.version === 1 ? "Original Submission" : "Revised Submission"}`,
        status: file.id === latestFile?.id ? document?.status : "Previous Version",
        latest: file.id === latestFile?.id,
        annotations: versionAnnotations,
      };
    }));
    const highlightedVersions = versions
      .filter((version) => version.annotations.length > 0)
      .map((version) => ({ ...version, history_view: "highlighted" }));
    const versionsByFileId = new Map(versions.map((version) => [version.file.id, version]));
    const originalVersion = authoritativeHistory.original?.file?.id
      ? versionsByFileId.get(authoritativeHistory.original.file.id)
      : null;
    const approvedVersion = authoritativeHistory.approved_document?.file?.id
      ? versionsByFileId.get(authoritativeHistory.approved_document.file.id)
      : null;
    const approvedDocument = approvedVersion
      ? {
          ...approvedVersion,
          status: "Approved",
          approved_at: authoritativeHistory.approved_document.approved_at,
          history_view: "approved",
        }
      : null;

    return {
      versions,
      original: originalVersion
        ? { ...originalVersion, annotations: [], history_view: "original" }
        : null,
      highlighted_versions: highlightedVersions,
      approved_document: approvedDocument,
    };
  }, [document?.partner_department_id, document?.status, documentId, files, latestFile?.id]);

  function viewHistoryVersion(version) {
    setSelection(null);
    if (fileId !== version.file.id) setAnnotations([]);
    setHistoryVersion(version);
    setFileId(version.file.id);
  }

  function closeHistoryVersion() {
    setSelection(null);
    if (fileId !== latestFile?.id) setAnnotations([]);
    setHistoryVersion(null);
    setFileId(latestFile?.id || "");
  }

  return (
    <section className="page iro-admin-document-review-page">
      <button type="button" className="outline back-button" onClick={() => navigate("/app/log-review")}><ArrowLeft size={16} /> Back to Log & Review</button>
      <PageTitle title={document?.tracking_number ? `Review ${document.tracking_number}` : "Document Review"} subtitle="Select text in the routed document to highlight it and attach a comment." />
      {loading && <p>Loading routed document...</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!loading && document && (
        <div className="department-submission-review__workspace iro-admin-review-workspace">
          <main className="department-submission-review__document iro-admin-review-content">
          {fileId ? <Panel title="Routed Document">
            <p className="document-version-label">
              {viewingOriginal
                ? `${selectedFile?.filename} · Original Document · Read-only`
                : `${selectedFile?.filename} · Version ${selectedFile?.version} · Read-only`}
            </p>
            {selectedFile?.mime_type === "application/pdf"
              ? <DepartmentalPdfReview
                  documentId={documentId}
                  fileId={fileId}
                  annotations={visibleAnnotations}
                  canAnnotate={canAnnotateSelectedVersion}
                  onCreateAnnotation={async (payload) => {
                    setBusy(true);
                    setError("");
                    try {
                      const response = await createDocumentAnnotation(documentId, fileId, payload);
                      const annotation = response.annotation ?? response.data;
                      setAnnotations((current) => [...current, annotation]);
                      return annotation;
                    } catch (requestError) {
                      setError(requestError.message);
                      throw requestError;
                    } finally {
                      setBusy(false);
                    }
                  }}
                  onRemoveAnnotation={removeAnnotation}
                />
              : previewUrl && <iframe className="fallback-document-viewer" src={previewUrl} title={selectedFile?.filename || "Routed document"} />}
          </Panel> : <Panel title="Routed Document"><p>No routed document file is available.</p></Panel>}

          {fileId && selection && canAnnotateSelectedVersion && (
            <form className="selection-comment" onSubmit={saveAnnotation}>
              <MessageSquareText size={18} />
              <blockquote>“{selection.text}”</blockquote>
              <textarea aria-label="Comment on selected text" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment to this highlight" rows={3} maxLength={2000} required autoFocus />
              <div><button type="button" className="outline" onClick={() => setSelection(null)}>Cancel</button><button type="submit" disabled={busy || !comment.trim()}>Save highlight & comment</button></div>
            </form>
          )}

          </main>
          <aside className="department-submission-review__details iro-admin-review-details">
            <h2>Submission Details</h2>
            <SubmissionDetailSection title="Submission Information">
              <SubmissionDetail label="Tracking Number" value={document.tracking_number} />
              <SubmissionDetail label="Status" value={document.status} />
              <SubmissionDetail label="Submitted Date" value={formatDocumentDate(document.submitted_at)} />
            </SubmissionDetailSection>
            <SubmissionDetailSection title="Requesting Office">
              <SubmissionDetail label="Department" value={departmentName(document)} />
              <SubmissionDetail label="Submitted By" value={submitterName(document)} />
            </SubmissionDetailSection>
            <SubmissionDetailSection title="Agreement Details">
              <SubmissionDetail label="Document Type" value={document.document_type} />
              <SubmissionDetail label="Title of Agreement" value={document.title} />
              <SubmissionDetail label="Partner Organization" value={document.partner_institution} />
              <SubmissionDetail label="Partner Contact Email" value={document.partner_email} />
              <SubmissionDetail label="Partnership Type" value={document.partnership_type} />
              <SubmissionDetail label="Partnership Scope" value={document.partnership_scope} />
            </SubmissionDetailSection>
            {document.description && <SubmissionDetailSection title="Submitted Form Information"><p className="department-submission-review__description">{document.description}</p></SubmissionDetailSection>}
            <DepartmentalDocumentHistory documentId={documentId} loadHistory={loadDepartmentalHistory} onViewVersion={viewHistoryVersion} onCloseVersion={closeHistoryVersion} viewingVersion={Boolean(historyVersion)} Section={SubmissionDetailSection} />
            {historyVersion && <DepartmentalVersionAnnotations version={{ ...historyVersion, annotations: visibleAnnotations }} Section={SubmissionDetailSection} showHighlightNumbers canManage={canAnnotateSelectedVersion} onUpdateComment={updateAnnotationComment} onRequestRemove={requestAnnotationRemoval} />}
          {fileId && actionable && <section className="review-actions" aria-label="IRO Admin review decisions">
            <div className={`review-action-card return-action${expandedAction === "return" ? " is-expanded" : ""}`}>
              <button type="button" className="review-action-toggle" aria-expanded={expandedAction === "return"} onClick={() => setExpandedAction((current) => current === "return" ? null : "return")}>
                <RotateCcw size={18} /> Return for Revision
              </button>
              {expandedAction === "return" && <div className="review-action-fields">
                <label>Required reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={2000} /></label>
                <button type="button" onClick={returnForRevision} disabled={busy || !reason.trim()}>Return for Revision</button>
              </div>}
            </div>
            <div className={`review-action-card validate-action${expandedAction === "validate" ? " is-expanded" : ""}`}>
              <button type="button" className="review-action-toggle" aria-expanded={expandedAction === "validate"} onClick={() => setExpandedAction((current) => current === "validate" ? null : "validate")}>
                <CheckCircle2 size={18} /> Validate & Route to Legal
              </button>
              {expandedAction === "validate" && <div className="review-action-fields">
                <label>Legal Counsel<select value={legalCounselId} onChange={(event) => setLegalCounselId(event.target.value)} required><option value="">Select Legal Counsel</option>{legalCounsel.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}</select></label>
                <label>Review comments (optional)<textarea value={decisionComments} onChange={(event) => setDecisionComments(event.target.value)} rows={2} maxLength={2000} /></label>
                <button type="button" onClick={validateAndRoute} disabled={busy || !legalCounselId}>Validate & Route to Legal</button>
              </div>}
            </div>
          </section>}
          {fileId && !actionable && <p className="review-complete-notice">This review is read-only because the document has already moved to <b>{document.status}</b>. Saved annotations remain visible.</p>}
          </aside>
        </div>
      )}
      {confirmation && (
        <ConexiaConfirmationModal
          confirmation={confirmation}
          legalCounselName={legalCounsel.find((user) => user.id === legalCounselId)?.full_name}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmAction}
        />
      )}
      <DocumentChat documentId={documentId} variant="drawer" />
    </section>
  );
}

function SubmissionDetailSection({ title, children }) {
  return <section className="department-submission-review__section"><h3>{title}</h3><div>{children}</div></section>;
}

function SubmissionDetail({ label, value }) {
  return <p><span>{label}</span><b>{value || "—"}</b></p>;
}

function departmentName(document) {
  const department = document.department;
  if (!department) return "PAIR/IRO";
  return department.code && department.name
    ? `${department.code} - ${department.name}`
    : department.code || department.name || "PAIR/IRO";
}

function submitterName(document) {
  return document.created_by?.full_name || document.created_by?.email || "—";
}

function formatDocumentDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function ConexiaConfirmationModal({ confirmation, legalCounselName, onCancel, onConfirm }) {
  const confirmButtonRef = React.useRef(null);
  const content = confirmationContent(confirmation.type, legalCounselName);

  React.useEffect(() => {
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="conexia-confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className={`conexia-confirm-modal conexia-confirm-modal--${content.tone}`} role="alertdialog" aria-modal="true" aria-labelledby="conexia-confirm-title" aria-describedby="conexia-confirm-description">
        <button type="button" className="conexia-confirm-close" aria-label="Close confirmation" onClick={onCancel}><X size={18} /></button>
        <div className="conexia-confirm-icon" aria-hidden="true">{content.tone === "validate" ? <CheckCircle2 size={25} /> : <AlertTriangle size={25} />}</div>
        <span className="conexia-confirm-brand">CONEXIA</span>
        <h2 id="conexia-confirm-title">{content.title}</h2>
        <p id="conexia-confirm-description">{content.description}</p>
        <div className="conexia-confirm-actions">
          <button type="button" className="outline" onClick={onCancel}>Cancel</button>
          <button type="button" ref={confirmButtonRef} className={content.tone === "validate" ? "conexia-confirm-primary" : "conexia-confirm-danger"} onClick={onConfirm}>{content.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function confirmationContent(type, legalCounselName) {
  if (type === "return") return {
    title: "Return for Revision?",
    description: "This document will be returned to the originating office for revision. All saved highlights and comments will be preserved as part of the review history.",
    confirmLabel: "Return for Revision",
    tone: "danger",
  };
  if (type === "validate") return {
    title: "Validate & Route to Legal?",
    description: `This review will be marked as validated and the document will be routed to ${legalCounselName || "the selected Legal Counsel"}.`,
    confirmLabel: "Validate & Route",
    tone: "validate",
  };
  return {
    title: "Remove Annotation?",
    description: "This highlight and its attached comment will be removed from the active review. The action will remain recorded in the audit history.",
    confirmLabel: "Remove Annotation",
    tone: "danger",
  };
}

export function PdfViewer({
  url,
  annotations,
  onSelection,
  canManageAnnotations,
  showInlineComments = true,
  onUpdateAnnotation,
  onRequestRemoveAnnotation,
}) {
  const containerRef = React.useRef(null);
  const openAnnotationIdRef = React.useRef(null);
  const [renderError, setRenderError] = React.useState("");
  const [renderVersion, setRenderVersion] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    container.replaceChildren();
    (async () => {
      const pdf = await pdfjsLib.getDocument(url).promise;
      for (let number = 1; number <= pdf.numPages && !cancelled; number += 1) {
        const page = await pdf.getPage(number);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.6, Math.max(1, (container.clientWidth - 40) / baseViewport.width));
        const viewport = page.getViewport({ scale });
        const pageElement = document.createElement("div");
        const userUnit = viewport.userUnit || 1;
        pageElement.className = "pdf-page";
        pageElement.dataset.page = String(number);
        pageElement.style.width = `${viewport.width}px`;
        pageElement.style.height = `${viewport.height}px`;
        pageElement.style.setProperty("--scale-factor", String(viewport.scale));
        pageElement.style.setProperty("--user-unit", String(userUnit));
        pageElement.style.setProperty("--total-scale-factor", String(viewport.scale * userUnit));
        const canvas = document.createElement("canvas");
        const outputScale = new pdfjsLib.OutputScale();
        canvas.width = Math.floor(viewport.width * outputScale.sx);
        canvas.height = Math.floor(viewport.height * outputScale.sy);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        pageElement.append(canvas);
        const textLayer = document.createElement("div");
        textLayer.className = "textLayer";
        pageElement.append(textLayer);
        const highlightLayer = document.createElement("div");
        highlightLayer.className = "pdf-highlight-layer";
        pageElement.append(highlightLayer);
        container.append(pageElement);
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          transform: outputScale.scaled ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0] : null,
        }).promise;
        await new pdfjsLib.TextLayer({ textContentSource: await page.getTextContent(), container: textLayer, viewport }).render();
      }
      if (!cancelled) setRenderVersion((value) => value + 1);
    })().catch(() => !cancelled && setRenderError("This PDF could not be rendered for text selection."));
    return () => { cancelled = true; };
  }, [url]);

  React.useEffect(() => {
    const container = containerRef.current;
    const closePopups = () => {
      openAnnotationIdRef.current = null;
      container.querySelectorAll(".pdf-annotation-popup").forEach((popup) => {
        popup.hidden = true;
      });
      container.querySelectorAll(".saved-text-highlight, .pdf-comment-icon").forEach((control) => {
        control.setAttribute("aria-expanded", "false");
      });
    };
    const handleDocumentClick = (event) => {
      if (!container.contains(event.target) || !event.target.closest?.(".pdf-annotation-group")) closePopups();
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") closePopups();
    };

    container.querySelectorAll(".pdf-highlight-layer").forEach((layer) => layer.replaceChildren());
    annotations.forEach((annotation) => {
      const layer = container.querySelector(`.pdf-page[data-page="${annotation.geometry?.page}"] .pdf-highlight-layer`);
      const rects = annotation.geometry?.rects ?? [];
      if (!layer || rects.length === 0) return;

      const group = document.createElement("div");
      group.className = "pdf-annotation-group";
      group.dataset.annotationId = annotation.id;
      layer.append(group);

      const popupId = `pdf-annotation-${annotation.id}`;
      const popup = document.createElement("aside");
      popup.id = popupId;
      popup.className = "pdf-annotation-popup";
      popup.hidden = openAnnotationIdRef.current !== annotation.id;
      popup.setAttribute("role", "dialog");
      popup.setAttribute("aria-label", "Annotation comment");

      const selectedText = document.createElement("blockquote");
      selectedText.textContent = annotation.highlight;
      const commentText = document.createElement("p");
      commentText.textContent = annotation.comment;
      const metadata = document.createElement("small");
      const displayedAt = annotation.updated_at || annotation.created_at;
      metadata.textContent = `${annotation.author || "IRO Admin"}${displayedAt ? ` · ${new Date(displayedAt).toLocaleString()}` : ""}${annotation.updated_at ? " · Edited" : ""}`;
      popup.append(selectedText, commentText, metadata);

      if (showInlineComments && canManageAnnotations && annotation.can_manage !== false) {
        const actions = document.createElement("div");
        actions.className = "pdf-annotation-actions";
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "outline";
        editButton.textContent = "Edit comment";
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "pdf-annotation-remove";
        removeButton.textContent = "Remove highlight";
        actions.append(editButton, removeButton);
        popup.append(actions);

        editButton.addEventListener("click", (event) => {
          event.stopPropagation();
          if (popup.querySelector(".pdf-annotation-edit-form")) return;
          const form = document.createElement("form");
          form.className = "pdf-annotation-edit-form";
          const textarea = document.createElement("textarea");
          textarea.value = annotation.comment;
          textarea.maxLength = 2000;
          textarea.required = true;
          textarea.setAttribute("aria-label", "Edit annotation comment");
          const controls = document.createElement("div");
          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.className = "outline";
          cancel.textContent = "Cancel";
          const save = document.createElement("button");
          save.type = "submit";
          save.textContent = "Save";
          controls.append(cancel, save);
          form.append(textarea, controls);
          actions.hidden = true;
          popup.append(form);
          textarea.focus();
          cancel.addEventListener("click", () => { form.remove(); actions.hidden = false; });
          form.addEventListener("submit", async (submitEvent) => {
            submitEvent.preventDefault();
            const nextComment = textarea.value.trim();
            if (!nextComment) return;
            save.disabled = true;
            textarea.disabled = true;
            try {
              openAnnotationIdRef.current = annotation.id;
              const updated = await onUpdateAnnotation(annotation.id, nextComment);
              commentText.textContent = updated.comment;
              metadata.textContent = `${annotation.author || "IRO Admin"}${updated.updated_at ? ` · ${new Date(updated.updated_at).toLocaleString()}` : ""} · Edited`;
              form.remove();
              actions.hidden = false;
              popup.hidden = false;
            } catch {
              save.disabled = false;
              textarea.disabled = false;
              textarea.focus();
            }
          });
        });

        removeButton.addEventListener("click", (event) => {
          event.stopPropagation();
          onRequestRemoveAnnotation(annotation.id);
        });
      }

      const pageElement = layer.closest(".pdf-page");
      const pageScale = Number.parseFloat(pageElement?.style.getPropertyValue("--scale-factor")) || 1;
      const normalizedRects = annotation.geometry_units === "department_review_pixels"
        ? rects.map((rect) => ({
            x: rect.x / ((layer.clientWidth / pageScale) * 1.35),
            y: rect.y / ((layer.clientHeight / pageScale) * 1.35),
            width: rect.width / ((layer.clientWidth / pageScale) * 1.35),
            height: rect.height / ((layer.clientHeight / pageScale) * 1.35),
          }))
        : rects;
      const anchor = normalizedRects[normalizedRects.length - 1];
      const opensLeft = anchor.x + anchor.width > 0.68;
      popup.style.left = `${Math.max(0.01, opensLeft ? anchor.x - 0.43 : anchor.x + anchor.width + 0.012) * 100}%`;
      if (anchor.y > 0.72) popup.style.bottom = `${Math.max(0.01, 1 - anchor.y) * 100}%`;
      else popup.style.top = `${Math.max(0.01, anchor.y + anchor.height + 0.012) * 100}%`;
      if (showInlineComments) group.append(popup);

      const togglePopup = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const shouldOpen = popup.hidden;
        closePopups();
        popup.hidden = !shouldOpen;
        openAnnotationIdRef.current = shouldOpen ? annotation.id : null;
        group.querySelectorAll(".saved-text-highlight, .pdf-comment-icon").forEach((control) => {
          control.setAttribute("aria-expanded", String(shouldOpen));
        });
      };

      normalizedRects.forEach((rect, rectIndex) => {
        const mark = document.createElement(showInlineComments ? "button" : "div");
        if (showInlineComments) mark.type = "button";
        mark.className = "saved-text-highlight";
        mark.style.cssText = `left:${rect.x * 100}%;top:${rect.y * 100}%;width:${rect.width * 100}%;height:${rect.height * 100}%`;
        if (rectIndex === 0 && annotation.display_number) {
          const marker = document.createElement("span");
          marker.className = "saved-text-highlight__marker";
          marker.textContent = String(annotation.display_number);
          mark.append(marker);
        }
        if (showInlineComments) {
          mark.setAttribute("aria-controls", popupId);
          mark.setAttribute("aria-expanded", String(!popup.hidden));
        }
        mark.setAttribute("aria-label", annotation.display_number
          ? `Highlight #${annotation.display_number}: ${annotation.highlight}. Comment: ${annotation.comment}`
          : `Highlighted text: ${annotation.highlight}. Comment: ${annotation.comment}`);
        if (showInlineComments) mark.addEventListener("click", togglePopup);
        group.append(mark);
      });

      if (showInlineComments) {
      const icon = document.createElement("button");
      icon.type = "button";
      icon.className = "pdf-comment-icon";
      icon.textContent = "💬";
      icon.style.left = `${Math.min(0.965, anchor.x + anchor.width + 0.006) * 100}%`;
      icon.style.top = `${Math.max(0.005, anchor.y - 0.008) * 100}%`;
      icon.setAttribute("aria-label", `Open comment for ${annotation.highlight}`);
      icon.setAttribute("aria-controls", popupId);
      icon.setAttribute("aria-expanded", String(!popup.hidden));
      icon.addEventListener("click", togglePopup);
      group.append(icon);
      }
    });

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [annotations, url, renderVersion, canManageAnnotations, showInlineComments, onUpdateAnnotation, onRequestRemoveAnnotation]);

  return <>{renderError && <p className="auth-error">{renderError}</p>}<div ref={containerRef} className="pdf-document-viewer" onMouseUp={onSelection} /></>;
}

export function getPdfTextSelection() {
  const browserSelection = window.getSelection();
  if (!browserSelection || browserSelection.isCollapsed || !browserSelection.rangeCount) return null;
  const range = browserSelection.getRangeAt(0);
  const page = closestPdfPage(range.startContainer);
  if (!page || !page.contains(range.endContainer)) return null;
  const rects = normalizeSelectionRects([...range.getClientRects()], page.getBoundingClientRect());
  const text = browserSelection.toString().trim();
  return text && rects.length ? { text, page: Number(page.dataset.page), rects } : null;
}

function closestPdfPage(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest?.(".pdf-page") ?? null;
}

function normalizeSelectionRects(clientRects, pageBounds) {
  if (!pageBounds.width || !pageBounds.height) return [];

  const clipped = clientRects.map((rect) => {
    const left = Math.max(pageBounds.left, rect.left);
    const top = Math.max(pageBounds.top, rect.top);
    const right = Math.min(pageBounds.right, rect.right);
    const bottom = Math.min(pageBounds.bottom, rect.bottom);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }).filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const unique = clipped.filter((rect, index) => !clipped.slice(0, index).some((candidate) =>
    Math.abs(candidate.left - rect.left) < 0.5
    && Math.abs(candidate.top - rect.top) < 0.5
    && Math.abs(candidate.right - rect.right) < 0.5
    && Math.abs(candidate.bottom - rect.bottom) < 0.5
  ));

  const merged = [];
  unique.forEach((rect) => {
    const previous = merged[merged.length - 1];
    if (previous && rectanglesShareSelectedLine(previous, rect)) {
      previous.left = Math.min(previous.left, rect.left);
      previous.top = Math.min(previous.top, rect.top);
      previous.right = Math.max(previous.right, rect.right);
      previous.bottom = Math.max(previous.bottom, rect.bottom);
      previous.width = previous.right - previous.left;
      previous.height = previous.bottom - previous.top;
      return;
    }
    merged.push({ ...rect });
  });

  return merged.map((rect) => ({
    x: precision((rect.left - pageBounds.left) / pageBounds.width),
    y: precision((rect.top - pageBounds.top) / pageBounds.height),
    width: precision(rect.width / pageBounds.width),
    height: precision(rect.height / pageBounds.height),
  }));
}

function rectanglesShareSelectedLine(left, right) {
  const overlap = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
  const overlapRatio = overlap / Math.min(left.height, right.height);
  const gap = right.left - left.right;
  const adjacencyTolerance = Math.max(1.5, Math.min(left.height, right.height) * 0.35);
  return overlapRatio >= 0.7 && gap >= -0.75 && gap <= adjacencyTolerance;
}

function precision(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
}
