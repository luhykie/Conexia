export const documentTableHeaders = [
  "Tracking Number",
  "Document Title",
  "Party 1",
  "Party 2",
  "Partnership Scope",
  "Document Type",
  "Status",
];

// Retains the former standard document-table filters and their source fields.
export const documentTableFilterDefinitions = [
  { columnIndex: 3, label: "Partner/Institution" },
  { columnIndex: 0, label: "Tracking Number" },
  { columnIndex: 4, label: "Partnership Scope" },
  { columnIndex: 5, label: "Document Type" },
  { columnIndex: 6, label: "Status" },
];

// IRO queue and engagement filters historically searched title under the
// Partner/Institution label; retain that behavior while correcting the table.
export const iroDocumentTableFilterDefinitions = [
  { columnIndex: 1, label: "Partner/Institution" },
  { columnIndex: 0, label: "Tracking Number" },
  { columnIndex: 4, label: "Partnership Scope" },
  { columnIndex: 5, label: "Document Type" },
  { columnIndex: 6, label: "Status" },
];

export function documentTableValues(document) {
  return [
    document.tracking_number || "—",
    document.title || "—",
    document.created_by?.full_name || "—",
    document.partner_institution || "—",
    document.partnership_scope === "Departmental"
      ? "Local"
      : document.partnership_scope || document.partnership_type || "—",
    document.document_type || "—",
  ];
}
