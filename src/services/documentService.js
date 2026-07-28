const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        `Request failed with status ${response.status}.`
    );
  }

  return result;
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

    description:
      formData.description || null,

    department_id:
      formData.department_id ||
      formData.departmentId,

    submitted_by:
      formData.submitted_by ||
      formData.submittedBy,
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

  if (!payload.department_id) {
    throw new Error("Department ID is required.");
  }

  if (!payload.submitted_by) {
    throw new Error("Submitter ID is required.");
  }

  const result = await apiRequest("/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });

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

export async function logDocument(
  documentId,
  iroStaffId
) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  if (!iroStaffId) {
    throw new Error("IRO Staff ID is required.");
  }

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

/* ===========================================================
   IRO ADMIN
=========================================================== */

export async function getLoggedDocuments() {
  const result = await apiRequest(
    "/iro-admin/manage-submissions"
  );

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

  return result.data ?? result;
}

/* ===========================================================
   LEGAL COUNSEL
=========================================================== */

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

  return result.data ?? result;
}
export async function getLegalReviewQueue(
  legalCounselId
) {
  if (!legalCounselId) {
    throw new Error(
      "Legal Counsel ID is required."
    );
  }

  const query = new URLSearchParams({
    legal_counsel_id: legalCounselId,
  });

  const result = await apiRequest(
    `/legal-counsel/review-queue?${query.toString()}`
  );

  return result.data ?? result;
}