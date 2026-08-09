import React from "react";
import { FileText } from "lucide-react";
import { Panel } from "./Panel";
import { Dropzone } from "./SharedViews";
import {
  deleteDocumentFile,
  downloadDocumentFile,
  getDocumentFiles,
  previewDocumentFile,
  uploadDocumentFile,
} from "../services/documentFileService";

export function DocumentFilesPanel({
  documentId,
  canUpload = false,
  canDelete = false,
}) {
  const [files, setFiles] = React.useState([]);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  async function loadFiles() {
    if (!documentId) return;

    setLoading(true);
    setError("");

    try {
      const response = await getDocumentFiles(documentId, { page });
      setFiles(response.files ?? response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (requestError) {
      setError(requestError.message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    setFiles([]);
    setSelectedFile(null);
    setError("");
    setSuccess("");
    loadFiles();
  }, [documentId, page]);

  async function uploadSelectedFile() {
    if (!selectedFile) {
      setError("Select a file first.");
      return;
    }

    setProcessing("upload");
    setError("");
    setSuccess("");

    try {
      await uploadDocumentFile(documentId, selectedFile);
      setSelectedFile(null);
      setSuccess("File uploaded successfully.");
      await loadFiles();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessing("");
    }
  }

  async function downloadFile(file) {
    setProcessing(file.id);
    setError("");

    try {
      await downloadDocumentFile(documentId, file.id, file.filename);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessing("");
    }
  }

  async function previewFile(file) {
    setProcessing(file.id);
    setError("");

    try {
      await previewDocumentFile(documentId, file.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessing("");
    }
  }

  async function removeFile(file) {
    const confirmed = window.confirm(`Delete ${file.filename}?`);

    if (!confirmed) return;

    setProcessing(file.id);
    setError("");
    setSuccess("");

    try {
      await deleteDocumentFile(documentId, file.id);
      setSuccess("File deleted successfully.");
      await loadFiles();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessing("");
    }
  }

  return (
    <Panel title="Document Files">
      {canUpload && (
        <>
          <Dropzone
            label={selectedFile?.name || "Attach agreement file"}
            detail="PDF, DOCX, ODT - MAX 25MB"
          />

          <input
            type="file"
            accept=".pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
            disabled={processing === "upload"}
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] || null)
            }
          />

          <button
            type="button"
            disabled={!selectedFile || processing === "upload"}
            onClick={uploadSelectedFile}
          >
            {processing === "upload" ? "Uploading..." : "Upload File"}
          </button>
        </>
      )}

      {loading && <p>Loading files...</p>}

      {error && <p className="auth-error">{error}</p>}

      {success && <p className="success-message">{success}</p>}

      {!loading && files.length === 0 && <p>No files uploaded.</p>}

      {files.map((file) => (
        <div className="file-row" key={file.id}>
          <span className="file-row__icon">
            <FileText size={22} />
          </span>

          <div className="file-row__content">
            <b>{file.filename}</b>
            <small>
              {formatMime(file.mime_type)} &bull; {formatBytes(file.size)}
            </small>
            <small>
              Uploaded{" "}
              {file.uploaded_at
                ? new Date(file.uploaded_at).toLocaleString()
                : "-"}
            </small>
            {file.uploader?.name && (
              <small>Uploaded by {file.uploader.name}</small>
            )}
          </div>

          <div className="file-row__actions">
            <button
              type="button"
              className="table-action"
              disabled={processing === file.id}
              onClick={() => previewFile(file)}
            >
              Preview
            </button>

            <button
              type="button"
              className="table-action"
              disabled={processing === file.id}
              onClick={() => downloadFile(file)}
            >
              Download
            </button>

            {canDelete && (
              <button
                type="button"
                className="table-action"
                disabled={processing === file.id}
                onClick={() => removeFile(file)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}

      {!loading && files.length > 0 && meta && (
        <div className="document-files-pagination">
          <footer>
            <span>
              Showing {meta.from || 0}-{meta.to || 0} of {meta.total} records
            </span>
            <div>
              <button
                disabled={meta.current_page <= 1}
                onClick={() => setPage(meta.current_page - 1)}
              >
                &lt;
              </button>
              <button className="active-page">{meta.current_page}</button>
              <button
                disabled={meta.current_page >= meta.last_page}
                onClick={() => setPage(meta.current_page + 1)}
              >
                &gt;
              </button>
            </div>
          </footer>
        </div>
      )}
    </Panel>
  );
}

function formatBytes(size) {
  if (!Number.isFinite(size)) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMime(mimeType) {
  if (!mimeType) return "File";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word")) return "DOCX";
  if (mimeType.includes("opendocument")) return "ODT";

  return mimeType;
}
