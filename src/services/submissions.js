import { apiRequest } from "./api";

export async function createSubmission(account, payload) {
  return apiRequest("/api/submissions", {
    account,
    method: "POST",
    body: payload,
  });
}

export async function createDraftSubmission(account, payload) {
  return apiRequest("/api/submissions", {
    account,
    method: "POST",
    body: { ...payload, draft: true },
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

export async function updateSubmission(account, submissionId, payload) {
  return apiRequest(`/api/submissions/${submissionId}`, {
    account,
    method: "PATCH",
    body: payload,
  });
}

export async function updateSubmissionStatus(account, submissionId, status, notes = "") {
  return apiRequest(`/api/submissions/${submissionId}/status`, {
    account,
    method: "PATCH",
    body: { status, notes },
  });
}

export async function generateNotarizationForm(account, submissionId) {
  return apiRequest(`/api/submissions/${submissionId}/notarization-form`, {
    account,
    method: "POST",
  });
}

export async function archiveSubmission(account, submissionId) {
  return apiRequest(`/api/submissions/${submissionId}/archive`, {
    account,
    method: "POST",
  });
}

export async function distributeSubmission(account, submissionId) {
  return apiRequest(`/api/submissions/${submissionId}/distribute`, {
    account,
    method: "POST",
  });
}

// Returns a short-lived signed URL to the attached file. The backend enforces
// who is allowed to call this - IRO Staff will get a 403, by design, since
// they route submissions based on the filled-out form only, not the file.
export async function getSubmissionFile(account, submissionId) {
  return apiRequest(`/api/submissions/${submissionId}/file`, { account });
}
