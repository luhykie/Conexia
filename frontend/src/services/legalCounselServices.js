import {
  apiGet,
  apiPatch,
  withQuery,
} from "../api/apiClient";

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

export function getNotarizationDocuments(params = {}) {
  return apiGet(withQuery("/legal/documents/notarization", params));
}

export function submitForNotarization(documentId, payload) {
  return apiPatch(
    `/legal/documents/${documentId}/notarization/submit`,
    payload
  );
}

export function completeNotarization(documentId, payload) {
  return apiPatch(
    `/legal/documents/${documentId}/notarization/complete`,
    payload
  );
}

export function getLegalHistory(params = {}) {
  return apiGet(withQuery("/legal/history", params));
}
