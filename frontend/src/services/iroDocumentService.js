import { apiGet, withQuery } from "../api/apiClient";

export function getIncomingDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/incoming", params));
}

export function getIroDocument(documentId) {
  return apiGet(`/iro/documents/${documentId}`);
}

export function getIroStatusDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/status", params));
}

export function getIroSubmissionHistory(documentId) {
  return apiGet(`/iro/documents/${documentId}/history`);
}
