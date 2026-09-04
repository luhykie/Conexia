import React from "react";

import { DataTable } from "../../../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { DocumentChat } from "../../../components/DocumentChat";
import { DepartmentalDocumentHistory, DepartmentalVersionAnnotations } from "../../../components/DocumentReviewPanel";
import { DocumentFilesPanel } from "../../../components/DocumentFilesPanel";
import { SubmissionDetailSection } from "../../../components/SubmissionDetails";
import { getDepartments } from "../../../services/departmentService";
import {
  getIroDocumentHistory,
  updateIroEngagement,
} from "../../../services/iroAdminService";
import { getIroStatusDocuments } from "../../../services/iroDocumentService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminEngagementsPage() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
  const [editing, setEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState(null);
  const [editFile, setEditFile] = React.useState(null);
  const [departments, setDepartments] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState("");
  const [partnerEmailError, setPartnerEmailError] = React.useState("");
  const [historyVersion, setHistoryVersion] = React.useState(null);
  const {
    filters,
    queryParams,
    updateFilter,
    clearFilters,
  } = useDocumentFilters();

  function changeFilter(key, value) {
    updateFilter(key, value);
    setPage(1);
  }

  function closeDetails() {
    if (saving) return;
    setSelectedDocument(null);
    setEditing(false);
    setEditForm(null);
    setEditFile(null);
    setEditError("");
    setPartnerEmailError("");
    setHistoryVersion(null);
  }

  async function startEditing() {
    if (!selectedDocument?.can_edit_engagement) return;

    setEditForm(editableEngagement(selectedDocument));
    setEditFile(null);
    setEditError("");
    setPartnerEmailError("");
    setEditing(true);

    if (!departments.length) {
      try {
        const response = await getDepartments({ per_page: 100 });
        setDepartments(response.data ?? response.departments ?? []);
      } catch (requestError) {
        reportClientError("Unable to load responsible offices:", requestError);
        setEditError(requestError.message);
      }
    }
  }

  function updateEditForm(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
    setEditError("");
    if (name === "partner_email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      setPartnerEmailError("");
    }
  }

  async function saveEngagement(event) {
    event.preventDefault();
    if (!selectedDocument || !editForm || saving) return;

    if (!editForm.partner_email.trim()) {
      setPartnerEmailError("Partner Contact Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.partner_email.trim())) {
      setPartnerEmailError("Please enter a valid partner contact email.");
      return;
    }

    setSaving(true);
    setEditError("");
    try {
      const response = await updateIroEngagement(
        selectedDocument.id,
        {
          ...editForm,
          department_id: editForm.department_id,
        },
        editFile,
      );
      const updated = response.document ?? response.data;
      setDocuments((current) => current.map((document) =>
        document.id === updated.id ? updated : document));
      setSelectedDocument(updated);
      setEditing(false);
      setEditForm(null);
      setEditFile(null);
    } catch (requestError) {
      reportClientError("Unable to update engagement:", requestError);
      setEditError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    let active = true;

    async function loadEngagements() {
      setLoading(true);
      setError("");

      try {
        const response = await getIroStatusDocuments({
          page,
          ...queryParams,
        });
        const loadedDocuments = response.documents ?? response.data ?? [];

        if (active) {
          setDocuments(loadedDocuments);
          setMeta(response.meta ?? null);
          setSelectedDocument((current) => {
            if (!current) return null;
            return loadedDocuments.find((document) => document.id === current.id) || null;
          });
        }
      } catch (requestError) {
        reportClientError("Unable to load engagements:", requestError);

        if (active) {
          setError(requestError.message);
          setDocuments([]);
          setSelectedDocument(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEngagements();

    return () => {
      active = false;
    };
  }, [page, queryParams]);

  React.useEffect(() => {
    if (!selectedDocument) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape" && !saving) closeDetails();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedDocument, saving]);

  const rows = documents.map((document) => [
    document.partner_institution || "-",
    `${document.document_type || "-"} / ${
      document.department?.code || document.department?.name || "Unassigned"
    }`,
    document.expiry_date || document.expected_duration || "-",
    document.status || "-",
    <button
      type="button"
      className="table-action"
      key={document.id}
      onClick={() => setSelectedDocument(document)}
    >
      View
    </button>,
  ]);

  return (
    <section className="page iro-admin-page iro-admin-engagements-page">
      <div className="engagement-registry-content">
        <PageTitle
          title="Partner Engagements"
          subtitle="Global view of institutional partnerships."
        />

        <Panel title="Engagement Registry">
          <DocumentFilters
            filters={filters}
            onChange={changeFilter}
            onClear={() => {
              clearFilters();
              setPage(1);
            }}
            statusOptions={[
              "Submitted",
              "Logged",
              "Under Legal Review",
              "Corrections Needed",
              "Approved",
              "Archived",
            ]}
            showDepartment
          />
          {loading && <p>Loading engagement records...</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p>No engagement records are available.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <DataTable
              headers={[
                "Partner Organization",
                "Type / Department",
                "Validity Period",
                "Status",
                "Action",
              ]}
              rows={rows}
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </Panel>
      </div>

      {selectedDocument && (
        <>
        <div
          className="engagement-detail-backdrop"
          role="presentation"
          onClick={closeDetails}
        >
          <section
            className="engagement-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="engagement-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="engagement-detail-header">
              <div>
                <span className="badge">Partner Record</span>
                <h2 id="engagement-detail-title">
                  {selectedDocument.partner_institution || "Engagement Details"}
                </h2>
                <p>Complete read-only engagement information</p>
              </div>
              <button
                type="button"
                className="engagement-detail-close"
                aria-label="Close engagement details"
                disabled={saving}
                onClick={closeDetails}
              >
                ×
              </button>
            </header>

            {editing ? (
              <form className="engagement-edit-form" onSubmit={saveEngagement}>
                <div className="engagement-edit-grid">
                  <EditField label="Title">
                    <input name="title" value={editForm.title} onChange={updateEditForm} required maxLength={255} />
                  </EditField>
                  <EditField label="Agreement Type">
                    <select name="document_type" value={editForm.document_type} onChange={updateEditForm} required>
                      <option value="MOA">MOA</option><option value=""></option><option value=""></option>
                    </select>
                  </EditField>
                  <EditField label="Partnership Type">
                    <select name="partnership_type" value={editForm.partnership_type} onChange={updateEditForm} required>
                      <option value="New Partnership">New Partnership</option><option value="Renewal">Renewal</option>
                    </select>
                  </EditField>
                  <EditField label="Partnership Scope">
                    <select name="partnership_scope" value={editForm.partnership_scope} onChange={updateEditForm} required>
                      <option value="Departmental">Departmental</option><option value="Local">Local</option><option value="International">International</option>
                    </select>
                  </EditField>
                  <EditField label="Responsible Office">
                    <select name="department_id" value={editForm.department_id} onChange={updateEditForm} required>
                      <option value="">Select responsible office</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>{departmentLabel(department)}</option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Partner Organization">
                    <input name="partner_institution" value={editForm.partner_institution} onChange={updateEditForm} required maxLength={255} />
                  </EditField>
                  <EditField label="Partner Contact Email" error={partnerEmailError}>
                    <input name="partner_email" type="email" value={editForm.partner_email} onChange={updateEditForm} required maxLength={255} />
                  </EditField>
                  <EditField label="Contact Person">
                    <input name="contact_person" value={editForm.contact_person} onChange={updateEditForm} required maxLength={255} />
                  </EditField>
                  <EditField label="Position">
                    <input name="contact_position" value={editForm.contact_position} onChange={updateEditForm} maxLength={255} />
                  </EditField>
                  <EditField label="Email">
                    <input name="contact_email" type="email" value={editForm.contact_email} onChange={updateEditForm} required maxLength={255} />
                  </EditField>
                  <EditField label="Country Code / Contact Number">
                    <input name="contact_number" type="tel" value={editForm.contact_number} onChange={updateEditForm} maxLength={100} />
                  </EditField>
                  <EditField label="Description / Purpose" wide>
                    <textarea name="description" value={editForm.description} onChange={updateEditForm} maxLength={2000} rows={5} />
                  </EditField>
                  <EditField label="Revised Agreement Document (optional)" wide>
                    <input type="file" accept=".pdf,.docx,.odt" onChange={(event) => setEditFile(event.target.files?.[0] ?? null)} />
                    <small>The existing agreement is preserved. A selected file is saved as the next document version.</small>
                  </EditField>
                </div>
                {editError && <p className="auth-error">{editError}</p>}
                <footer className="engagement-detail-footer">
                  <button type="button" className="outline" disabled={saving} onClick={() => { setEditing(false); setEditError(""); setPartnerEmailError(""); }}>
                    Cancel
                  </button>
                  <button className="primary" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </footer>
              </form>
            ) : (<>
            <div className="engagement-detail-sections">
              {engagementSections(selectedDocument).map((section) => (
                <section
                  key={section.title}
                  className={`engagement-detail-section engagement-detail-section--${section.layout}`}
                >
                  <h3>{section.title}</h3>
                  <dl>
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        className={[
                          "engagement-detail-row",
                          item.wide ? "engagement-detail-row--wide" : "",
                          item.empty ? "engagement-detail-row--empty" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>

            <DepartmentalDocumentHistory
              documentId={selectedDocument.id}
              loadHistory={getIroDocumentHistory}
              onViewVersion={setHistoryVersion}
              onCloseVersion={() => setHistoryVersion(null)}
              viewingVersion={Boolean(historyVersion)}
              Section={SubmissionDetailSection}
            />
            {historyVersion && <>
              <DocumentFilesPanel documentId={selectedDocument.id} embeddedPreview previewFileId={historyVersion.file.id} />
              <DepartmentalVersionAnnotations version={historyVersion} Section={SubmissionDetailSection} showHighlightNumbers />
            </>}

            <footer className="engagement-detail-footer">
              <button type="button" className="outline" onClick={closeDetails}>
                Close
              </button>
              <button
                className="primary"
                type="button"
                disabled={!selectedDocument.can_edit_engagement}
                title={!selectedDocument.can_edit_engagement
                  ? "Editing is unavailable at this workflow stage or for engagements not created by IRO Admin."
                  : undefined}
                onClick={startEditing}
              >
                Edit Engagement
              </button>
            </footer>
            </>)}
          </section>
        </div>
        <DocumentChat documentId={selectedDocument.id} variant="drawer" />
        </>
      )}
    </section>
  );
}

function EditField({ label, wide = false, error = "", children }) {
  return (
    <label className={wide ? "engagement-edit-field engagement-edit-field--wide" : "engagement-edit-field"}>
      <span>{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function editableEngagement(document) {
  return {
    title: document.title ?? "",
    document_type: document.document_type ?? "MOA",
    partnership_type: document.partnership_type ?? "New Partnership",
    partnership_scope: document.partnership_scope ?? "Local",
    department_id: document.department_id ?? "",
    partner_institution: document.partner_institution ?? "",
    partner_email: document.partner_email ?? "",
    description: submittedDescription(document.description) ?? "",
    contact_person: document.contact_person ?? "",
    contact_position: document.contact_position ?? "",
    contact_email: document.contact_email ?? "",
    contact_number: document.contact_number ?? "",
  };
}

function engagementSections(document) {
  const submittedForm = submittedFormDetails(document.description);

  return [
    {
      title: "Engagement Information",
      layout: "information",
      items: [
        engagementDetail("Tracking Number", document.tracking_number),
        engagementDetail("Partner Organization", document.partner_institution),
        engagementDetail("Title", document.title),
        engagementDetail("Agreement Type", document.document_type),
        engagementDetail("Partnership Type", firstAvailable(document.partnership_type, submittedForm.submissionType)),
        engagementDetail("Partnership Scope", firstAvailable(document.partnership_scope, submittedForm.partnerClassification)),
        engagementDetail("Responsible Office", responsibleOffice(document, submittedForm.requestingOffice)),
        engagementDetail("Partner Department", departmentLabel(document.partner_department)),
        engagementDetail("Partner Email", document.partner_email),
      ],
    },
    {
      title: "Contact Information",
      layout: "contact",
      items: [
        engagementDetail("Contact Person", firstAvailable(document.contact_person, submittedForm.contactPerson)),
        engagementDetail("Position", firstAvailable(document.contact_position, submittedForm.position)),
        engagementDetail("Email", firstAvailable(document.contact_email, submittedForm.emailAddress)),
        engagementDetail("Country Code / Contact Number", firstAvailable(document.contact_number, submittedForm.contactNumber)),
      ],
    },
    {
      title: "Engagement Dates / Status",
      layout: "dates",
      items: [
        engagementDetail("Effective Date", formatDate(document.effective_date)),
        engagementDetail("Expiry Date", formatDate(document.expiry_date)),
        engagementDetail("Expected Duration", document.expected_duration),
        engagementDetail("Requested Completion Date", formatDate(firstAvailable(document.requested_completion_date, submittedForm.requestedCompletionDate))),
        engagementDetail("Urgency", formatSubmittedValue(firstAvailable(document.urgency, submittedForm.urgencyLevel))),
        engagementDetail("Renewal Notice", formatRenewalNotice(document.renewal_notice_days)),
        engagementDetail("Renewal Status", formatSubmittedValue(document.renewal_status)),
        engagementDetail("Current Status", document.status),
        engagementDetail("Date Submitted", formatDate(document.submitted_at)),
        engagementDetail("Last Updated", formatDate(document.updated_at)),
      ],
    },
    {
      title: "Description / Purpose",
      layout: "description",
      items: [
        descriptionDetail(submittedDescription(document.description)),
      ],
    },
  ];
}

function engagementDetail(label, value, options = {}) {
  return { label, value: hasValue(value) ? value : "-", ...options };
}

function descriptionDetail(value) {
  const available = hasValue(value);
  return {
    label: "Description / Purpose",
    value: available ? value : "No description provided",
    wide: true,
    empty: !available,
  };
}

function firstAvailable(...values) {
  return values.find(hasValue);
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function departmentLabel(department) {
  if (!department) return undefined;
  if (department.code && department.name) return `${department.code} - ${department.name}`;
  return department.code || department.name;
}

function responsibleOffice(document, submittedOffice) {
  return firstAvailable(departmentLabel(document.department), submittedOffice);
}

function formatDate(value) {
  if (!hasValue(value)) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatRenewalNotice(value) {
  return hasValue(value) ? `${value} days` : undefined;
}

function formatSubmittedValue(value) {
  if (!hasValue(value)) return undefined;

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function submittedFormDetails(description) {
  const structuredLines = submittedFormLines(description);
  if (structuredLines.length < 4) return {};

  return structuredLines.reduce((details, line) => {
    const separator = line.indexOf(":");
    const key = submittedFormLabels[line.slice(0, separator).trim().toLowerCase()];
    const value = line.slice(separator + 1).trim();
    if (key && value) details[key] = value;
    return details;
  }, {});
}

function submittedDescription(description) {
  if (!hasValue(description)) return undefined;

  const structuredLines = submittedFormLines(description);
  if (structuredLines.length < 4) return description;

  const purpose = String(description).split(/\r?\n/).filter((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return true;

    const label = line.slice(0, separator).trim().toLowerCase();
    return !submittedFormLabels[label];
  }).join("\n").trim();

  return purpose || undefined;
}

function submittedFormLines(description) {
  if (!hasValue(description)) return [];

  return String(description).split(/\r?\n/).filter((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return false;

    const label = line.slice(0, separator).trim().toLowerCase();
    return Boolean(submittedFormLabels[label]);
  });
}

const submittedFormLabels = {
  "submission type": "submissionType",
  "partner classification": "partnerClassification",
  "requesting office/department": "requestingOffice",
  "contact person": "contactPerson",
  position: "position",
  "email address": "emailAddress",
  "contact number": "contactNumber",
  "requested completion date": "requestedCompletionDate",
  "urgency level": "urgencyLevel",
};
