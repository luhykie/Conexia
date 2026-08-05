import { apiRequest } from "./documentService";

export async function listSubmissionFiles(submissionId) {
  const result = await apiRequest(`/submissions/${submissionId}/files`);
  return result.data ?? [];
}

export async function uploadSubmissionFile(submissionId, file, category, notes = "") {
  const body = new FormData();
  body.append("file", file);
  body.append("category", category);
  if (notes) body.append("notes", notes);

  const result = await apiRequest(`/submissions/${submissionId}/files`, {
    method: "POST",
    body,
  });

  return result.data ?? result;
}

export async function getSubmissionFileBlob(submissionId, versionId) {
  const { data: sessionData, error } = await import("../supabaseConfig")
    .then(({ supabase }) => supabase.auth.getSession());

  if (error || !sessionData.session?.access_token) {
    throw error || new Error("Your authenticated session is missing or expired.");
  }

  const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
  const response = await fetch(
    `${apiBase}/submissions/${submissionId}/files/${versionId}`,
    { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }
  );

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || "Unable to retrieve the submission file.");
  }

  return response.blob();
}
