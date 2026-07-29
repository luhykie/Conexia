import { supabase } from "../supabaseConfig";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

async function getAccessToken(forceRefresh = false) {
  const result = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();

  if (result.error) {
    throw result.error;
  }

  if (!result.data.session?.access_token) {
    throw new Error(
      "Your authenticated session is missing or expired. Please sign in again."
    );
  }

  return result.data.session.access_token;
}

async function sendRequest(path, options, accessToken) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(!isFormData && { "Content-Type": "application/json" }),
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => null);

  return { response, result };
}

export async function apiRequest(path, options = {}) {
  let accessToken = await getAccessToken();
  let { response, result } = await sendRequest(
    path,
    options,
    accessToken
  );

  if (response.status === 401) {
    accessToken = await getAccessToken(true);
    ({ response, result } = await sendRequest(
      path,
      options,
      accessToken
    ));
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        `Request failed with status ${response.status}.`
    );
  }

  return result;
}

function announceWorkflowChange() {
  window.dispatchEvent(new CustomEvent("conexia:workflow-changed"));
}

/* ===========================================================
   GENERAL DOCUMENTS
=========================================================== */

export async function getDocuments() {
  const result = await apiRequest("/documents");
  return result.data ?? result;
}

export async function getDocumentById(documentId) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  const result = await apiRequest(
    `/documents/${documentId}`
  );

  return result.data ?? result;
}

