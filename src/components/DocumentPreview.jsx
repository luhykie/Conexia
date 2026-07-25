import React from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export function DocumentPreview({ document }) {
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
          {document.title}
        </div>

        <div className="toolbar-actions">
          <button className="icon-btn">
            <ZoomOut size={16} />
          </button>

          <div className="zoom-label">100%</div>

          <button className="icon-btn">
            <ZoomIn size={16} />
          </button>

          <button className="icon-btn">
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      <div className="doc-canvas">
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
      </div>
    </section>
  );
}

export default DocumentPreview;