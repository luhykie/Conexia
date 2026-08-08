import {
  apiGet,
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

export function getDepartmentDocument(documentId) {
  return apiGet(`/department/documents/${documentId}`);
}

export function updateDepartmentDocument(documentId, payload) {
  return apiPatch(`/department/documents/${documentId}`, payload);
}

export function resubmitDepartmentDocument(documentId) {
  return apiPatch(
    `/department/documents/${documentId}/resubmit`,
    {}
  );
}
