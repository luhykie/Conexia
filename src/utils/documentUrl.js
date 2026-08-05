const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function submissionHasAttachment(submission) {
  if (!submission) return false;
  if (submission.storage_path || submission.file_name) return true;
  if (Array.isArray(submission.attachments) && submission.attachments.length > 0) return true;
  if (Array.isArray(submission.versions) && submission.versions.length > 0) return true;
  return false;
}

export function submissionDocumentEndpoint(submissionId) {
  return `/api/submissions/${submissionId}/file/download`;
}

export function resolveSubmissionDocumentUrl(submission, urlFromApi) {
  const submissionId = submission?.id;

  if (urlFromApi?.startsWith("data:")) {
    return urlFromApi;
  }

  const raw = urlFromApi || (submissionId ? submissionDocumentEndpoint(submissionId) : null);
  if (!raw) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/api/") && import.meta.env.DEV && !API_BASE) {
        return parsed.pathname;
      }
    } catch {
      return raw;
    }
    return raw;
  }

  if (raw.startsWith("/")) {
    if (import.meta.env.DEV && !API_BASE) return raw;
    return API_BASE ? `${API_BASE}${raw}` : raw;
  }

  return submissionId ? (API_BASE ? `${API_BASE}${submissionDocumentEndpoint(submissionId)}` : submissionDocumentEndpoint(submissionId)) : raw;
}

export { submissionHasAttachment };
