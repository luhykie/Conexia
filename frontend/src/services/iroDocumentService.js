import { apiGet, apiPost, withQuery } from "../api/apiClient";

// Loads documents waiting in the IRO review queue.
export function getIncomingDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/incoming", params));
}

// Loads one document and its current assignment details.
export function getIroDocument(documentId) {
  return apiGet(`/iro/documents/${documentId}`);
}

// Records that the current IRO Admin opened the document.
export function markIroDocumentViewed(documentId) {
  return apiPost(`/iro/documents/${documentId}/view`, {});
}

// Loads documents used by the IRO status and engagement registry.
export function getIroStatusDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/status", params));
}

// Loads active documents with at least one valid new destination.
export function getReassignableIroDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/reassignable", params));
}

// Loads the version and activity history of an IRO document.
export function getIroSubmissionHistory(documentId) {
  return apiGet(`/iro/documents/${documentId}/history`);
}
