import React from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Folder,
} from "lucide-react";
import { supabase } from "../supabaseConfig";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import {
  DashboardView,
  ExportButton,
  FilterBar,
} from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";

// Routes all IRO Staff pages through one role-owned component.
export function IroStaff({ page }) {
  if (page === "incoming") return <IncomingSubmissions />;
  if (page === "log-review") return <LogReview />;
  if (page === "status") return <StatusTracker />;
  if (page === "expiry") {
    return (
      <ExpiryView
        title="Global Expiry List"
        action="Bulk Notify Offices"
      />
    );
  }

  return (
    <DashboardView
      roleKey="staff"
      title="Dashboard Overview"
      subtitle="Real-time tracking of institutional relations workflow."
      action="Process Now"
    />
  );
}

// Shows all newly received submissions requiring IRO Staff processing.
function IncomingSubmissions() {
  const [documents, setDocuments] = React.useState([]);
  const [legalUsers, setLegalUsers] = React.useState([]);
  const [selectedLegal, setSelectedLegal] = React.useState({});

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [processingId, setProcessingId] = React.useState(null);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("documents")
      .select(`
        id,
        tracking_number,
        title,
        document_type,
        partner_institution,
        partner_email,
        description,
        assigned_legal_counsel,
        status,
        legal_notes,
        submitted_at,
        updated_at
      `)
      .order("submitted_at", {
        ascending: false,
      });

    if (queryError) {
      console.error("Unable to load documents:", queryError);
      setError(queryError.message);
      setDocuments([]);
    } else {
      setDocuments(data ?? []);
    }

    setLoading(false);
  }

  async function loadLegalUsers() {
    const { data, error: legalError } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        role
      `)
      .eq("role", "legal_counsel");

    if (legalError) {
      console.error("Unable to load Legal Counsel users:", legalError);
      setLegalUsers([]);
      return;
    }

    setLegalUsers(data ?? []);
  }

  React.useEffect(() => {
    async function loadPage() {
      await Promise.all([loadDocuments(), loadLegalUsers()]);
    }

    loadPage();
  }, []);

  async function markAsLogged(documentId) {
    const confirmed = window.confirm(
      "Are you sure you want to mark this document as Logged?"
    );

    if (!confirmed) return;

    setProcessingId(documentId);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "Logged",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("status", "Submitted");

    if (updateError) {
      console.error(
        "Unable to mark the document as Logged:",
        updateError
      );
      setError(updateError.message);
      setProcessingId(null);
      return;
    } 

    setSuccess("Document marked as Logged.");
    await loadDocuments();
    setProcessingId(null);
  }

  async function assignLegal(documentId) {
    const legalCounselId = selectedLegal[documentId];

    if (!legalCounselId) {
      setError(
        "Select a Legal Counsel account before assigning the document."
      );
      return;
    }

    const selectedCounsel = legalUsers.find(
      (user) => user.id === legalCounselId
    );

    const confirmed = window.confirm(
      `Assign this document to ${
        selectedCounsel?.full_name ||
        selectedCounsel?.email ||
        "the selected Legal Counsel"
      }?`
    );

    if (!confirmed) return;

    setProcessingId(documentId);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        assigned_legal_counsel: legalCounselId,
        status: "Under Legal Review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("status", "Logged");

    if (updateError) {
      console.error("Unable to assign Legal Counsel:", updateError);
      setError(updateError.message);
      setProcessingId(null);
      return;
    }

    setSuccess(
      `Document assigned to ${
        selectedCounsel?.full_name ||
        selectedCounsel?.email ||
        "Legal Counsel"
      }.`
    );

    setSelectedLegal((current) => {
      const updatedSelection = { ...current };
      delete updatedSelection[documentId];
      return updatedSelection;
    });

    await loadDocuments();
    setProcessingId(null);
  }

  function getAssignedLegalName(document) {
    const assignedUser = legalUsers.find(
      (user) => user.id === document.assigned_legal_counsel
    );

    return (
      assignedUser?.full_name ||
      assignedUser?.email ||
      "Legal Counsel Assigned"
    );
  }

  const pendingCount = documents.filter(
    (document) => document.status === "Submitted"
  ).length;

  const loggedCount = documents.filter(
    (document) => document.status === "Logged"
  ).length;

  const legalReviewCount = documents.filter(
    (document) => document.status === "Under Legal Review"
  ).length;

  const rows = documents.map((document) => {
    let actionContent;

    if (document.status === "Submitted") {
      actionContent = (
        <button
          key={`log-${document.id}`}
          type="button"
          className="table-action"
          disabled={processingId === document.id}
          onClick={() => markAsLogged(document.id)}
        >
          <CheckCircle2 size={15} />
          {processingId === document.id
            ? "Logging..."
            : "Mark as Logged"}
        </button>
      );
    } else if (document.status === "Logged") {
      actionContent = (
        <div
          key={`assign-${document.id}`}
          className="table-action-group"
        >
          <select
            value={selectedLegal[document.id] || ""}
            disabled={
              processingId === document.id || legalUsers.length === 0
            }
            onChange={(event) =>
              setSelectedLegal((current) => ({
                ...current,
                [document.id]: event.target.value,
              }))
            }
          >
            <option value="">Select Legal Counsel</option>
            {legalUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name || user.email}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="table-action"
            disabled={
              processingId === document.id || !selectedLegal[document.id]
            }
            onClick={() => assignLegal(document.id)}
          >
            {processingId === document.id ? "Assigning..." : "Assign"}
          </button>
        </div>
      );
    } else if (document.status === "Under Legal Review") {
      actionContent = (
        <span
          key={`assigned-${document.id}`}
          className="badge active"
        >
          {getAssignedLegalName(document)}
        </span>
      );
    } else {
      actionContent = (
        <span
          key={`completed-${document.id}`}
          className="badge"
        >
          No IRO Action
        </span>
      );
    }

    return [
      document.tracking_number,
      document.departments?.code ||
        document.departments?.name ||
        document.department_id ||
        "-",
      document.document_type || "-",
      document.submitted_at
        ? new Date(document.submitted_at).toLocaleDateString()
        : "-",
      <span
        key={`status-${document.id}`}
        className={`badge ${
          document.status === "Submitted"
            ? "pending"
            : document.status === "Corrections Needed"
              ? "danger"
              : "active"
        }`}
      >
        {document.status}
      </span>,
      actionContent,
    ];
  });

  return (
    <section className="page iro-staff-page">
      <PageTitle
        title="Incoming Queue"
        subtitle="Receive, log, and route department submissions to Legal Counsel."
      />

      <StatGrid
        stats={[
          [
            String(pendingCount).padStart(2, "0"),
            "Pending Logging",
            Folder,
            "Needs Action",
          ],
          [
            String(loggedCount).padStart(2, "0"),
            "Needs Assignment",
            FileText,
            "Route to Legal",
            "warn",
          ],
          [
            String(legalReviewCount).padStart(2, "0"),
            "Under Legal Review",
            CheckCircle2,
            "Assigned",
          ],
        ]}
      />

      <FilterBar
        labels={[
          "All Departments",
          "SCS",
          "SEA",
          "SBM",
          "SAS",
          "SAMS",
          "SED",
          "SOL",
          "ETEEAP",
        ]}
      />

      <Panel
        title="Active Submissions"
        tools={<ExportButton label="Export CSV" />}
      >
        {loading && <p>Loading submissions...</p>}

        {error && <p className="auth-error">{error}</p>}

        {success && <p className="success-message">{success}</p>}

        {!loading && !error && documents.length === 0 && (
          <p>No incoming submissions are available.</p>
        )}

        {!loading && documents.length > 0 && (
          <DataTable
            headers={[
              "Tracking #",
              "Department",
              "Document Type",
              "Date Submitted",
              "Status",
              "Action",
            ]}
            rows={rows}
          />
        )}
      </Panel>
    </section>
  );
}

// Gives IRO Staff a document preview plus administrative completeness checklist.
function LogReview() {
  return (
    <section className="page iro-staff-page">
      <PageTitle
        title="Log & Review Form"
        subtitle="Verify incoming submission data before routing to Legal."
        action="Mark as Logged"
      />

      <div className="two-col">
        <div>
          <Panel title="Document Preview: DRAFT_MOA_V2.1.PDF">
            <div className="doc-preview">
              <h3>MEMORANDUM OF AGREEMENT</h3>
              <p>Standard Institutional Template v4.0</p>
              <p>KNOW ALL MEN BY THESE PRESENTS:</p>
              <p>
                This Agreement made and entered into this 24th day of
                October 2023 by and between the Department of
                Institutional Relations and Global Logistics Solutions
                Inc.
              </p>
            </div>
          </Panel>
        </div>

        <aside className="review-sidebar">
          <h2>Completeness Check</h2>

          {[
            "Partner Details Verified",
            "Signatory Identified",
            "Standard Template Used",
          ].map((item) => (
            <label className="checkline" key={item}>
              <input type="checkbox" /> {item}
            </label>
          ))}

          <label>
            Internal Staff Notes
            <textarea placeholder="Any initial observations for the reviewer..." />
          </label>

          <Panel title="Routing & Automation">
            <button className="primary wide-inline">
              Auto-Generate Review Form
            </button>
            <Dropzone
              label="Attach supporting document"
              detail="Optional supporting PDF or DOCX"
            />
          </Panel>
        </aside>
      </div>
    </section>
  );
}

// Tracks submission stage history from receipt through archiving.
function StatusTracker() {
  const [documents, setDocuments] = React.useState([]);
  const [legalUsers, setLegalUsers] = React.useState([]);
  const [selectedDocument, setSelectedDocument] =
    React.useState(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [processing, setProcessing] = React.useState(false);
  const [success, setSuccess] = React.useState("");

  async function loadStatusTracker() {
    setLoading(true);
    setError("");

    const [
      { data: documentData, error: documentError },
      { data: legalData, error: legalError },
    ] = await Promise.all([
      supabase
        .from("documents")
        .select(`
          id,
          tracking_number,
          title,
          document_type,
          partner_institution,
          status,
          submitted_at,
          updated_at,
          department_id,
          assigned_legal_counsel,
          legal_notes,
          notarial_reference_number,
          notarization_date,
          notary_signature_code,
          archived_at,
          archived_by,
          departments (
            code,
            name
          )
        `)
        .order("updated_at", {
          ascending: false,
        }),

      supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email
        `)
        .eq("role", "legal_counsel"),
    ]);

    if (documentError) {
      console.error(
        "Unable to load status tracker:",
        documentError
      );
      setError(documentError.message);
      setDocuments([]);
      setSelectedDocument(null);
      setLoading(false);
      return;
    }

    if (legalError) {
      console.error(
        "Unable to load Legal Counsel users:",
        legalError
      );
    }

    const loadedDocuments = documentData ?? [];

    setDocuments(loadedDocuments);
    setLegalUsers(legalData ?? []);

    setSelectedDocument((current) => {
      if (!loadedDocuments.length) return null;

      return (
        loadedDocuments.find(
          (document) => document.id === current?.id
        ) || loadedDocuments[0]
      );
    });

    setLoading(false);
  }

  React.useEffect(() => {
    loadStatusTracker();
  }, []);

  React.useEffect(() => {
    setError("");
    setSuccess("");
  }, [selectedDocument]);

  async function archiveDocument() {
    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    if (selectedDocument.status !== "Notarized") {
      setError("Only notarized documents can be archived.");
      return;
    }

    const confirmed = window.confirm(
      `Archive ${selectedDocument.tracking_number}?`
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError(
        authError?.message ||
          "Unable to identify the signed-in IRO Staff."
      );
      setProcessing(false);
      return;
    }

    const archivedAt = new Date().toISOString();

    const { data: archivedDocument, error: updateError } =
      await supabase
        .from("documents")
        .update({
          status: "Archived",
          archived_at: archivedAt,
          archived_by: authData.user.id,
          updated_at: archivedAt,
        })
        .eq("id", selectedDocument.id)
        .eq("status", "Notarized")
        .select()
        .maybeSingle();

    if (updateError) {
      console.error("Unable to archive document:", updateError);
      setError(updateError.message);
      setProcessing(false);
      return;
    }

    if (!archivedDocument) {
      setError(
        "The document was not archived. Refresh the page and check its current status."
      );
      setProcessing(false);
      return;
    }

    setSuccess("Document archived successfully.");
    await loadStatusTracker();
    setProcessing(false);
  }

  function getLegalCounselName(document) {
    if (!document.assigned_legal_counsel) {
      return "Not assigned";
    }

    const assignedCounsel = legalUsers.find(
      (user) => user.id === document.assigned_legal_counsel
    );

    return (
      assignedCounsel?.full_name ||
      assignedCounsel?.email ||
      "Legal Counsel"
    );
  }

  function getElapsedTime(dateValue) {
    if (!dateValue) return "-";

    const startTime = new Date(dateValue).getTime();
    const currentTime = Date.now();
    const difference = Math.max(currentTime - startTime, 0);

    const totalHours = Math.floor(
      difference / (1000 * 60 * 60)
    );

    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days > 0) {
      return `${days}d ${hours}h`;
    }

    return `${hours}h`;
  }

  const workflowSteps = [
    "Submitted",
    "Logged",
    "Under Legal Review",
    "Corrections Needed",
    "Approved",
    "Pending Notarization",
    "Notarized",
    "Archived",
  ];

  function isStepDone(documentStatus, step) {
    if (documentStatus === "Corrections Needed") {
      return [
        "Submitted",
        "Logged",
        "Under Legal Review",
        "Corrections Needed",
      ].includes(step);
    }

    const currentIndex = workflowSteps.indexOf(documentStatus);
    const stepIndex = workflowSteps.indexOf(step);

    return (
      currentIndex !== -1 &&
      stepIndex !== -1 &&
      stepIndex <= currentIndex
    );
  }

  const rows = documents.map((document) => [
    document.tracking_number,
    document.departments?.code ||
      document.departments?.name ||
      "-",
    document.partner_institution || "-",
    document.document_type || "-",
    <span
      key={`status-${document.id}`}
      className={`badge ${
        document.status === "Corrections Needed"
          ? "danger"
          : document.status === "Submitted"
            ? "pending"
            : "active"
      }`}
    >
      {document.status}
    </span>,
    getLegalCounselName(document),
    document.updated_at
      ? new Date(document.updated_at).toLocaleDateString()
      : "-",
    <button
      key={`view-${document.id}`}
      type="button"
      className="table-action"
      onClick={() => setSelectedDocument(document)}
    >
      View
    </button>,
  ]);

  return (
    <section className="page split-page iro-staff-page">
      <div>
        <PageTitle
          title="Submission Progression"
          subtitle="Real-time status of institutional agreements."
        />

        <StatGrid
          stats={[
            [
              String(documents.length).padStart(2, "0"),
              "Total Submissions",
              Folder,
            ],
            [
              String(
                documents.filter(
                  (document) =>
                    document.status === "Under Legal Review"
                ).length
              ).padStart(2, "0"),
              "Under Legal Review",
              Clock3,
              "",
              "blue",
            ],
            [
              String(
                documents.filter((document) =>
                  [
                    "Approved",
                    "Pending Notarization",
                    "Notarized",
                    "Archived",
                  ].includes(document.status)
                ).length
              ).padStart(2, "0"),
              "Approved or Later",
              CheckCircle2,
            ],
          ]}
        />

        <Panel
          title="Submission Status Tracker"
          tools={<ExportButton label="Export CSV" />}
        >
          {loading && <p>Loading submission statuses...</p>}

          {error && !selectedDocument && (
            <p className="auth-error">{error}</p>
          )}

          {!loading && !error && documents.length === 0 && (
            <p>No submissions are available.</p>
          )}

          {!loading && documents.length > 0 && (
            <DataTable
              headers={[
                "Tracking #",
                "Department",
                "Partner",
                "Document Type",
                "Current Status",
                "Legal Counsel",
                "Last Updated",
                "Action",
              ]}
              rows={rows}
            />
          )}
        </Panel>
      </div>

      <aside className="detail-drawer">
        <h2>Submission Details</h2>

        {!selectedDocument ? (
          <p>Select a submission to view its progression.</p>
        ) : (
          <>
            <span
              className={`badge ${
                selectedDocument.status === "Corrections Needed"
                  ? "danger"
                  : selectedDocument.status === "Submitted"
                    ? "pending"
                    : "active"
              }`}
            >
              {selectedDocument.status}
            </span>

            <h2>{selectedDocument.title}</h2>

            <p>
              <b>Tracking Number:</b>{" "}
              {selectedDocument.tracking_number}
            </p>

            <p>
              <b>Partner:</b>{" "}
              {selectedDocument.partner_institution}
            </p>

            <p>
              <b>Department:</b>{" "}
              {selectedDocument.departments?.code ||
                selectedDocument.departments?.name ||
                "-"}
            </p>

            <p>
              <b>Document Type:</b>{" "}
              {selectedDocument.document_type}
            </p>

            <p>
              <b>Legal Counsel:</b>{" "}
              {getLegalCounselName(selectedDocument)}
            </p>

            <p>
              <b>Time in Current Status:</b>{" "}
              {getElapsedTime(selectedDocument.updated_at)}
            </p>

            {[
              "Pending Notarization",
              "Notarized",
              "Archived",
            ].includes(selectedDocument.status) && (
              <div className="notice">
                <b>Notarization Details</b>

                <p>
                  Reference Number:{" "}
                  {selectedDocument.notarial_reference_number || "-"}
                </p>

                <p>
                  Notarization Date:{" "}
                  {selectedDocument.notarization_date
                    ? new Date(
                        `${selectedDocument.notarization_date}T00:00:00`
                      ).toLocaleDateString()
                    : "-"}
                </p>

                <p>
                  Signature Code:{" "}
                  {selectedDocument.notary_signature_code || "-"}
                </p>
              </div>
            )}

            <h3>Workflow Progress</h3>

            <div className="progress-steps">
              {workflowSteps.map((step) => (
                <span
                  key={step}
                  className={
                    isStepDone(selectedDocument.status, step)
                      ? "done"
                      : ""
                  }
                >
                  {step}
                </span>
              ))}
            </div>

            <h3>Activity</h3>

            <div className="timeline-item">
              <b>Current status: {selectedDocument.status}</b>
              <p>
                The submission record was most recently updated.
              </p>
              <small>
                {selectedDocument.updated_at
                  ? new Date(
                      selectedDocument.updated_at
                    ).toLocaleString()
                  : "-"}
              </small>
            </div>

            <div className="timeline-item">
              <b>Initial Submission</b>
              <p>
                The department submitted the agreement to IRO.
              </p>
              <small>
                {selectedDocument.submitted_at
                  ? new Date(
                      selectedDocument.submitted_at
                    ).toLocaleString()
                  : "-"}
              </small>
            </div>

            {selectedDocument.legal_notes && (
              <div className="timeline-item">
                <b>Legal Findings</b>
                <p>{selectedDocument.legal_notes}</p>
              </div>
            )}

            {selectedDocument.status === "Archived" && (
              <div className="notice">
                <b>Document Archived</b>
                <p>
                  This document has completed the full agreement
                  lifecycle.
                </p>
                <p>
                  Archived on:{" "}
                  {selectedDocument.archived_at
                    ? new Date(
                        selectedDocument.archived_at
                      ).toLocaleString()
                    : "-"}
                </p>
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}

            {success && (
              <p className="success-message">{success}</p>
            )}

            {selectedDocument.status === "Notarized" && (
              <button
                type="button"
                className="primary wide-inline"
                disabled={processing}
                onClick={archiveDocument}
              >
                {processing ? "Archiving..." : "Archive Document"}
              </button>
            )}

            <button
              type="button"
              className="primary wide-inline"
              onClick={() => window.print()}
            >
              <Download size={18} />
              Generate Export Log
            </button>
          </>
        )}
      </aside>
    </section>
  );
}