import {
  apiGet,
  apiPatch,
  apiPost,
  withQuery,
} from "../api/apiClient";

export function getIncomingDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/incoming", params));
}

export function getIroDocument(documentId) {
  return apiGet(`/iro/documents/${documentId}`);
}

export function submitDocumentToIroAdmin(
  documentId,
  remarks = "",
) {
  return apiPatch(`/iro/documents/${documentId}/forward-to-admin`, {
    remarks,
  });
}

export function returnDocumentForCorrection(documentId, remarks) {
  return apiPatch(`/iro/documents/${documentId}/return-for-correction`, {
    remarks,
  });
}

export function markDocumentAsLogged(documentId) {
  return apiPatch(
    `/iro/documents/${documentId}/log`,
    {}
  );
}

export function assignDocumentToLegal(
  documentId,
  legalCounselId
) {
  return apiPatch(
    `/iro/documents/${documentId}/assign-legal`,
    {
      legal_counsel_id: legalCounselId,
    }
  );
}

export function returnAdminReviewForRevision(documentId, reason) {
  return apiPatch(`/iro/documents/${documentId}/admin-review/return`, { reason });
}

export function validateAdminReview(documentId, legalCounselId, comments = "") {
  return apiPatch(`/iro/documents/${documentId}/admin-review/validate`, {
    legal_counsel_id: legalCounselId,
    comments,
  });
}

export function reassignDocumentToLegal(
  documentId,
  destination,
  reason
) {
  return apiPatch(
    `/iro/documents/${documentId}/reassign-legal`,
    {
      destination_type: destination.type,
      destination_id: destination.id,
      reason,
    }
  );
}

export function getIroStatusDocuments(params = {}) {
  return apiGet(withQuery("/iro/documents/status", params));
}

export function createIroDocument(payload) {
  return apiPost("/iro/documents", payload);
}

export function archiveIroDocument(documentId) {
  return apiPatch(
    `/iro/documents/${documentId}/archive`,
    {}
  );
}

export function unarchiveIroDocument(documentId) {
  return apiPatch(
    `/iro/documents/${documentId}/unarchive`,
    {}
  );
}

export function getActiveLegalCounselUsers(params = {}) {
  return apiGet(
    withQuery("/users", {
      role: "legal_counsel",
      status: "active",
      per_page: 100,
      ...params,
    })
  );
}
