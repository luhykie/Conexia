// [FEATURE: Legal Review & Notarization] - supports legal review decisions and notarization workflow data.
import { apiGet, apiPost, apiPatch, withQuery } from "../api/apiClient";

// Retrieves legal dashboard within the legal review decisions and notarization workflow.
export function getLegalDashboard() {
  return apiGet("/legal/dashboard");
}

// Loads Legal review queue data.
// Hint: this is the source for documents awaiting Legal action.
export function getReviewDocuments(params = {}) {
  return apiGet(withQuery("/legal/documents/review", params));
}

// Sends Legal approval or correction decisions without changing Department submission data.
export function submitLegalDecision(documentId, payload) {
  return apiPatch(
    `/legal/documents/${documentId}/decision`,
    payload
  );
}

// Loads Legal history filters and timeline records.
export function getLegalHistory(params = {}) {
  return apiGet(withQuery("/legal/history", params));
}

// Records the Legal reviewer opening a document version for audit history.
export function markLegalDocumentViewed(documentId, documentFileId) {
  return apiPost(`/iro/documents/${documentId}/history/viewed`, {
    document_file_id: documentFileId,
  });
}
