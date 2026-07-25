import { supabase } from "../supabaseConfig";

/**
 * Department Staff submits a new MOA/MOU/MOF document.
 */
export async function submitDocumentToSupabase(formData) {
  const now = new Date().toISOString();

  const payload = {
    tracking_number:
      formData.tracking_number || formData.trackingNumber,
    title: formData.title,
    document_type:
      formData.document_type || formData.documentType,
    partner_institution:
      formData.partner_institution || formData.partnerInstitution,
    partner_email:
      formData.partner_email || formData.partnerEmail || null,
    description: formData.description || null,
    department_id:
      formData.department_id || formData.departmentId,
    submitted_by:
      formData.submitted_by || formData.submittedBy,
    status: "Submitted",
    submitted_at: now,
    updated_at: now,
  };

 const { data, error } = await supabase
  .from("documents")
  .insert(payload)
  .select()
  .maybeSingle();

if (error) {
  console.error("Document submission failed:", error);
  throw error;
}

if (!data) {
  throw new Error(
    "The document was inserted, but Supabase did not return the new record. Check the documents SELECT RLS policy."
  );
}

return data;
}

export async function getProfileByEmail(email) {
  if (!email) {
    throw new Error("The logged-in account has no email address.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department_id")
    .eq("email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Profile lookup failed:", error);
    throw error;
  }

  if (!data) {
    throw new Error(
      `No Supabase profile was found for ${normalizedEmail}.`
    );
  }

  if (!data.department_id) {
    throw new Error(
      "The Department Staff profile has no assigned department."
    );
  }

  return data;
}

export async function getDepartmentDocuments(departmentId) {
  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      departments(name)
    `)
    .eq("department_id", departmentId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Unable to fetch department documents:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Fetch every workflow document.
 */
export async function getDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      departments(name)
    `)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Unable to fetch documents:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Fetch documents waiting for IRO Staff.
 */
export async function getIncomingDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      departments(name)
    `)
    .eq("status", "Submitted")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Unable to fetch incoming documents:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Fetch documents waiting for IRO Admin validation.
 */
export async function getLoggedDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      departments(name)
    `)
    .eq("status", "Logged")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Unable to fetch logged documents:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Fetch one selected document.
 */
export async function getDocumentById(documentId) {
  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      departments(name)
    `)
    .eq("id", documentId)
    .single();

  if (error) {
    console.error("Unable to fetch selected document:", error);
    throw error;
  }

  return data;
}

/**
 * IRO Staff logs the document and submits it to IRO Admin.
 */
export async function logDocument(documentId, iroStaffId) {
  const updates = {
    status: "Logged",
    updated_at: new Date().toISOString(),
  };

  if (iroStaffId) {
    updates.assigned_iro_staff = iroStaffId;
  }

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    console.error("Unable to log document:", error);
    throw error;
  }

  return data;
}

/**
 * IRO Admin assigns Legal Counsel and routes the document.
 */
export async function routeToLegal(
  documentId,
  legalCounselId
) {
  if (!legalCounselId) {
    throw new Error(
      "A Legal Counsel must be selected before routing."
    );
  }

  const { data, error } = await supabase
    .from("documents")
    .update({
      assigned_legal_counsel: legalCounselId,
      status: "Under Legal Review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    console.error("Unable to route document:", error);
    throw error;
  }

  return data;
}

/**
 * Legal Counsel approves a document.
 */
export async function approveDocument(documentId) {
  const { data, error } = await supabase
    .from("documents")
    .update({
      status: "Approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    console.error("Unable to approve document:", error);
    throw error;
  }

  return data;
}

/**
 * Legal Counsel returns a document for corrections.
 */
export async function requestCorrections(
  documentId,
  remarks
) {
  const { data, error } = await supabase
    .from("documents")
    .update({
      status: "Corrections Needed",
      legal_notes: remarks,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    console.error("Unable to return document:", error);
    throw error;
  }

  return data;
}