export async function getDocumentFileBlob(documentId, fileId) {
  if (!documentId || !fileId) {
    throw new Error("Document and file IDs are required.");
  }

  async function fetchFile(accessToken) {
    return fetch(
      `${API_BASE_URL}/documents/${documentId}/files/${fileId}/view`,
      {
        headers: {
          Accept: "*/*",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  }

  let response = await fetchFile(await getAccessToken());
  if (response.status === 401) {
    response = await fetchFile(await getAccessToken(true));
  }

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(
      result?.message ||
        `Unable to open the attachment (status ${response.status}).`
    );
  }

  return response.blob();
}

export async function getReviewForm(documentId) {
  const result = await apiRequest(
    `/documents/${documentId}/review-form`
  );
  return result.data ?? null;
}

export async function saveReviewForm(documentId, form) {
  const result = await apiRequest(
    `/documents/${documentId}/review-form`,
    {
      method: "PUT",
      body: JSON.stringify(form),
    }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function submitReviewForm(documentId, form) {
  const result = await apiRequest(
    `/documents/${documentId}/review-form/submit`,
    {
      method: "POST",
      body: JSON.stringify(form),
    }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function validateReviewForm(documentId, adminRemarks) {
  const result = await apiRequest(
    `/documents/${documentId}/review-form/validate`,
    {
      method: "PATCH",
      body: JSON.stringify({
        admin_remarks: adminRemarks?.trim() || null,
      }),
    }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function sendBackReviewForm(
  documentId,
  reason,
  adminRemarks
) {
  const result = await apiRequest(
    `/documents/${documentId}/review-form/send-back`,
    {
      method: "PATCH",
      body: JSON.stringify({
        reason: reason.trim(),
        admin_remarks: adminRemarks?.trim() || null,
      }),
    }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

/* ===========================================================
   DEPARTMENT STAFF
=========================================================== */

export async function submitDocument(formData) {
  if (!formData) {
    throw new Error("Document form data is required.");
  }

  const payload = {
    tracking_number:
      formData.tracking_number ||
      formData.trackingNumber,

    title: formData.title,

    document_type:
      formData.document_type ||
      formData.documentType,

    partner_institution:
      formData.partner_institution ||
      formData.partnerInstitution,

    partner_email:
      formData.partner_email ||
      formData.partnerEmail ||
      null,

    description: formData.description || null,
    file: formData.file,
  };

  if (!payload.tracking_number) {
    throw new Error("Tracking number is required.");
  }

  if (!payload.title) {
    throw new Error("Document title is required.");
  }

  if (!payload.document_type) {
    throw new Error("Document type is required.");
  }

  if (!payload.partner_institution) {
    throw new Error(
      "Partner institution is required."
    );
  }

  if (!payload.file) {
    throw new Error("The original document file is required.");
  }

  const body = new FormData();
  body.append("tracking_number", payload.tracking_number);
  body.append("title", payload.title);
  body.append("document_type", payload.document_type);
  body.append("partner_institution", payload.partner_institution);
  body.append("file", payload.file);

  if (payload.partner_email) {
    body.append("partner_email", payload.partner_email);
  }

  if (payload.description) {
    body.append("description", payload.description);
  }

  const result = await apiRequest("/documents", {
    method: "POST",
    body,
  });
  announceWorkflowChange();

  return result.data ?? result;
}

export async function getDepartmentDocuments(
  departmentId
) {
  if (!departmentId) {
    throw new Error("Department ID is required.");
  }

  const result = await apiRequest(
    `/departments/${departmentId}/documents`
  );

  return result.data ?? result;
}

/* ===========================================================
   IRO STAFF
=========================================================== */

export async function getIncomingDocuments() {
  const result = await apiRequest(
    "/iro-staff/incoming"
  );

  return result.data ?? result;
}

export async function getIroStaffDashboard() {
  const result = await apiRequest(
    "/iro-staff/dashboard"
  );

  return result.data ?? result;
}

export async function logDocument(documentId) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  const result = await apiRequest(
    `/documents/${documentId}/log`,
    {
      method: "PATCH",
    }
  );
  announceWorkflowChange();

  return result.data ?? result;
}

export async function resubmitRevision(documentId, file) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }
  if (!file) {
    throw new Error("A corrected document file is required.");
  }

  const body = new FormData();
  body.append("file", file);

  const result = await apiRequest(
    `/documents/${documentId}/resubmit-revision`,
    { method: "POST", body }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function checkRevision(documentId) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  const result = await apiRequest(
    `/documents/${documentId}/check-revision`,
    { method: "PATCH" }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

/* ===========================================================
   IRO ADMIN
=========================================================== */

export async function getLoggedDocuments() {
  const result = await apiRequest(
    "/iro-admin/manage-submissions"
  );

  return result.data ?? result;
}

export async function getIroAdminOverview() {
  const result = await apiRequest("/iro-admin/overview");
  return result.data ?? result;
}

export async function getLegalCounsels() {
  const result = await apiRequest(
    "/legal-counsels"
  );

  return result.data ?? result;
}

export async function routeToLegal(
  documentId,
  legalCounselId
) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  if (!legalCounselId) {
    throw new Error(
      "Legal Counsel ID is required."
    );
  }

  const result = await apiRequest(
    `/documents/${documentId}/route-to-legal`,
    {
      method: "PATCH",
      body: JSON.stringify({
        legal_counsel_id: legalCounselId,
      }),
    }
  );
  announceWorkflowChange();

  return result.data ?? result;
}

/* ===========================================================
   LEGAL COUNSEL
=========================================================== */

export async function getLegalReviewQueue() {
  const result = await apiRequest(
    "/legal-counsel/review-queue"
  );

  return result.data ?? result;
}

export async function approveDocument(documentId) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  const result = await apiRequest(
    `/documents/${documentId}/approve`,
    {
      method: "PATCH",
    }
  );
  announceWorkflowChange();

  return result.data ?? result;
}

export async function requestCorrections(
  documentId,
  remarks
) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  if (!remarks?.trim()) {
    throw new Error(
      "Correction remarks are required."
    );
  }

  const result = await apiRequest(
    `/documents/${documentId}/request-corrections`,
    {
      method: "PATCH",
      body: JSON.stringify({
        remarks: remarks.trim(),
      }),
    }
  );
  announceWorkflowChange();

  return result.data ?? result;
}
