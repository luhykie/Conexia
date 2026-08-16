import React from "react";
import { getDocumentFiles, getDocumentPreviewUrl } from "../services/documentFileService";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf";
import { TextLayer } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export function DepartmentalPdfReview({ documentId, fileId = null, items = [], onCreateItem, onUpdateHighlight, canAnnotate = false }) {
  const [pages, setPages] = React.useState([]);
  const [error, setError] = React.useState("");
  const [selection, setSelection] = React.useState(null);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [commentOpen, setCommentOpen] = React.useState(false);
  const [comment, setComment] = React.useState("");
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
    const rects = Array.from(browserSelection.getRangeAt(0).getClientRects())
      .map((rect) => ({ x: rect.left - pageBounds.left, y: rect.top - pageBounds.top, width: rect.width, height: rect.height }))
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (!rects.length) return;
    setSelection({ text, anchor: { page: Number(page.dataset.page), rects }, position: { left: event.clientX, top: event.clientY } });
    setColorOpen(false); setCommentOpen(false); setComment("");
  }

  async function add(type, color = null, parentId = null) {
    if (!selection) return;
    if (!comment.trim()) { setError("Please add a comment for this highlighted section."); return; }
    await onCreateItem({ type, selected_text: selection.text, selection_anchor: selection.anchor, highlight_color: color, comment: comment.trim(), parent_id: parentId });
    window.getSelection()?.removeAllRanges(); setSelection(null); setColorOpen(false); setCommentOpen(false); setComment("");
  }

  async function removeActiveHighlight(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!activeHighlight) return;
    try {
      await onUpdateHighlight(activeHighlight.item.id, { highlight_color: null });
      setActiveHighlight(null);
    } catch (updateError) {
      setError(updateError.message || "Unable to remove this highlight.");
    }
  }

  return <section className="departmental-pdf-review" ref={viewerRef}>
    {error && <p className="auth-error">{error}</p>}
    {!error && !pages.length && <p>Loading document preview…</p>}
    {pages.map((page) => <div className="departmental-pdf-page" data-page={page.number} key={page.number} style={{ width: page.width, height: page.height }} onMouseUp={captureSelection}>
      <img src={page.image} alt={`Document page ${page.number}`} draggable="false" />
      <div ref={(element) => { textLayerRefs.current[page.number] = element; }} className="departmental-pdf-text-layer textLayer" aria-label={`Selectable text for page ${page.number}`} />
      {(items || []).filter((item) => item.type === "highlight" && item.highlight_color && !item.highlight_removed_at && item.selection_anchor?.page === page.number).flatMap((item) => (item.selection_anchor.rects || []).map((rect, index) => { const marker = item.display_number || "?"; return <button type="button" className={`departmental-pdf-highlight departmental-pdf-highlight--${item.highlight_color}`} key={`${item.id}-${index}`} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} title={`Highlight #${marker}: ${item.selected_text || ""}`} onClick={(event) => { event.stopPropagation(); setSelection(null); setActiveHighlight({ item, position: { left: event.clientX, top: event.clientY } }); setColorOpen(false); setCommentOpen(false); setComment(""); }}>{index === 0 && <span className="departmental-pdf-highlight__marker">{marker}</span>}</button>; }))}
    </div>)}
    {selection && canAnnotate && <div className="departmental-pdf-toolbar" style={{ left: selection.position.left, top: selection.position.top }}><button type="button" onClick={() => { setCommentOpen(true); setError(""); }}>Highlight</button>{commentOpen && <div className="departmental-pdf-comment"><textarea autoFocus value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a required review comment" /><button type="button" disabled={!comment.trim()} onClick={() => add("highlight")}>Save Annotation</button></div>}</div>}
    {activeHighlight && canAnnotate && <div className="departmental-pdf-toolbar" onMouseDown={(event) => event.stopPropagation()} style={{ left: activeHighlight.position.left, top: activeHighlight.position.top }}><span className="departmental-pdf-toolbar__color">Department color</span><button type="button" className="departmental-pdf-toolbar__remove" onMouseDown={removeActiveHighlight} onClick={(event) => event.preventDefault()}>Remove Highlight</button></div>}
  </section>;
}
