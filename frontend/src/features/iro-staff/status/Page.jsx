import React from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  Folder,
} from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import { DocumentFilesPanel } from "../../../components/DocumentFilesPanel";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { ExportButton } from "../../../components/SharedViews";
import { StatGrid } from "../../../components/StatGrid";
import {
  archiveIroDocument,
  getActiveLegalCounselUsers,
  getIroStatusDocuments,
} from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

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

export default function IroStaffStatusPage() {
  const [documents, setDocuments] = React.useState([]);
  const [legalUsers, setLegalUsers] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [processing, setProcessing] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  async function loadStatusTracker() {
    setLoading(true);
    setError("");

    try {
      const [documentResponse, legalResponse] = await Promise.all([
        getIroStatusDocuments({ page }),
        getActiveLegalCounselUsers(),
      ]);

      const loadedDocuments =
        documentResponse.documents ?? documentResponse.data ?? [];

      setDocuments(loadedDocuments);
      setMeta(documentResponse.meta ?? null);
      setLegalUsers(legalResponse.data ?? legalResponse.users ?? []);
      setSelectedDocument((currentDocument) => {
        if (!loadedDocuments.length) return null;

        return (
          loadedDocuments.find(
            (document) => document.id === currentDocument?.id,
          ) || loadedDocuments[0]
        );
      });
    } catch (requestError) {
      reportClientError("Unable to load status tracker:", requestError);
      setError(requestError.message);
      setDocuments([]);
      setSelectedDocument(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadStatusTracker();
  }, [page]);

  React.useEffect(() => {
    setError("");
    setSuccess("");
  }, [selectedDocument]);

  async function archiveDocument() {
    if (!selectedDocument?.id) {
      setError("Select a valid document first.");
      return;
    }

    if (selectedDocument.status !== "Notarized") {
      setError("Only notarized documents can be archived.");
      return;
    }

    const confirmed = window.confirm(
      `Archive ${selectedDocument.tracking_number}?`,
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await archiveIroDocument(selectedDocument.id);
      const archivedDocument = response.document ?? response.data;

      if (!archivedDocument) {
        setError(
          "The document was not archived. Refresh the page and check its current status.",
        );
        return;
      }

      setSuccess("Document archived successfully.");
      await loadStatusTracker();
    } catch (requestError) {
      reportClientError("Unable to archive document:", requestError);
      setError(requestError.message);
    } finally {
      setProcessing(false);
    }
  }

  function getLegalCounselName(document) {
    if (!document.assigned_legal_counsel) {
      return "Not assigned";
    }

    const assignedCounsel = legalUsers.find(
      (user) => user.id === document.assigned_legal_counsel,
    );

    return assignedCounsel?.full_name || assignedCounsel?.email || "Legal Counsel";
  }

  function getElapsedTime(dateValue) {
    if (!dateValue) return "-";

    const difference = Math.max(Date.now() - new Date(dateValue).getTime(), 0);
    const totalHours = Math.floor(difference / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  }

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

    return currentIndex !== -1 && stepIndex !== -1 && stepIndex <= currentIndex;
  }

  const rows = documents.map((document) => [
    document.tracking_number,
    document.department?.code || document.department?.name || "-",
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
    document.updated_at ? new Date(document.updated_at).toLocaleDateString() : "-",
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
    <section className="page split-page iro-staff-page iro-staff-status-page">
      <div>
        <PageTitle
          title="Submission Progression"
          subtitle="Real-time status of institutional agreements."
        />

        <StatGrid
          stats={[
            {
              value: String(documents.length).padStart(2, "0"),
              label: "Total Submissions",
              icon: Folder,
            },
            {
              value: String(
                documents.filter(
                  (document) => document.status === "Under Legal Review",
                ).length,
              ).padStart(2, "0"),
              label: "Under Legal Review",
              icon: Clock3,
              tone: "blue",
            },
            {
              value: String(
                documents.filter((document) =>
                  [
                    "Approved",
                    "Pending Notarization",
                    "Notarized",
                    "Archived",
                  ].includes(document.status),
                ).length,
              ).padStart(2, "0"),
              label: "Approved or Later",
              icon: CheckCircle2,
            },
          ]}
        />

        <Panel
          title="Submission Status Tracker"
          tools={<ExportButton label="Export CSV" />}
        >
          {loading && <p>Loading submission statuses...</p>}
          {error && !selectedDocument && <p className="auth-error">{error}</p>}

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
              meta={meta}
              onPageChange={setPage}
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
              <b>Tracking Number:</b> {selectedDocument.tracking_number}
            </p>
            <p>
              <b>Partner:</b> {selectedDocument.partner_institution}
            </p>
            <p>
              <b>Department:</b>{" "}
              {selectedDocument.department?.code ||
                selectedDocument.department?.name ||
                "-"}
            </p>
            <p>
              <b>Document Type:</b> {selectedDocument.document_type}
            </p>
            <p>
              <b>Legal Counsel:</b> {getLegalCounselName(selectedDocument)}
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
                        `${selectedDocument.notarization_date}T00:00:00`,
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
                  className={isStepDone(selectedDocument.status, step) ? "done" : ""}
                >
                  {step}
                </span>
              ))}
            </div>

            <h3>Activity</h3>
            <div className="timeline-item">
              <b>Current status: {selectedDocument.status}</b>
              <p>The submission was most recently updated.</p>
              <small>
                {selectedDocument.updated_at
                  ? new Date(selectedDocument.updated_at).toLocaleString()
                  : "-"}
              </small>
            </div>

            <div className="timeline-item">
              <b>Initial Submission</b>
              <p>The department submitted the agreement to IRO.</p>
              <small>
                {selectedDocument.submitted_at
                  ? new Date(selectedDocument.submitted_at).toLocaleString()
                  : "-"}
              </small>
            </div>

            {selectedDocument.legal_notes && (
              <div className="timeline-item">
                <b>Legal Findings</b>
                <p>{selectedDocument.legal_notes}</p>
              </div>
            )}

            <DocumentFilesPanel documentId={selectedDocument.id} />

            {selectedDocument.status === "Archived" && (
              <div className="notice">
                <b>Document Archived</b>
                <p>This document has completed the full agreement lifecycle.</p>
                <p>
                  Archived on:{" "}
                  {selectedDocument.archived_at
                    ? new Date(selectedDocument.archived_at).toLocaleString()
                    : "-"}
                </p>
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}
            {success && <p className="success-message">{success}</p>}

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
