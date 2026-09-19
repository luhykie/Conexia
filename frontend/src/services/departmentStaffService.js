import {
  apiGet,
  apiDelete,
  apiPatch,
  apiPost,
  withQuery,
} from "../api/apiClient";

// Gets Department submissions for tracking and resubmission screens.
// Hint: kani nga endpoints support the Department-owned workflow.
export function createDepartmentDocument(payload) {
  return apiPost("/department/documents", payload);
}

export function getDepartmentDocuments(params = {}) {
  return apiGet(withQuery("/department/documents", params));
}

export function resubmitDepartmentDocument(documentId, corrections = {}) {
  return apiPatch(
    `/department/documents/${documentId}/resubmit`,
    corrections
  );
}

// Department document history ni; used when staff checks versions and viewed events.
export function getDepartmentReview(documentId) {
  return apiGet(`/department/documents/${documentId}/review`);
}

export function getDepartmentHistory(documentId) {
  return apiGet(`/department/documents/${documentId}/history`);
}

// Records a Department user's viewed document version in the history timeline.
export function markDepartmentDocumentViewed(documentId, documentFileId) {
  return apiPost(`/department/documents/${documentId}/history/viewed`, {
    document_file_id: documentFileId,
  });
}

// Department review items hold highlights/comments before routing or correction.
export function createDepartmentReviewItem(documentId, payload) {
  return apiPost(`/department/documents/${documentId}/review/items`, payload);
}

export function approveDepartmentReview(documentId) {
  return apiPatch(`/department/documents/${documentId}/review/approve`, {});
}

export function requestDepartmentCorrection(documentId, comment) {
  return apiPatch(`/department/documents/${documentId}/review/correction`, { comment });
}

export function routeDepartmentReviewToAdmin(documentId) {
  return apiPatch(`/department/documents/${documentId}/review/route-to-admin`, {});
}

export function updateDepartmentReviewHighlight(documentId, itemId, payload) {
  return apiPatch(`/department/documents/${documentId}/review/items/${itemId}`, payload);
}

export function deleteDepartmentReviewItem(documentId, itemId) {
  return apiDelete(`/department/documents/${documentId}/review/items/${itemId}`);
}

export function getDepartmentDiscussion(documentId) { return apiGet(`/department/documents/${documentId}/discussion`); }
export function sendDepartmentDiscussionMessage(documentId, message) { return apiPost(`/department/documents/${documentId}/discussion`, { message }); }
