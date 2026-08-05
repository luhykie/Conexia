import React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { getAuthToken } from "../utils/authToken";
import { resolveSubmissionDocumentUrl, submissionHasAttachment } from "../utils/documentUrl";
import { getSubmissionFile } from "../services/submissions";
import {
  findPageShellFromNode,
  getHighlightRects,
  getPageLayerRect,
  normalizeHighlightCoordinates,
} from "../utils/pdfAnnotations";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function PageHighlights({ layerRef, pageNumber, items, activeOverlayId, onOverlayActivate }) {
  const [pageRect, setPageRect] = React.useState(null);

  React.useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;

    function updateRect() {
      setPageRect({
        width: layer.clientWidth,
        height: layer.clientHeight,
      });
    }

    updateRect();
    const observer = new ResizeObserver(updateRect);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [layerRef, items, pageNumber]);

  const pageItems = items.filter((item) => Number(item.page_number) === pageNumber);

  return pageItems.flatMap((item) => {
    const rects = getHighlightRects(item.highlight_coordinates, pageRect);
    return rects.map((rect, index) => (
      <button
        key={`${item.id}-${index}`}
        type="button"
        className={`review-highlight-overlay ${item.type === "comment" ? "review-highlight-overlay--comment" : ""} ${activeOverlayId === item.id ? "review-highlight-overlay--active" : ""}`.trim()}
        style={{
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          background: item.color || item.highlight_color || (item.type === "comment" ? "rgba(80,149,255,0.26)" : "rgba(246,194,75,0.28)"),
          borderColor: item.color || item.highlight_color || (item.type === "comment" ? "rgba(80,149,255,0.72)" : "rgba(246,194,75,0.72)"),
        }}
        title={item.selected_text || "Highlight"}
        onClick={() => onOverlayActivate?.(item.id)}
      />
    ));
  });
}

function DocumentPage({ pageNumber, pageWidth, overlayItems, activeOverlayId, onOverlayActivate }) {
  const layerRef = React.useRef(null);

  return (
    <div className="document-viewer__page-shell" data-page={pageNumber}>
      <div className="document-viewer__page-stack">
        <div className="document-viewer__page-layer" ref={layerRef}>
          <Page
            pageNumber={pageNumber}
            width={pageWidth || undefined}
            renderTextLayer
            renderAnnotationLayer={false}
          />
        </div>
        <div className="document-viewer__annotation-layer">
          <PageHighlights
            layerRef={layerRef}
            pageNumber={pageNumber}
            items={overlayItems}
            activeOverlayId={activeOverlayId}
            onOverlayActivate={onOverlayActivate}
          />
        </div>
      </div>
    </div>
  );
}

function SelectionToolbar({ position, onHighlight, onComment, onDismiss, busy, selectedColor, onColorChange }) {
  if (!position) return null;
  const colors = [
    "#f6c24b",
    "#7dd3fc",
    "#86efac",
    "#fca5a5",
  ];

  return (
    <div
      className="selection-toolbar"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="selection-toolbar__colors" role="group" aria-label="Highlight colors">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`selection-toolbar__swatch ${selectedColor === color ? "active" : ""}`.trim()}
            style={{ backgroundColor: color }}
            aria-label={`Choose highlight color ${color}`}
            onClick={() => onColorChange?.(color)}
          />
        ))}
      </div>
      <button type="button" className="primary" disabled={busy} onClick={onHighlight}>Highlight</button>
      <button type="button" className="outline" disabled={busy} onClick={onComment}>Comment</button>
      <button type="button" className="outline" onClick={onDismiss}>Close</button>
    </div>
  );
}

function CommentPopover({ pendingComment, onSubmit, onCancel, busy }) {
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    setDraft("");
  }, [pendingComment]);

  if (!pendingComment) return null;

  return (
    <div
      className="review-comment-popover"
      style={{ left: `${pendingComment.toolbar.left}px`, top: `${pendingComment.toolbar.top + 44}px` }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <strong>Add comment</strong>
      {pendingComment.selectedText ? (
        <p className="review-comment-popover__quote">"{pendingComment.selectedText}"</p>
      ) : null}
      <textarea
        rows={4}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Explain what needs to be revised..."
      />
      <div className="review-comment-popover__actions">
        <button type="button" className="outline" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={busy} onClick={() => onSubmit(draft)}>Add Comment</button>
      </div>
    </div>
  );
}

