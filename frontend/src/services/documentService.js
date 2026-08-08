import { supabase } from "../supabaseConfig";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

const API_TIMEOUT_MS = 15000;

function withTimeout(promise, message, timeoutMs = API_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error(message)),
      timeoutMs
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function createRequestSignal(externalSignal, timeoutMs = API_TIMEOUT_MS) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  return externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;
}

function connectionError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return new Error(
      "The server took too long to respond. Confirm that the API is running, then try again."
    );
  }

  return new Error(
    "Unable to connect to the server. Confirm that the API is running, then try again."
  );
}

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;

async function getAccessToken(forceRefresh = false) {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (
    !forceRefresh &&
    cachedAccessToken &&
    cachedAccessTokenExpiresAt > nowInSeconds + 30
  ) {
    return cachedAccessToken;
  }

  const sessionRequest = forceRefresh
    ? supabase.auth.refreshSession()
    : supabase.auth.getSession();

  const result = await withTimeout(
    sessionRequest,
    "Authentication took too long. Please sign in again."
  );

  if (result.error) {
    if (forceRefresh) {
      cachedAccessToken = "";
      cachedAccessTokenExpiresAt = 0;

      window.dispatchEvent(
        new CustomEvent("conexia:auth-expired")
      );
    }

    throw result.error;
  }

  const session = result.data.session;

  if (!session?.access_token) {
    cachedAccessToken = "";
    cachedAccessTokenExpiresAt = 0;

    window.dispatchEvent(
      new CustomEvent("conexia:auth-expired")
    );

    throw new Error("Your session has expired.");
  }

  cachedAccessToken = session.access_token;
  cachedAccessTokenExpiresAt = session.expires_at || 0;

  return cachedAccessToken;
}

async function sendRequest(path, options, accessToken) {
  const isFormData = options.body instanceof FormData;
  const { requestTimeoutMs = API_TIMEOUT_MS, ...fetchOptions } = options;
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      signal: createRequestSignal(options.signal, requestTimeoutMs),
      headers: {
        Accept: "application/json",
        ...(!isFormData && { "Content-Type": "application/json" }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw connectionError(error);
  }

  const result = await response.json().catch(() => null);

  return { response, result };
}

const pendingGetRequests = new Map();

supabase.auth.onAuthStateChange((event, session) => {
  if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
    cachedAccessToken = session?.access_token || "";
    cachedAccessTokenExpiresAt = session?.expires_at || 0;
  }

  if (event === "SIGNED_OUT" || !session) {
    cachedAccessToken = "";
    cachedAccessTokenExpiresAt = 0;
  }

  // Never reuse an in-flight GET started under a different authenticated user.
  pendingGetRequests.clear();
});

export function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  if (method === "GET" && pendingGetRequests.has(path)) {
    return pendingGetRequests.get(path);
  }

  const request = withTimeout((async () => {
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
  })(), "The request took too long. Please try again.", options.requestTimeoutMs);

  if (method !== "GET") {
    return request;
  }

  const trackedRequest = request.finally(() => {
    if (pendingGetRequests.get(path) === trackedRequest) {
      pendingGetRequests.delete(path);
    }
  });
  pendingGetRequests.set(path, trackedRequest);

  return trackedRequest;
}

