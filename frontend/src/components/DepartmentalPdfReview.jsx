import React from "react";
import { getDocumentFiles, getDocumentPreviewUrl } from "../services/documentFileService";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf";
import { TextLayer } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export function DepartmentalPdfReview({ documentId, fileId = null, items = [], annotations = null, onCreateItem, onUpdateHighlight, onCreateAnnotation, onUpdateAnnotation, onRemoveAnnotation, onUpdateAnnotationComment, canAnnotate = false, canComment = false }) {
  const [pages, setPages] = React.useState([]);
  const [error, setError] = React.useState("");
  const [selection, setSelection] = React.useState(null);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [commentOpen, setCommentOpen] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [activeHighlight, setActiveHighlight] = React.useState(null);
  const viewerRef = React.useRef(null);
  const textLayerRefs = React.useRef({});

  React.useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    async function load() {
      try {
        setError(""); setPages([]);
        const response = await getDocumentFiles(documentId, { per_page: fileId ? 100 : 1 });
        const availableFiles = response.files ?? response.data ?? [];
        const file = fileId
          ? availableFiles.find((entry) => entry.id === fileId)
          : availableFiles[0];
        if (!file) {
          setError(fileId ? "The requested document version is unavailable." : "No submitted document is available for review.");
          return;
        }
        if (fileId && import.meta.env.DEV) console.debug("Department history annotations", { submission_id: documentId, version_id: file.version, file_id: file.id, highlights: items.map((item) => ({ highlight_id: item.id, text: item.selected_text, page: item.selection_anchor?.page, anchor: item.selection_anchor, comment: item.comment })) });
        if (!file.mime_type?.includes("pdf")) {
          setError("Text review is available for PDF files. Upload a PDF to use highlights and comments.");
          return;
        }
        objectUrl = await getDocumentPreviewUrl(documentId, file.id);
        const data = new Uint8Array(await fetch(objectUrl).then((result) => result.arrayBuffer()));
        const pdf = await getDocument({ data }).promise;
        const rendered = [];
        for (let number = 1; number <= pdf.numPages; number += 1) {
          const page = await pdf.getPage(number);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          const content = await page.getTextContent();
          rendered.push({ number, width: viewport.width, height: viewport.height, scale: viewport.scale, viewport, textContent: content, image: canvas.toDataURL() });
        }
        if (!cancelled) setPages(rendered);
      } catch (loadError) { if (!cancelled) setError(loadError.message || "Unable to render this PDF."); }
      finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
    }
    load();
    return () => { cancelled = true; };
  }, [documentId, fileId]);

  React.useEffect(() => {
    const tasks = pages.map((page) => {
      const container = textLayerRefs.current[page.number];
      if (!container) return null;
      container.replaceChildren();
      container.style.setProperty("--scale-factor", String(page.scale));
      const textLayer = new TextLayer({
        textContentSource: page.textContent,
        container,
        viewport: page.viewport,
      });

      return textLayer.render();
    }).filter(Boolean);

    return () => tasks.forEach((task) => task.cancel?.());
  }, [pages]);

  function captureSelection(event) {
    if (!canAnnotate) return;
    const browserSelection = window.getSelection();
    const text = browserSelection?.toString().trim();
    if (!text || !viewerRef.current?.contains(browserSelection.anchorNode)) return;
    const page = event.currentTarget;
    const pageBounds = page.getBoundingClientRect();
    const capturedRects = Array.from(browserSelection.getRangeAt(0).getClientRects())
      .map((rect) => ({ x: rect.left - pageBounds.left, y: rect.top - pageBounds.top, width: rect.width, height: rect.height }))
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const rects = capturedRects.filter((rect, index) => !capturedRects.slice(0, index).some((previous) =>
      Math.abs(previous.x - rect.x) < 0.5
      && Math.abs(previous.y - rect.y) < 0.5
      && Math.abs(previous.width - rect.width) < 0.5
      && Math.abs(previous.height - rect.height) < 0.5
    ));
    if (!rects.length) return;
    setSelection({ text, anchor: { page: Number(page.dataset.page), rects }, position: toolbarPosition(event.clientX, event.clientY) });
    setColorOpen(false); setCommentOpen(true); setComment("");
  }

  async function add(type, color = null, parentId = null) {
    if (!selection || saving) return;
    if (!comment.trim()) { setError("Please add a comment for this highlighted section."); return; }
    setSaving(true);
    try {
      if (annotations) {
        const page = pages.find((entry) => entry.number === selection.anchor.page);
        await onCreateAnnotation({ highlight: selection.text, comment: comment.trim(), geometry: { page: selection.anchor.page, rects: selection.anchor.rects.map((rect) => ({ x: rect.x / page.width, y: rect.y / page.height, width: rect.width / page.width, height: rect.height / page.height })) } });
      } else {
        await onCreateItem({ type, selected_text: selection.text, selection_anchor: selection.anchor, highlight_color: color, comment: comment.trim(), parent_id: parentId });
      }
      window.getSelection()?.removeAllRanges(); setSelection(null); setColorOpen(false); setCommentOpen(false); setComment("");
    } finally { setSaving(false); }
  }

  async function removeActiveHighlight(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!activeHighlight) return;
    try {
      if (annotations) await onRemoveAnnotation(activeHighlight.item.id);
      else await onUpdateHighlight(activeHighlight.item.id, { highlight_color: null });
      setActiveHighlight(null);
    } catch (updateError) {
      setError(updateError.message || "Unable to remove this highlight.");
    }

  }

  async function saveExistingComment() {
    if (!activeHighlight || !comment.trim() || !onUpdateAnnotationComment || saving) return;
    setSaving(true);
    try {
      await onUpdateAnnotationComment(activeHighlight.item.id, comment.trim());
      setActiveHighlight(null);
      setComment("");
      setCommentOpen(false);
    } catch (updateError) {
      setError(updateError.message || "Unable to save this comment.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="departmental-pdf-review" ref={viewerRef}>
    {error && <p className="auth-error">{error}</p>}
    {!error && !pages.length && <p>Loading document preview…</p>}
    {pages.map((page) => <div className="departmental-pdf-page" data-page={page.number} key={page.number} style={{ width: page.width, height: page.height }} onMouseUp={captureSelection}>
      <img src={page.image} alt={`Document page ${page.number}`} draggable="false" />
      <div ref={(element) => { textLayerRefs.current[page.number] = element; }} className="departmental-pdf-text-layer textLayer" aria-label={`Selectable text for page ${page.number}`} />
      {reviewHighlights(annotations, items, page).flatMap((item) => (item.selection_anchor.rects || []).map((rect, index) => { const marker = item.display_number || "?"; const openHighlight = (event) => { event.stopPropagation(); setSelection(null); setActiveHighlight({ item, position: toolbarPosition(event.clientX, event.clientY) }); setColorOpen(false); setCommentOpen(false); setComment(""); }; return <span role="button" tabIndex={0} className={`departmental-pdf-highlight departmental-pdf-highlight--${item.highlight_color}`} key={`${item.id}-${index}`} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} title={`Highlight #${marker}: ${item.selected_text || ""}`} onClick={openHighlight} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openHighlight(event); }}>{index === 0 && <span className="departmental-pdf-highlight__marker">{marker}</span>}</span>; }))}
    </div>)}
    {selection && canAnnotate && commentOpen && <div className="departmental-pdf-toolbar departmental-pdf-toolbar--comment" style={{ left: selection.position.left, top: selection.position.top }}>
      <header><b>Add Highlight</b><button type="button" aria-label="Cancel highlight" onClick={() => { setSelection(null); setCommentOpen(false); setComment(""); window.getSelection()?.removeAllRanges(); }}>×</button></header>
      <blockquote>{selection.text}</blockquote>
      <label>Review comment<textarea autoFocus value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Explain what needs attention…" maxLength={2000} /></label>
      <footer><button type="button" className="outline" onClick={() => { setSelection(null); setCommentOpen(false); setComment(""); }}>Cancel</button><button type="button" disabled={saving || !comment.trim()} onClick={() => add("highlight")}>{saving ? "Saving…" : "Save Highlight"}</button></footer>
    </div>}
    {activeHighlight && (canAnnotate || canComment) && <div className="departmental-pdf-toolbar departmental-pdf-toolbar--manage" onMouseDown={(event) => event.stopPropagation()} style={{ left: activeHighlight.position.left, top: activeHighlight.position.top }}>
      <b>Highlight #{activeHighlight.item.display_number || ""}</b>
      {canComment && <button type="button" className="outline" onClick={() => { setComment(activeHighlight.item.comment || ""); setCommentOpen(true); }}>Comment</button>}
      {canAnnotate && <button type="button" className="departmental-pdf-toolbar__remove" onMouseDown={removeActiveHighlight} onClick={(event) => event.preventDefault()}>Remove</button>}
      <button type="button" className="outline" onClick={() => setActiveHighlight(null)}>Close</button>
    </div>}
    {activeHighlight && canComment && commentOpen && <div className="departmental-pdf-toolbar departmental-pdf-toolbar--comment" onMouseDown={(event) => event.stopPropagation()} style={{ left: activeHighlight.position.left, top: activeHighlight.position.top }}>
      <header><b>Comment on Highlight</b><button type="button" aria-label="Cancel comment" onClick={() => { setCommentOpen(false); setComment(""); }}>×</button></header>
      <blockquote>{activeHighlight.item.selected_text || activeHighlight.item.highlight}</blockquote>
      <label>Review comment<textarea autoFocus value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3} required /></label>
      <footer><button type="button" className="outline" onClick={() => { setCommentOpen(false); setComment(""); }}>Cancel</button><button type="button" disabled={saving || !comment.trim()} onClick={saveExistingComment}>{saving ? "Saving…" : "Save Comment"}</button></footer>
    </div>}
  </section>;
}

