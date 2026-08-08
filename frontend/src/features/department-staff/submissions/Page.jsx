import React from "react";
import { FileText } from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { DocumentFilesPanel } from "../../../components/DocumentFilesPanel";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { StatGrid } from "../../../components/StatGrid";
import {
  getDepartmentDocuments,
  resubmitDepartmentDocument,
} from "../../../services/departmentStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function Page() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const response = await getDepartmentDocuments({ page });
      const loadedDocuments = response.documents ?? response.data ?? [];

      setDocuments(loadedDocuments);
      setMeta(response.meta ?? null);
      setSelectedDocument((current) => {
        if (!loadedDocuments.length) return null;

        return (
          loadedDocuments.find((document) => document.id === current?.id) ||
          loadedDocuments[0]
        );
      });
    } catch (requestError) {
      reportClientError("Unable to load submissions:", requestError);
      setError(requestError.message);
      setDocuments([]);
      setSelectedDocument(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDocuments();
  }, [page]);

  async function resubmitDocument() {
    if (!selectedDocument?.id) {
      setError("Select a valid document first.");
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    let updatedDocument;

    try {
      const response = await resubmitDepartmentDocument(selectedDocument.id);
      updatedDocument = response.document ?? response.data;
    } catch (requestError) {
      reportClientError("Unable to resubmit document:", requestError);
      setError(requestError.message);
      setProcessing(false);
      return;
    }

    if (!updatedDocument) {
      setError("No document was updated. Refresh the page and verify its current status.");
      setProcessing(false);
      return;
    }

    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === updatedDocument.id ? updatedDocument : document,
      ),
    );
    setSelectedDocument(updatedDocument);
    setSuccess("Document successfully resubmitted.");
    setProcessing(false);
  }

  const rows = documents.map((document) => [
    document.tracking_number || "-",
    document.partner_institution || "-",
    document.document_type || "-",
    document.status || "-",
    <button
      key={`view-${document.id}`}
      type="button"
      className="table-action"
      onClick={() => {
        setSelectedDocument(document);
        setError("");
        setSuccess("");
      }}
    >
      View
    </button>,
  ]);

  return (
    <section className="department-tracking-page">
      <div>
        <PageTitle
          title="Document List / Tracking"
          subtitle="Track department-owned submissions, legal comments, files, and resubmission actions."
        />

        <StatGrid
          stats={[
            {
              value: countStatuses(documents, [
                "Submitted",
                "Logged",
                "Under Legal Review",
              ]),
              label: "Currently in Review",
              icon: FileText,
              badge: "Active",
            },
            {
              value: countStatuses(documents, ["Pending Notarization"]),
              label: "Awaiting Notarization",
              icon: FileText,
              badge: "Pending",
              tone: "warn",
            },
            {
              value: countStatuses(documents, ["Corrections Needed"]),
              label: "Requires Resubmission",
              icon: FileText,
              badge: "Action",
              tone: "danger",
            },
          ]}
        />

        <Panel title="Submission Records">
          {loading && <p>Loading submissions...</p>}
          {error && <p className="auth-error">Unable to load submissions: {error}</p>}
          {!loading && !error && documents.length === 0 && (
            <p>No submissions are available for this department.</p>
          )}
          {!loading && !error && documents.length > 0 && (
            <DataTable
              headers={["Tracking #", "Partner", "Type", "Status", "Action"]}
              rows={rows}
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </Panel>
      </div>

      <aside className="department-detail-panel">
        <h2>Submission Details</h2>

        {!selectedDocument ? (
          <p>Select a submission.</p>
        ) : (
          <>
            <p><b>Tracking #:</b> {selectedDocument.tracking_number}</p>
            <p><b>Partner:</b> {selectedDocument.partner_institution}</p>
            <p><b>Document Type:</b> {selectedDocument.document_type}</p>
            <p><b>Status:</b> {selectedDocument.status}</p>

            {selectedDocument.description && (
              <p><b>Description:</b> {selectedDocument.description}</p>
            )}

            {selectedDocument.legal_notes && (
              <div className="notice danger">
                <b>Legal Remarks</b>
                <p>{selectedDocument.legal_notes}</p>
              </div>
            )}

            <DocumentFilesPanel
              documentId={selectedDocument.id}
              canUpload={["Submitted", "Corrections Needed"].includes(selectedDocument.status)}
              canDelete={["Submitted", "Corrections Needed"].includes(selectedDocument.status)}
            />

            {error && <p className="auth-error">{error}</p>}
            {success && <p className="success-message">{success}</p>}

            {selectedDocument.status === "Corrections Needed" && (
              <button type="button" disabled={processing} onClick={resubmitDocument}>
                {processing ? "Resubmitting..." : "Resubmit Document"}
              </button>
            )}
          </>
        )}
      </aside>
    </section>
  );
}

function countStatuses(documents, statuses) {
  return String(
    documents.filter((document) => statuses.includes(document.status)).length,
  ).padStart(2, "0");
}
