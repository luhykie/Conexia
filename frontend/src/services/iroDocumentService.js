import { apiGet, apiPost, withQuery } from "../api/apiClient";

export function getIncomingDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/incoming", params));
}

export function getIroDocument(documentId) {
  return apiGet(`/iro/documents/${documentId}`);
}

export function markIroDocumentViewed(documentId) {
  return apiPost(`/iro/documents/${documentId}/view`, {});
}

export function getIroStatusDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/status", params));
}

export function getReassignableIroDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/reassignable", params));
}

export function getIroSubmissionHistory(documentId) {
  return apiGet(`/iro/documents/${documentId}/history`);
}