export function DocumentViewer({
  submission,
  account,
  className = "",
  onPageCountChange,
  overlayItems = [],
  canSelect = false,
  activeOverlayId = null,
  onOverlayActivate,
  onHighlight,
  onComment,
  pendingComment = null,
  onSubmitPendingComment,
  onCancelPendingComment,
  busy = false,
}) {
  const containerRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const objectUrlRef = React.useRef(null);
  const [pdfUrl, setPdfUrl] = React.useState(null);
  const [numPages, setNumPages] = React.useState(null);
  const [pageWidth, setPageWidth] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [selectionToolbar, setSelectionToolbar] = React.useState(null);
  const [selectionPayload, setSelectionPayload] = React.useState(null);
  const [selectionColor, setSelectionColor] = React.useState("#f6c24b");

  React.useEffect(() => {
    function updateWidth() {
      const container = containerRef.current;
      if (!container) return;
      setPageWidth(Math.max(320, container.clientWidth - 48));
    }

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [pdfUrl]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      if (!submission?.id) {
        setPdfUrl(null);
        setError("");
        setNumPages(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setNumPages(null);
      setPdfUrl(null);

      if (!submissionHasAttachment(submission)) {
        setError("Document not attached.");
        setLoading(false);
        return;
      }

      const token = getAuthToken();
      if (!token) {
        setError("Authentication token missing. Please sign in again.");
        setLoading(false);
        return;
      }

      try {
        let documentUrl = null;

        try {
          const meta = await getSubmissionFile(account, submission.id);
          documentUrl = meta?.data?.url || null;
        } catch (requestError) {
          if (requestError.message?.includes("401")) {
            throw new Error("Unauthorized document access. Your session may have expired.");
          }
          if (requestError.message?.includes("403")) {
            throw new Error("You are not authorized to view this document.");
          }
          if (requestError.message?.includes("404")) {
            throw new Error("Document not found.");
          }
          throw requestError;
        }

        if (!documentUrl) {
          throw new Error("Document not found.");
        }

        if (documentUrl.startsWith("data:")) {
          if (!cancelled) {
            setPdfUrl(documentUrl);
          }
          return;
        }

        const fetchUrl = resolveSubmissionDocumentUrl(submission, documentUrl);

        if (import.meta.env.DEV) {
          console.debug("[DocumentViewer] Fetching PDF:", fetchUrl);
        }

        const response = await fetch(fetchUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/pdf",
          },
        });

        if (response.status === 401) {
          throw new Error("Unauthorized document access. Your session may have expired.");
        }
        if (response.status === 403) {
          throw new Error("You are not authorized to view this document.");
        }
        if (response.status === 404) {
          throw new Error("Document not found.");
        }
        if (!response.ok) {
          throw new Error(`PDF request failed: HTTP ${response.status}`);
        }

        const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
        if (contentType.includes("json") || contentType.includes("html")) {
          throw new Error("Backend returned non-PDF response.");
        }

        const blob = await response.blob();
        if (!blob.size) {
          throw new Error("Backend returned an empty document.");
        }

        const pdfBlob = contentType.includes("pdf")
          ? blob
          : new Blob([blob], { type: "application/pdf" });

        const objectUrl = URL.createObjectURL(pdfBlob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = objectUrl;

        if (!cancelled) {
          setPdfUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (loadError) {
        if (import.meta.env.DEV) {
          console.error("[DocumentViewer] Load failed:", loadError);
        }
        if (!cancelled) {
          setPdfUrl(null);
          setError(loadError.message || "PDF rendering failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [submission?.id, account]);

  React.useEffect(() => {
    onPageCountChange?.(numPages);
  }, [numPages, onPageCountChange]);

  React.useEffect(() => {
    if (!canSelect) {
      setSelectionToolbar(null);
      setSelectionPayload(null);
    }
  }, [canSelect, submission?.id]);

  function clearSelectionUi() {
    setSelectionToolbar(null);
    setSelectionPayload(null);
    const selection = window.getSelection?.();
    selection?.removeAllRanges?.();
  }

  function handleViewerMouseUp(event) {
    if (!canSelect || busy || pendingComment) return;

    const selection = window.getSelection?.();
    const selectedText = String(selection?.toString() || "").trim();
    if (!selectedText || selection.rangeCount === 0) {
      return;
    }

    const anchorNode = selection.anchorNode;
    const pageShell = findPageShellFromNode(anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement);
    if (!pageShell || !scrollRef.current?.contains(pageShell)) {
      return;
    }

    const pageRect = getPageLayerRect(pageShell);
    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();
    const layerBox = pageShell.querySelector(".document-viewer__page-layer")?.getBoundingClientRect();
    const coordinates = layerBox
      ? normalizeHighlightCoordinates(clientRects, layerBox)
      : normalizeHighlightCoordinates(clientRects, pageRect);
    if (!coordinates) return;

    const pageNumber = Number(pageShell.dataset.page || 1);
    const lastRect = range.getClientRects()[range.getClientRects().length - 1] || range.getBoundingClientRect();
    const scrollRect = scrollRef.current.getBoundingClientRect();

    const payload = {
      pageNumber,
      selectedText,
      coordinates,
      color: selectionColor,
      toolbar: {
        left: Math.max(12, lastRect.left - scrollRect.left + scrollRef.current.scrollLeft),
        top: Math.max(12, lastRect.bottom - scrollRect.top + scrollRef.current.scrollTop + 8),
      },
    };

    setSelectionPayload(payload);
    setSelectionToolbar(payload.toolbar);
  }

  function handleHighlightClick() {
    if (!selectionPayload) return;
    onHighlight?.(selectionPayload);
    clearSelectionUi();
  }

  function handleCommentClick() {
    if (!selectionPayload) return;
    onComment?.(selectionPayload);
    setSelectionToolbar(null);
  }

  if (loading) {
    return (
      <div className={`document-viewer document-viewer--loading ${className}`.trim()}>
        <p>Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`document-viewer document-viewer--error ${className}`.trim()}>
        <p>{error}</p>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className={`document-viewer document-viewer--empty ${className}`.trim()}>
        <p>No PDF is attached to this submission yet.</p>
      </div>
    );
  }

  return (
    <div className={`document-viewer ${className}`.trim()} ref={containerRef}>
      <div
        className="document-viewer__scroll"
        ref={scrollRef}
        onMouseUp={handleViewerMouseUp}
      >
        <div className="document-viewer__pages">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: loadedPages }) => {
              setNumPages(loadedPages);
              onPageCountChange?.(loadedPages);
            }}
            onLoadError={(loadError) => {
              if (import.meta.env.DEV) {
                console.error("[DocumentViewer] PDF render error:", loadError);
              }
              setError("PDF rendering failed.");
            }}
            loading={<p>Loading document...</p>}
          >
            {numPages
              ? Array.from({ length: numPages }, (_, index) => (
                  <DocumentPage
                    key={`page-${index + 1}`}
                    pageNumber={index + 1}
                    pageWidth={pageWidth}
                    overlayItems={overlayItems}
                    activeOverlayId={activeOverlayId}
                    onOverlayActivate={onOverlayActivate}
                  />
                ))
              : null}
          </Document>
        </div>

        <SelectionToolbar
          position={selectionToolbar}
          busy={busy}
          onHighlight={handleHighlightClick}
          onComment={handleCommentClick}
          onDismiss={clearSelectionUi}
          selectedColor={selectionColor}
          onColorChange={setSelectionColor}
        />
        <CommentPopover
          pendingComment={pendingComment}
          busy={busy}
          onSubmit={onSubmitPendingComment}
          onCancel={() => {
            onCancelPendingComment?.();
            clearSelectionUi();
          }}
        />
      </div>
    </div>
  );
}