function announceWorkflowChange() {
  window.dispatchEvent(new CustomEvent("conexia:workflow-changed"));
  localStorage.setItem("conexia-workflow-changed-at", String(Date.now()));
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
    try {
      return await fetch(
        `${API_BASE_URL}/documents/${documentId}/files/${fileId}/view`,
        {
          signal: createRequestSignal(),
          headers: {
            Accept: "*/*",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    } catch (error) {
      throw connectionError(error);
    }
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

export async function validateReviewForm(documentId, adminRemarks, checklistAnswers) {
  const result = await apiRequest(
    `/documents/${documentId}/review-form/validate`,
    {
      method: "PATCH",
      body: JSON.stringify({
        admin_remarks: adminRemarks?.trim() || null,
        checklist_answers: checklistAnswers,
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

export async function getIroStaffDashboard(includeIncoming = false) {
  const result = await apiRequest(
    `/iro-staff/dashboard${includeIncoming ? "?include_incoming=1" : ""}`
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

export async function resubmitRevision(documentId, file, revisionNote = "") {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }
  if (!file) {
    throw new Error("A corrected document file is required.");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("revision_note", revisionNote.trim());

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

export async function getIroStaffDocuments() {
  const result = await apiRequest("/iro-staff/documents");
  return result.data ?? result;
}

export async function getSubmissionById(submissionId) {
  const result = await apiRequest(`/documents/${submissionId}`);
  return result.data ?? result;
}

let reportsRequest = null;

export async function getIroAdminReports() {
  if (!reportsRequest) {
    reportsRequest = apiRequest("/iro-admin/reports")
      .then((result) => result.data ?? result)
      .finally(() => {
        reportsRequest = null;
      });
  }

  return reportsRequest;
}

export async function reassignSubmission(documentId, reason) {
  if (!documentId || !reason?.trim()) {
    throw new Error("Document and reassignment reason are required.");
  }

  const result = await apiRequest(
    `/iro-admin/documents/${documentId}/reassign`,
    {
      method: "PATCH",
      body: JSON.stringify({
        reason: reason.trim(),
      }),
    }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function archiveDocument(documentId) {
  const result = await apiRequest(
    `/iro-admin/documents/${documentId}/archive`,
    { method: "PATCH" }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function getDistributionRecipients(documentType = "") {
  const query = documentType
    ? `?document_type=${encodeURIComponent(documentType)}`
    : "";
  const result = await apiRequest(
    `/iro-admin/distribution-recipients${query}`
  );
  return result.data ?? result;
}

export async function createDistributionRecipient(values) {
  const result = await apiRequest(
    "/iro-admin/distribution-recipients",
    {
      method: "POST",
      body: JSON.stringify(values),
    }
  );
  return result.data ?? result;
}

export async function updateDistributionRecipient(recipientId, values) {
  const result = await apiRequest(
    `/iro-admin/distribution-recipients/${recipientId}`,
    {
      method: "PUT",
      body: JSON.stringify(values),
    }
  );
  return result.data ?? result;
}

export async function getDocumentDistributions() {
  const result = await apiRequest("/iro-admin/document-distributions");
  return result.data ?? result;
}

export async function prepareDocumentDistribution(documentId) {
  const result = await apiRequest(
    `/iro-admin/documents/${documentId}/distribution/prepare`,
    { method: "POST" }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function markDistributionDelivered(
  documentId,
  distributionId,
  deliveryNotes = ""
) {
  const result = await apiRequest(
    `/iro-admin/documents/${documentId}/distribution/${distributionId}/delivered`,
    {
      method: "PATCH",
      body: JSON.stringify({
        delivery_notes: deliveryNotes.trim() || null,
      }),
    }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function completeDocumentDistribution(documentId) {
  const result = await apiRequest(
    `/iro-admin/documents/${documentId}/distribution/complete`,
    { method: "PATCH" }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function getLegalCounsels() {
  const result = await apiRequest(
    "/legal-counsels"
  );

  return result.data ?? result;
}

export async function assignRevisionToIroStaff(documentId, instructions = "") {
  const result = await apiRequest(
    `/iro-admin/documents/${documentId}/assign-revision`,
    {
      method: "PATCH",
      body: JSON.stringify({ instructions: instructions.trim() || null }),
    }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function assignDistributionToIroStaff(documentId, instructions = "") {
  const result = await apiRequest(
    `/iro-admin/documents/${documentId}/assign-distribution`,
    {
      method: "PATCH",
      body: JSON.stringify({ instructions: instructions.trim() || null }),
    }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function saveRevisionForwardingDraft(documentId, forwardingNote = "") {
  const result = await apiRequest(
    `/iro-staff/documents/${documentId}/revision-forwarding-draft`,
    { method: "PUT", body: JSON.stringify({ forwarding_note: forwardingNote.trim() || null }) }
  );
  return result.data ?? result;
}

export async function sendRevisionToDepartment(documentId, forwardingNote = "") {
  const result = await apiRequest(
    `/iro-staff/documents/${documentId}/send-revision-to-department`,
    { method: "PATCH", body: JSON.stringify({ forwarding_note: forwardingNote.trim() || null }) }
  );
  announceWorkflowChange();
  return result.data ?? result;
}

export async function getIroStaffProfiles() {
  const result = await apiRequest("/iro-staff");
  return result.data ?? result;
}

export async function saveAdminReviewPending(
  documentId,
  adminRemarks,
  checklistAnswers
) {
  const result = await apiRequest(
    `/iro-admin/documents/${documentId}/review-form/pending`,
    {
      method: "PUT",
      body: JSON.stringify({
        admin_remarks: adminRemarks?.trim() || null,
        checklist_answers: checklistAnswers,
      }),
    }
  );
  announceWorkflowChange();
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

export async function getNotarizationQueue() {
  const result = await apiRequest(
    "/legal-counsel/notarization-queue"
  );
  return result.data ?? result;
}

export async function recordNotarization(documentId, values) {
  if (!documentId) throw new Error("Document ID is required.");
  if (!values?.file) throw new Error("A notarized PDF is required.");

  const formData = new FormData();
  formData.append("file", values.file);
  formData.append(
    "notarial_reference_number",
    values.notarialReferenceNumber.trim()
  );
  formData.append("notarization_date", values.notarizationDate);
  if (values.notarySignatureCode?.trim()) {
    formData.append(
      "notary_signature_code",
      values.notarySignatureCode.trim()
    );
  }

  const result = await apiRequest(
    `/documents/${documentId}/notarization`,
    { method: "POST", body: formData }
  );
  announceWorkflowChange();
  return result.data ?? result;
}
