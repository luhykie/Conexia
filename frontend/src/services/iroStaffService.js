import { apiPatch } from "../api/apiClient";

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
