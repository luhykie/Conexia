import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { getDocumentFileBlob } from "../services/documentService";

export function DocumentPreview({ document, canViewContent = true }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [previewRequested, setPreviewRequested] = useState(false);
  const attachment = useMemo(
    () =>
      ["notarized_copy", "reviewed_version", "original_draft"]
        .map((category) => document?.files?.find(
          (file) => file.file_category === category
        ))
        .find(Boolean) || document?.files?.[0] || null,
    [document]
  );

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    async function loadAttachment() {
      if (!canViewContent || !previewRequested || !document?.id || !attachment?.id) {
        setPreviewUrl("");
        return;
      }

      setLoadingFile(true);
      setFileError("");
      try {
        const blob = await getDocumentFileBlob(document.id, attachment.id);
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setPreviewUrl(objectUrl);
        }
      } catch (error) {
        if (active) {
          setFileError(error.message || "Unable to load the attachment.");
        }
      } finally {
        if (active) {
          setLoadingFile(false);
        }
      }
    }

    loadAttachment();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [canViewContent, previewRequested, document?.id, attachment?.id]);

  useEffect(() => {
    setPreviewRequested(false);
    setPreviewUrl("");
    setFileError("");
  }, [document?.id, attachment?.id]);

  if (!document) {
    return (
      <section className="panel document-preview-panel">
        <p>Loading document...</p>
      </section>
    );
  }

  return (
    <section className="panel document-preview-panel">
      <header className="panel-toolbar">
        <div className="file-title">
          {attachment?.original_filename || document.title}
        </div>

        <div className="toolbar-actions">
          {previewUrl && (
            <button
              className="outline"
              type="button"
              onClick={() =>
                window.open(previewUrl, "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink size={16} />
              Open attachment
            </button>
          )}
        </div>
      </header>

      <div className="doc-canvas">
        {!canViewContent && (
          <div className="doc-placeholder">
            <div className="doc-inner">
              <h2>Submission record</h2>
              <p>
                You can view and log this incoming submission, but the
                document contents are restricted.
              </p>
              <p><strong>Tracking Number:</strong> {document.tracking_number}</p>
              <p><strong>Department:</strong> {document.departments?.name || document.department?.name || "Not available"}</p>
              <p><strong>Partner Institution:</strong> {document.partner_institution}</p>
              <p><strong>Document Type:</strong> {document.document_type}</p>
              <p><strong>Status:</strong> {document.status}</p>
            </div>
          </div>
        )}

        {canViewContent && loadingFile && (
          <div className="doc-file-state">Loading submitted document...</div>
        )}

        {canViewContent && !previewRequested && attachment && (
          <div className="doc-file-state">
            <FileText size={48} />
            <b>{attachment.original_filename}</b>
            <p>The document preview is loaded only when requested to keep this page fast.</p>
            <button type="button" onClick={() => setPreviewRequested(true)}>
              Load document preview
            </button>
          </div>
        )}

        {canViewContent && !loadingFile && fileError && (
          <div className="doc-file-state error">{fileError}</div>
        )}

        {canViewContent && !loadingFile && !fileError && attachment && previewUrl &&
          attachment.mime_type === "application/pdf" && (
            <iframe
              className="document-file-frame"
              src={previewUrl}
              title={attachment.original_filename}
            />
          )}

        {canViewContent && !loadingFile && !fileError && attachment && previewUrl &&
          attachment.mime_type !== "application/pdf" && (
            <div className="doc-file-state">
              <FileText size={48} />
              <b>{attachment.original_filename}</b>
              <p>
                This file type opens in its associated application or browser
                handler.
              </p>
              <button
                type="button"
                onClick={() =>
                  window.open(previewUrl, "_blank", "noopener,noreferrer")
                }
              >
                <ExternalLink size={16} />
                Open attachment
              </button>
            </div>
          )}

        {canViewContent && !loadingFile && !attachment && (
          <div className="doc-placeholder">
          <div className="doc-inner">

            <h2>{document.title}</h2>

            <p>
              <strong>Tracking Number:</strong>{" "}
              {document.tracking_number}
            </p>

            <p>
              <strong>Department:</strong>{" "}
              {document.departments?.name}
            </p>

            <p>
              <strong>Partner Institution:</strong>{" "}
              {document.partner_institution}
            </p>

            <p>
              <strong>Document Type:</strong>{" "}
              {document.document_type}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {document.status}
            </p>

            <p>
              <strong>Description:</strong>
            </p>

            <p>{document.description}</p>

          </div>
        </div>
        )}
      </div>
    </section>
  );
}

export default DocumentPreview;
