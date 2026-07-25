const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message || `Request failed with status ${response.status}.`
    );
  }

  return result;
}

export async function getDocuments() {
  const result = await apiRequest("/documents");
  return result.data ?? result;
}

export async function getIncomingDocuments() {
  const result = await apiRequest("/iro-staff/incoming");
  return result.data ?? result;
}

export async function getLoggedDocuments() {
  const result = await apiRequest("/iro-admin/manage-submissions");
  return result.data ?? result;
}

export async function getDepartmentDocuments(departmentId) {
  if (!departmentId) {
    throw new Error("Department ID is required.");
  }

  const result = await apiRequest(
    `/departments/${departmentId}/documents`
  );

  return result.data ?? result;
}

export async function getDocumentById(documentId) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  const result = await apiRequest(`/documents/${documentId}`);
  return result.data ?? result;
}

export async function submitDocument(formData) {
  const result = await apiRequest("/documents", {
    method: "POST",
    body: JSON.stringify({
      tracking_number:
        formData.tracking_number || formData.trackingNumber,
      title: formData.title,
      document_type:
        formData.document_type || formData.documentType,
      partner_institution:
        formData.partner_institution ||
        formData.partnerInstitution,
      partner_email:
        formData.partner_email ||
        formData.partnerEmail ||
        null,
      description: formData.description || null,
      department_id:
        formData.department_id || formData.departmentId,
      submitted_by:
        formData.submitted_by || formData.submittedBy,
    }),
  });

  return result.data ?? result;
}

export async function logDocument(documentId, iroStaffId) {
  const result = await apiRequest(
    `/documents/${documentId}/log`,
    {
      method: "PATCH",
      body: JSON.stringify({
        iro_staff_id: iroStaffId,
      }),
    }
  );

  return result.data ?? result;
}

export async function routeToLegal(documentId, legalCounselId) {
  const result = await apiRequest(
    `/documents/${documentId}/route-to-legal`,
    {
      method: "PATCH",
      body: JSON.stringify({
        legal_counsel_id: legalCounselId,
      }),
    }
  );

  return result.data ?? result;
}

export async function approveDocument(documentId) {
  const result = await apiRequest(
    `/documents/${documentId}/approve`,
    {
      method: "PATCH",
    }
  );

  return result.data ?? result;
}

export async function requestCorrections(documentId, remarks) {
  const result = await apiRequest(
    `/documents/${documentId}/request-corrections`,
    {
      method: "PATCH",
      body: JSON.stringify({
        remarks,
      }),
    }
  );

  return result.data ?? result;
}