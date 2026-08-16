import {
  apiGet,
  apiDelete,
  apiPatch,
  apiPost,
  withQuery,
} from "../api/apiClient";

export function createDepartmentDocument(payload) {
  return apiPost("/department/documents", payload);
}

export function getDepartmentDocuments(params = {}) {
  return apiGet(withQuery("/department/documents", params));
}

export function resubmitDepartmentDocument(documentId) {
  return apiPatch(
    `/department/documents/${documentId}/resubmit`,
    {}
  );
}

export function getDepartmentReview(documentId) {
  return apiGet(`/department/documents/${documentId}/review`);
}

export function getDepartmentHistory(documentId) {
  return apiGet(`/department/documents/${documentId}/history`);
}

export function createDepartmentReviewItem(documentId, payload) {
  return apiPost(`/department/documents/${documentId}/review/items`, payload);
}

export function approveDepartmentReview(documentId) {
  return apiPatch(`/department/documents/${documentId}/review/approve`, {});
}

export function requestDepartmentCorrection(documentId, comment) {
  return apiPatch(`/department/documents/${documentId}/review/correction`, { comment });
}

export function routeDepartmentReviewToStaff(documentId) {
  return apiPatch(`/department/documents/${documentId}/review/route-to-staff`, {});
}

export function updateDepartmentReviewHighlight(documentId, itemId, payload) {
  return apiPatch(`/department/documents/${documentId}/review/items/${itemId}`, payload);
}

export function deleteDepartmentReviewItem(documentId, itemId) {
  return apiDelete(`/department/documents/${documentId}/review/items/${itemId}`);
}

export function getDepartmentDiscussion(documentId) { return apiGet(`/department/documents/${documentId}/discussion`); }
export function sendDepartmentDiscussionMessage(documentId, message) { return apiPost(`/department/documents/${documentId}/discussion`, { message }); }
