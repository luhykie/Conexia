import {
  apiGet,
  apiPatch,
  withQuery,
} from "../api/apiClient";

export function getExpirySummary(params = {}) {
  return apiGet(withQuery("/expiry", params));
}

export function getArchiveSummary(params = {}) {
  return apiGet(withQuery("/iro/archive", params));
}

export function getReportSummary(params = {}) {
  return apiGet(withQuery("/iro/reports", params));
}

export function requestDocumentRenewal(documentId) {
  return apiPatch(
    `/expiry/documents/${documentId}/renewal-request`,
    {},
  );
}
