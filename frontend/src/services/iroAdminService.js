import {
  apiGet,
  apiPatch,
  apiPost,
  apiPostForm,
  withQuery,
} from "../api/apiClient";

export function returnAdminReviewForRevision(documentId, reason) {
  return apiPatch(`/iro/documents/${documentId}/admin-review/return`, { reason });
}

export function validateAdminReview(documentId, legalCounselId, comments = "") {
  return apiPatch(`/iro/documents/${documentId}/admin-review/validate`, {
    legal_counsel_id: legalCounselId,
    comments,
  });
}

export function routeLegalCorrectionToDepartment(documentId) {
  return apiPatch(
    `/iro/documents/${documentId}/legal-correction/route-to-department`,
    {},
  );
}

export function reassignDocumentToLegal(documentId, destination, reason) {
  return apiPatch(`/iro/documents/${documentId}/reassign-legal`, {
    destination_type: destination.type,
    destination_id: destination.id,
    reason,
  });
}

export function createIroDocument(payload) {
  return apiPost("/iro/documents", payload);
}

export function updateIroEngagement(documentId, values, agreementFile = null) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    formData.append(key, value ?? "");
  });
  if (agreementFile) formData.append("agreement_file", agreementFile);

  return apiPostForm(`/iro/documents/${documentId}/engagement-edit`, formData);
}

export function unarchiveIroDocument(documentId) {
  return apiPatch(`/iro/documents/${documentId}/unarchive`, {});
}

export function getActiveLegalCounselUsers(params = {}) {
  return apiGet(withQuery("/users", {
    role: "legal_counsel",
    status: "active",
    per_page: 100,
    ...params,
  }));
}

export function getIroDocumentHistory(documentId) {
  return apiGet(`/iro/documents/${documentId}/history`);
}
