import React from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export function DocumentPreview({ fileName = "MOA_GlobalTech_Final_v2.pdf" }) {
  return (
    <section className="panel document-preview-panel">
      <header className="panel-toolbar">
        <div className="file-title">{fileName}</div>
        <div className="toolbar-actions">
          <button className="icon-btn"><ZoomOut size={16} /></button>
          <div className="zoom-label">100%</div>
          <button className="icon-btn"><ZoomIn size={16} /></button>
          <button className="icon-btn"><Maximize2 size={16} /></button>
        </div>
      </header>

      <div className="doc-canvas">
        <div className="doc-placeholder">
          <div className="doc-inner">
            <h3>MEMORANDUM OF AGREEMENT</h3>
            <p className="muted">Document preview placeholder (frontend-only)</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DocumentPreview;
