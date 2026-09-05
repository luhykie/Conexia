import { apiGet, apiPost, apiPatch, withQuery } from "../api/apiClient";

export function getLegalDashboard() {
  return apiGet("/legal/dashboard");
}

export function getReviewDocuments(params = {}) {
  return apiGet(withQuery("/legal/documents/review", params));
}

export function submitLegalDecision(documentId, payload) {
  return apiPatch(
    `/legal/documents/${documentId}/decision`,
    payload
  );
}

export function getLegalHistory(params = {}) {
  return apiGet(withQuery("/legal/history", params));
}

export function markLegalDocumentViewed(documentId, documentFileId) {
  return apiPost(`/iro/documents/${documentId}/history/viewed`, {
    document_file_id: documentFileId,
  });
}
