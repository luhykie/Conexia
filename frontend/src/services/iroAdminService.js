import {
  apiGet,
  apiPatch,
  apiPost,
  apiPostForm,
  withQuery,
} from "../api/apiClient";

// Returns a logged document to its owner for revision.
export function returnAdminReviewForRevision(documentId, reason) {
  return apiPatch(`/iro/documents/${documentId}/admin-review/return`, { reason });
}

// Validates IRO review and routes the document to Legal Counsel.
export function validateAdminReview(documentId, legalCounselId, comments = "") {
  return apiPatch(`/iro/documents/${documentId}/admin-review/validate`, {
    legal_counsel_id: legalCounselId,
    comments,
  });
}

// Releases Legal's correction request to the originating department.
export function routeLegalCorrectionToDepartment(documentId) {
  return apiPatch(
    `/iro/documents/${documentId}/legal-correction/route-to-department`,
    {},
  );
}

// Changes the document's current workflow destination.
export function reassignDocumentToLegal(documentId, destination, reason) {
  return apiPatch(`/iro/documents/${documentId}/reassign-legal`, {
    destination_type: destination.type,
    destination_id: destination.id,
    reason,
  });
}

// Creates a new engagement owned directly by IRO Admin.
export function createIroDocument(payload) {
  return apiPost("/iro/documents", payload);
}

// Updates engagement metadata and optionally uploads a new file version.
export function updateIroEngagement(documentId, values, agreementFile = null) {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    formData.append(key, value ?? "");
  });
  if (agreementFile) formData.append("agreement_file", agreementFile);

  return apiPostForm(`/iro/documents/${documentId}/engagement-edit`, formData);
}

// Restores an archived document to pending archival.
export function unarchiveIroDocument(documentId) {
  return apiPatch(`/iro/documents/${documentId}/unarchive`, {});
}

// Moves an approved document into the archive.
export function archiveIroDocument(documentId) {
  return apiPatch(`/iro/documents/${documentId}/archive`, {});
}

// Loads active Legal Counsel accounts for assignment dropdowns.
export function getActiveLegalCounselUsers(params = {}) {
  return apiGet(withQuery("/users", {
    role: "legal_counsel",
    status: "active",
    per_page: 100,
    ...params,
  }));
}

// Loads document versions and their recorded history events.
export function getIroDocumentHistory(documentId) {
  return apiGet(`/iro/documents/${documentId}/history`);
}

// Records that a specific document version was opened.
export function markIroDocumentVersionViewed(documentId, documentFileId) {
  return apiPost(`/iro/documents/${documentId}/history/viewed`, {
    document_file_id: documentFileId,
  });
}
