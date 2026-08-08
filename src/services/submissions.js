import { apiRequest } from "./api";
import { getAuthToken } from "../utils/authToken";
import { addLocalSubmission, deleteLocalSubmission, listLocalSubmissions, updateLocalSubmission } from "../lib/submissionFallback";

function isBackendUnavailable(error) {
  const message = String(error?.message || "");
  return message.includes("Unable to reach the backend at") || message.includes("Failed to fetch");
}

function createLocalSubmissionPayload(account, payload, status = "draft") {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}`,
    submitted_by: account?.id || null,
    office: account?.office || "",
    department: account?.department || "",
    tracking_number: payload?.tracking_number || "",
    partner_institution_name: payload?.partner_institution_name || payload?.partnerInstitutionName || "",
    agreement_type: payload?.agreement_type || payload?.agreementType || "",
    submission_type: payload?.submission_type || payload?.submissionType || "",
    partner_classification: payload?.partner_classification || payload?.partnerClassification || "",
    agreement_title: payload?.agreement_title || payload?.title || payload?.agreementType || "",
    title: payload?.title || payload?.agreement_title || payload?.agreementType || "",
    expected_duration: payload?.expected_duration || "",
    partner_contact_email: payload?.partner_contact_email || "",
    contact_email: payload?.contact_email || payload?.partner_contact_email || "",
    contact_person: payload?.contact_person || "",
    contact_position: payload?.contact_position || "",
    contact_number: payload?.contact_number || "",
    requested_completion_date: payload?.requested_completion_date || "",
    urgency_level: payload?.urgency_level || "",
    requested_by_name: payload?.requested_by_name || account?.fullName || "",
    requested_by_date: payload?.requested_by_date || now.split("T")[0],
    noted_by_name: payload?.noted_by_name || "",
    noted_by_date: payload?.noted_by_date || "",
    storage_path: payload?.storage_path || null,
    file_name: payload?.file_name || null,
    attachments: payload?.storage_path
      ? [{
          id: `attachment-${Date.now()}`,
          file_name: payload?.file_name || null,
          storage_path: payload?.storage_path || null,
          mime_type: payload?.mime_type || null,
          file_size: payload?.file_size || null,
        }]
      : payload?.attachments || [],
    status,
    current_stage: status === "draft" ? "draft" : payload?.current_stage || "iro_staff",
    created_at: now,
    updated_at: now,
  };
}

export async function createSubmission(account, payload) {
  try {
    return await apiRequest("/api/submissions", {
      account,
      method: "POST",
      body: payload,
    });
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    const local = addLocalSubmission(createLocalSubmissionPayload(account, payload, payload?.status || "pending_iro_staff_review"));
    return { data: local };
  }
}

export async function createDraftSubmission(account, payload) {
  try {
    return await apiRequest("/api/submissions", {
      account,
      method: "POST",
      body: { ...payload, draft: true },
    });
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    const local = addLocalSubmission(createLocalSubmissionPayload(account, payload, "draft"));
    return { data: local };
  }
}

export async function listSubmissions(account, params = {}) {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  try {
    return await apiRequest(`/api/submissions${suffix}`, { account });
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    let submissions = listLocalSubmissions();
    if (params.status) {
      const status = String(params.status).replace(/^eq\./, "");
      if (status.startsWith("in.(") && status.endsWith(")")) {
        const allowed = status.slice(4, -1).split(",").map((value) => value.trim());
        submissions = submissions.filter((row) => allowed.includes(row.status));
      } else {
        submissions = submissions.filter((row) => row.status === status);
      }
    }
    if (params.department) {
      const department = String(params.department).replace(/^eq\./, "");
      submissions = submissions.filter((row) => row.department === department);
    }
    return { data: submissions };
  }
}

export async function getSubmission(account, submissionId) {
  try {
    return await apiRequest(`/api/submissions/${submissionId}`, { account });
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    const local = listLocalSubmissions((row) => String(row.id) === String(submissionId))[0] || null;
    return { data: local };
  }
}

export async function updateSubmission(account, submissionId, payload) {
  try {
    return await apiRequest(`/api/submissions/${submissionId}`, {
      account,
      method: "PATCH",
      body: payload,
    });
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    const updated = updateLocalSubmission(submissionId, (row) => ({
      ...row,
      ...payload,
      updated_at: new Date().toISOString(),
    }));
    return { data: updated };
  }
}

export async function updateSubmissionStatus(account, submissionId, status, notes = "") {
  try {
    return await apiRequest(`/api/submissions/${submissionId}/status`, {
      account,
      method: "PATCH",
      body: { status, notes },
    });
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    const updated = updateLocalSubmission(submissionId, (row) => ({
      ...row,
      status,
      notes: notes || row.notes,
      updated_at: new Date().toISOString(),
    }));
    return { data: updated };
  }
}

export async function deleteSubmission(account, submissionId) {
  try {
    return await apiRequest(`/api/submissions/${submissionId}`, {
      account,
      method: "DELETE",
    });
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    deleteLocalSubmission(submissionId);
    return { data: null };
  }
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

// Returns the authenticated endpoint for the selected submission's PDF.
export async function getSubmissionFile(account, submissionId) {
  return apiRequest(`/api/submissions/${submissionId}/document`, { account });
}

export async function getSubmissionReviewData(account, submissionId) {
  return apiRequest(`/api/submissions/${submissionId}/review`, { account });
}

export async function uploadSubmissionAttachment(account, submissionId, file) {
  const formData = new FormData();
  formData.append('attachment', file);

  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/submissions/${submissionId}/attachment`, {
    method: 'POST',
    headers,
    body: formData,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Unable to upload attachment.';
    const details = payload?.errors ? Object.values(payload.errors).flat().join(' ') : '';
    throw new Error(`HTTP ${response.status}: ${details ? `${message} ${details}` : message}`);
  }

  return {
    storagePath: payload?.data?.storage_path || null,
    fileName: payload?.data?.file_name || file.name,
    mimeType: file.type || null,
    fileSize: file.size || null,
  };
}

export async function createReviewComment(account, submissionId, payload) {
  return apiRequest(`/api/submissions/${submissionId}/review/comments`, {
    account,
    method: "POST",
    body: payload,
  });
}

export async function updateReviewComment(account, submissionId, commentId, payload) {
  return apiRequest(`/api/submissions/${submissionId}/review/comments/${commentId}`, {
    account,
    method: "PATCH",
    body: payload,
  });
}

export async function deleteReviewComment(account, submissionId, commentId) {
  return apiRequest(`/api/submissions/${submissionId}/review/comments/${commentId}`, {
    account,
    method: "DELETE",
  });
}

export async function createReviewAnnotation(account, submissionId, payload) {
  return apiRequest(`/api/submissions/${submissionId}/review/annotations`, {
    account,
    method: "POST",
    body: payload,
  });
}
