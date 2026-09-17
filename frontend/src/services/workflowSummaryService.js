import {
  apiGet,
  apiPatch,
  withQuery,
} from "../api/apiClient";

// Loads expiry totals and agreements requiring renewal attention.
export function getExpirySummary(params = {}) {
  return apiGet(withQuery("/expiry", params));
}

// Loads pending archival and archived records for IRO Admin.
export function getArchiveSummary(params = {}) {
  return apiGet(withQuery("/iro/archive", params));
}

// Loads IRO operational totals and department breakdowns.
export function getReportSummary(params = {}) {
  return apiGet(withQuery("/iro/reports", params));
}

// Marks an eligible agreement as requested for renewal.
export function requestDocumentRenewal(documentId) {
  return apiPatch(
    `/expiry/documents/${documentId}/renewal-request`,
    {},
  );
}
