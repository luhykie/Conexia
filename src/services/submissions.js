import { apiRequest } from "./api";

export async function createSubmission(account, payload) {
  return apiRequest("/api/submissions", {
    account,
    method: "POST",
    body: payload,
  });
}

export async function listSubmissions(account, params = {}) {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  return apiRequest(`/api/submissions${suffix}`, { account });
}

export async function getSubmission(account, submissionId) {
  return apiRequest(`/api/submissions/${submissionId}`, { account });
}

export async function updateSubmissionStatus(account, submissionId, status, notes = "") {
  return apiRequest(`/api/submissions/${submissionId}/status`, {
    account,
    method: "PATCH",
    body: { status, notes },
  });
}
