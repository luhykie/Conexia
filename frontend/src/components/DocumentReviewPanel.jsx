import React from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, MessageSquareText, RotateCcw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

import { PageTitle } from "./PageTitle";
import { Panel } from "./Panel";
import { DocumentChat } from "./DocumentChat";
import {
  getActiveLegalCounselUsers,
  getIroDocument,
  returnAdminReviewForRevision,
  validateAdminReview,
} from "../services/iroStaffService";
import {
  createDocumentAnnotation,
  getDocumentAnnotations,
  getDocumentFiles,
  getDocumentPreviewBlob,
  removeDocumentAnnotation,
  updateDocumentAnnotation,
} from "../services/documentFileService";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
      setDocument(loadedDocument);
      setFiles(loadedFiles);
      setFileId(loadedFiles[0]?.id || "");
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
    Promise.all([
      getDocumentPreviewBlob(documentId, fileId),
      getDocumentAnnotations(documentId, fileId),
    ]).then(([blob, response]) => {
      objectUrl = URL.createObjectURL(blob);
      if (!active) return URL.revokeObjectURL(objectUrl);
      setPreviewUrl(objectUrl);
      setAnnotations(response.annotations ?? response.data ?? []);
    }).catch((requestError) => active && setError(requestError.message));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, fileId]);

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

  return (
    <section className="page iro-admin-document-review-page">
      <button type="button" className="outline back-button" onClick={() => navigate("/app/log-review")}><ArrowLeft size={16} /> Back to Log & Review</button>
      <PageTitle title={document?.tracking_number ? `Review ${document.tracking_number}` : "Document Review"} subtitle="Select text in the routed document to highlight it and attach a comment." />
      {loading && <p>Loading routed document...</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!loading && document && fileId && (
        <>
          <Panel title="Routed Document">
            {files.length > 1 && <label>Document Version<select value={fileId} onChange={(event) => setFileId(event.target.value)}>{files.map((file) => <option key={file.id} value={file.id}>v{file.version} — {file.filename}</option>)}</select></label>}
            <p className="document-version-label">{selectedFile?.filename} · Version {selectedFile?.version} · Original is read-only</p>
            {selectedFile?.mime_type === "application/pdf" && previewUrl
              ? <PdfViewer
                  url={previewUrl}
                  annotations={annotations}
                  onSelection={actionable ? captureSelection : undefined}
                  canManageAnnotations={actionable}
                  onUpdateAnnotation={updateAnnotationComment}
                  onRequestRemoveAnnotation={requestAnnotationRemoval}
                />
              : previewUrl && <iframe className="fallback-document-viewer" src={previewUrl} title={selectedFile?.filename || "Routed document"} />}
          </Panel>

          {selection && actionable && (
            <form className="selection-comment" onSubmit={saveAnnotation}>
              <MessageSquareText size={18} />
              <blockquote>“{selection.text}”</blockquote>
              <textarea aria-label="Comment on selected text" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment to this highlight" rows={3} maxLength={2000} required autoFocus />
              <div><button type="button" className="outline" onClick={() => setSelection(null)}>Cancel</button><button type="submit" disabled={busy || !comment.trim()}>Save highlight & comment</button></div>
            </form>
          )}

          {actionable && <section className="review-actions" aria-label="IRO Admin review decisions">
            <div className="review-action-card return-action">
              <h3><RotateCcw size={19} /> Return for Revision</h3>
              <label>Required reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={2000} /></label>
              <button type="button" onClick={returnForRevision} disabled={busy || !reason.trim()}>Return for Revision</button>
            </div>
            <div className="review-action-card validate-action">
              <h3><CheckCircle2 size={19} /> Validate & Route to Legal</h3>
              <label>Legal Counsel<select value={legalCounselId} onChange={(event) => setLegalCounselId(event.target.value)} required><option value="">Select Legal Counsel</option>{legalCounsel.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}</select></label>
              <label>Review comments (optional)<textarea value={decisionComments} onChange={(event) => setDecisionComments(event.target.value)} rows={3} maxLength={2000} /></label>
              <button type="button" onClick={validateAndRoute} disabled={busy || !legalCounselId}>Validate & Route to Legal</button>
            </div>
          </section>}
          {!actionable && <p className="review-complete-notice">This review is read-only because the document has already moved to <b>{document.status}</b>. Saved annotations remain visible.</p>}
        </>
      )}
      {!loading && document && files.length === 0 && <p>No routed document file is available.</p>}
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

function PdfViewer({
  url,
  annotations,
  onSelection,
  canManageAnnotations,
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

      if (canManageAnnotations) {
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

      const anchor = rects[rects.length - 1];
      const opensLeft = anchor.x + anchor.width > 0.68;
      popup.style.left = `${Math.max(0.01, opensLeft ? anchor.x - 0.43 : anchor.x + anchor.width + 0.012) * 100}%`;
      if (anchor.y > 0.72) popup.style.bottom = `${Math.max(0.01, 1 - anchor.y) * 100}%`;
      else popup.style.top = `${Math.max(0.01, anchor.y + anchor.height + 0.012) * 100}%`;
      group.append(popup);

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

      rects.forEach((rect) => {
        const mark = document.createElement("button");
        mark.type = "button";
        mark.className = "saved-text-highlight";
        mark.style.cssText = `left:${rect.x * 100}%;top:${rect.y * 100}%;width:${rect.width * 100}%;height:${rect.height * 100}%`;
      mark.setAttribute("aria-controls", popupId);
        mark.setAttribute("aria-expanded", String(!popup.hidden));
        mark.setAttribute("aria-label", `Highlighted text: ${annotation.highlight}. Comment: ${annotation.comment}`);
        mark.addEventListener("click", togglePopup);
        group.append(mark);
      });

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
    });

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [annotations, url, renderVersion, canManageAnnotations, onUpdateAnnotation, onRequestRemoveAnnotation]);

  return <>{renderError && <p className="auth-error">{renderError}</p>}<div ref={containerRef} className="pdf-document-viewer" onMouseUp={onSelection} /></>;
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
