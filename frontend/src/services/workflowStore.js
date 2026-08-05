const STORAGE_KEY = "conexia-workflow-documents";

const seedDocuments = [
  {
    id: "doc-001",
    tracking_number: "CX-2026-001",
    title: "Faculty Exchange Agreement",
    departments: { name: "College of Education" },
    partner_institution: "Global Tech University",
    document_type: "MOA",
    submitted_at: "2026-07-22T09:15:00.000Z",
    status: "Submitted",
    description: "Faculty exchange partnership for academic year 2026.",
    submitted_by: "education@conexia.edu",
    assigned_iro_staff: null,
    legal_notes: "",
  },
  {
    id: "doc-002",
    tracking_number: "CX-2026-002",
    title: "Joint Research Understanding",
    departments: { name: "College of Engineering" },
    partner_institution: "Pacific Research Institute",
    document_type: "MOU",
    submitted_at: "2026-07-21T10:30:00.000Z",
    status: "Submitted",
    description: "Research collaboration covering engineering faculty and labs.",
    submitted_by: "engineering@conexia.edu",
    assigned_iro_staff: null,
    legal_notes: "",
  },
  {
    id: "doc-003",
    tracking_number: "CX-2026-003",
    title: "Scholarship Funding Memorandum",
    departments: { name: "College of Business" },
    partner_institution: "Nexus Foundation",
    document_type: "MOF",
    submitted_at: "2026-07-20T14:45:00.000Z",
    status: "Under Legal Review",
    description: "Funding support for student mobility scholarships.",
    submitted_by: "business@conexia.edu",
    assigned_iro_staff: "irostaff@conexia.edu",
    legal_notes: "",
  },
];

function readDocuments() {
  try {
    const savedDocuments = localStorage.getItem(STORAGE_KEY);
    if (savedDocuments) return JSON.parse(savedDocuments);
  } catch (error) {
    console.error("Unable to read workflow documents:", error);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDocuments));
  return seedDocuments;
}

function writeDocuments(documents) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  return documents;
}

export function getWorkflowDocuments() {
  return readDocuments();
}

export function getWorkflowDocumentById(documentId) {
  return readDocuments().find((document) => document.id === documentId) || null;
}

export function createWorkflowDocument({ account, partnerInstitution, documentType, description }) {
  const documents = readDocuments();
  const nextNumber = String(documents.length + 1).padStart(3, "0");
  const document = {
    id: `doc-${Date.now()}`,
    tracking_number: `CX-2026-${nextNumber}`,
    title: `${documentType} Submission`,
    departments: { name: account.office },
    partner_institution: partnerInstitution,
    document_type: documentType,
    submitted_at: new Date().toISOString(),
    status: "Submitted",
    description,
    submitted_by: account.email,
    assigned_iro_staff: null,
    legal_notes: "",
  };

  writeDocuments([document, ...documents]);
  return document;
}

export function updateWorkflowDocument(documentId, updates) {
  const documents = readDocuments();
  const updatedDocuments = documents.map((document) =>
    document.id === documentId
      ? { ...document, ...updates, updated_at: new Date().toISOString() }
      : document
  );

  writeDocuments(updatedDocuments);
  return updatedDocuments.find((document) => document.id === documentId) || null;
}

export function getWorkflowStats() {
  const documents = readDocuments();

  return {
    incoming: documents.filter((document) => document.status === "Submitted").length,
    loggedToday: documents.filter((document) => document.status === "Logged").length,
    awaitingCheck: documents.filter((document) => ["Submitted", "Logged"].includes(document.status)).length,
    routedToLegal: documents.filter((document) => document.status === "Under Legal Review").length,
  };
}