function toolbarPosition(clientX, clientY) {
  return {
    left: Math.max(16, Math.min(clientX, window.innerWidth - 340)),
    top: Math.max(16, Math.min(clientY + 12, window.innerHeight - 300)),
  };
}

function reviewHighlights(annotations, items, page) {
  const source = annotations
    ? annotations.map((annotation, index) => {
        const pixelGeometry = annotation.geometry_units === "department_review_pixels";
        return {
          id: annotation.id,
          type: "highlight",
          highlight_color: "yellow",
          display_number: annotation.display_number || index + 1,
          selected_text: annotation.highlight,
          selection_anchor: {
            page: annotation.geometry?.page,
            rects: (annotation.geometry?.rects || []).map((rect) => ({
              x: pixelGeometry ? rect.x : rect.x * page.width,
              y: pixelGeometry ? rect.y : rect.y * page.height,
              width: pixelGeometry ? rect.width : rect.width * page.width,
              height: pixelGeometry ? rect.height : rect.height * page.height,
            })),
          },
        };
      })
    : items.map((item) => {
        if (item.geometry_units !== "normalized") return item;
        return {
          ...item,
          selection_anchor: {
            ...item.selection_anchor,
            rects: (item.selection_anchor?.rects || []).map((rect) => ({
              x: rect.x * page.width,
              y: rect.y * page.height,
              width: rect.width * page.width,
              height: rect.height * page.height,
            })),
          },
        };
      });

  return source.filter((item) => item.type === "highlight"
    && item.highlight_color
    && !item.highlight_removed_at
    && item.selection_anchor?.page === page.number);
}
