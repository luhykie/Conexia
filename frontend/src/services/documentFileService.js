import {
  apiDelete,
  apiGet,
  apiGetBlob,
  apiPatch,
  apiPostForm,
  apiPost,
  withQuery,
} from "../api/apiClient";

export function getDocumentFiles(documentId, params = {}) {
  return apiGet(
    withQuery(`/documents/${documentId}/files`, params)
  );
}

export function uploadDocumentFile(documentId, file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiPostForm(
    `/documents/${documentId}/files`,
    formData
  );
}

export async function downloadDocumentFile(
  documentId,
  fileId,
  filename
) {
  const { blob, response } = await apiGetBlob(
    `/documents/${documentId}/files/${fileId}/download`
  );

  const downloadName =
    filename || filenameFromDisposition(response) || "document";
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
}

export async function previewDocumentFile(
  documentId,
  fileId
) {
  const { blob } = await apiGetBlob(
    `/documents/${documentId}/files/${fileId}/preview`
  );

  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60000);
}

export function deleteDocumentFile(documentId, fileId) {
  return apiDelete(
    `/documents/${documentId}/files/${fileId}`
  );
}

export async function getDocumentPreviewBlob(documentId, fileId) {
  const { blob } = await apiGetBlob(
    `/documents/${documentId}/files/${fileId}/preview`
  );

  return blob;
}

export function getDocumentAnnotations(documentId, fileId) {
  return apiGet(`/documents/${documentId}/files/${fileId}/annotations`);
}

export function createDocumentAnnotation(documentId, fileId, annotation) {
  return apiPost(
    `/documents/${documentId}/files/${fileId}/annotations`,
    annotation,
  );
}

export function updateDocumentAnnotation(documentId, fileId, annotationId, comment) {
  return apiPatch(
    `/documents/${documentId}/files/${fileId}/annotations/${annotationId}`,
    { comment },
  );
}

export function removeDocumentAnnotation(documentId, fileId, annotationId) {
  return apiDelete(
    `/documents/${documentId}/files/${fileId}/annotations/${annotationId}`,
  );
}

function filenameFromDisposition(response) {
  const disposition = response.headers.get(
    "Content-Disposition"
  );

  if (!disposition) return null;

  const match = disposition.match(/filename="?([^"]+)"?/i);

  return match?.[1] || null;
}
