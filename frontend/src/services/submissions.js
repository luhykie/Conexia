import {
  apiGet,
  apiPost,
  apiPatch,
  apiPostForm,
  withQuery,
} from "../api/apiClient";

export function listSubmissions(params = {}) {
  return apiGet(withQuery("/submissions", params));
}

export function getSubmission(submissionId) {
  return apiGet(`/submissions/${submissionId}`);
}

export function createDraftSubmission(payload) {
  return apiPost("/submissions", {
    ...payload,
    draft: true,
  });
}

export function updateSubmission(submissionId, payload) {
  return apiPatch(`/submissions/${submissionId}`, payload);
}

export function uploadSubmissionAttachment(submissionId, file) {
  const formData = new FormData();
  formData.append("attachment", file);

  return apiPostForm(`/submissions/${submissionId}/attachment`, formData);
}

export function getSubmissionFile(submissionId) {
  return apiGet(`/submissions/${submissionId}/document`);
}

export function getSubmissionReviewData(submissionId) {
  return apiGet(`/submissions/${submissionId}/review`);
}
