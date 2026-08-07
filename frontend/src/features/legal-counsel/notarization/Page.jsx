import React from "react";
import {
  CalendarClock,
  CheckCircle2,
  Gavel,
} from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { StatGrid } from "../../../components/StatGrid";
import {
  completeNotarization as completeNotarizationRequest,
  getNotarizationDocuments,
  submitForNotarization,
} from "../../../services/legalCounselServices";
import { createNotification } from "../../../utils/notifications";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function LegalCounselNotarizationPage() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [notarizationDate, setNotarizationDate] = React.useState("");
  const [signatureCode, setSignatureCode] = React.useState("");
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
      const response = await getNotarizationDocuments({ page });
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
      reportClientError("Unable to load notarization documents:", requestError);
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

  React.useEffect(() => {
    setReferenceNumber(selectedDocument?.notarial_reference_number || "");
    setNotarizationDate(selectedDocument?.notarization_date || "");
    setSignatureCode(selectedDocument?.notary_signature_code || "");
    setError("");
    setSuccess("");
  }, [selectedDocument]);

  function validateNotarizationFields() {
    if (!referenceNumber.trim() || !notarizationDate || !signatureCode.trim()) {
      setError(
        "Complete the reference number, notarization date, and signature code.",
      );
      return false;
    }

    return true;
  }

  async function submitNotarization() {
    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    if (selectedDocument.status !== "Approved") {
      setError("Only approved documents can be submitted for notarization.");
      return;
    }

    if (!validateNotarizationFields()) return;

    const confirmed = window.confirm("Submit this document for notarization?");
    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    if (selectedDocument.submitted_by) {
      const notificationResult = await createNotification({
        userId: selectedDocument.submitted_by,
        documentId: selectedDocument.id,
        title: "Pending Notarization",
        message: `${selectedDocument.tracking_number} has been submitted for notarization.`,
        type: "pending_notarization",
      });

      if (!notificationResult.success) {
        reportClientError("Notification failed:", notificationResult.error);
      }
    }

    try {
      await submitForNotarization(selectedDocument.id, {
        notarial_reference_number: referenceNumber.trim(),
        notarization_date: notarizationDate,
        notary_signature_code: signatureCode.trim(),
      });
      setSuccess("Document submitted for notarization successfully.");
      await loadDocuments();
    } catch (requestError) {
      reportClientError(
        "Unable to submit document for notarization:",
        requestError,
      );
      setError(requestError.message);
    } finally {
      setProcessing(false);
    }
  }

  async function completeNotarization() {
    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    if (selectedDocument.status !== "Pending Notarization") {
      setError("Only documents pending notarization can be completed.");
      return;
    }

    if (!validateNotarizationFields()) return;

    const confirmed = window.confirm("Mark this document as notarized?");
    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    if (selectedDocument.submitted_by) {
      const notificationResult = await createNotification({
        userId: selectedDocument.submitted_by,
        documentId: selectedDocument.id,
        title: "Document Notarized",
        message: `${selectedDocument.tracking_number} has been successfully notarized.`,
        type: "document_notarized",
      });

      if (!notificationResult.success) {
        reportClientError("Notification failed:", notificationResult.error);
      }
    }

    try {
      await completeNotarizationRequest(selectedDocument.id, {
        notarial_reference_number: referenceNumber.trim(),
        notarization_date: notarizationDate,
        notary_signature_code: signatureCode.trim(),
      });
      setSuccess("Document notarization completed successfully.");
      await loadDocuments();
    } catch (requestError) {
      reportClientError("Unable to complete notarization:", requestError);
      setError(requestError.message);
    } finally {
      setProcessing(false);
    }
  }

  const pendingCount = documents.filter(
    (document) => document.status === "Pending Notarization",
  ).length;
  const completedCount = documents.filter(
    (document) => document.status === "Notarized",
  ).length;

  const rows = documents.map((document) => [
    document.tracking_number,
    document.partner_institution,
    <span
      key={`status-${document.id}`}
      className={`badge ${
        document.status === "Notarized"
          ? "active"
          : document.status === "Pending Notarization"
            ? "pending"
            : ""
      }`}
    >
      {document.status}
    </span>,
    document.updated_at
      ? new Date(document.updated_at).toLocaleDateString()
      : "-",
    <button
      key={`select-${document.id}`}
      type="button"
      className="table-action"
      onClick={() => setSelectedDocument(document)}
    >
      Select
    </button>,
  ]);

  const canEdit =
    selectedDocument &&
    ["Approved", "Pending Notarization"].includes(selectedDocument.status);

  return (
    <section className="page legal-page legal-counsel-notarization-page">
      <PageTitle
        title="Notarization Tracker"
        subtitle="Track approved documents and pending notarization records."
      />

      <StatGrid
        stats={[
          {
            value: String(documents.length).padStart(2, "0"),
            label: "Total Queue",
            icon: Gavel,
          },
          {
            value: String(pendingCount).padStart(2, "0"),
            label: "Pending Notarization",
            icon: CalendarClock,
            tone: "blue",
          },
          {
            value: String(completedCount).padStart(2, "0"),
            label: "Completed",
            icon: CheckCircle2,
          },
        ]}
      />

      <div className="two-col">
        <Panel title="Document Tracking Queue">
          {loading && <p>Loading notarization documents...</p>}
          {error && !selectedDocument && <p className="auth-error">{error}</p>}

          {!loading && !error && documents.length === 0 && (
            <p>No documents are ready for notarization.</p>
          )}

          {!loading && documents.length > 0 && (
            <DataTable
              headers={[
                "Document ID",
                "Entity / Client",
                "Status",
                "Last Activity",
                "Action",
              ]}
              rows={rows}
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </Panel>

        <aside className="form-card">
          <h2>Record Notarization</h2>

          <label>
            Selected Document ID
            <input
              value={selectedDocument?.tracking_number || ""}
              readOnly
              placeholder="Select a document"
            />
          </label>

          <label>
            Notarial Reference Number
            <input
              value={referenceNumber}
              disabled={processing || !canEdit}
              onChange={(event) => setReferenceNumber(event.target.value)}
              placeholder="Enter reference number"
            />
          </label>

          <label>
            Date of Notarization
            <input
              type="date"
              value={notarizationDate}
              disabled={processing || !canEdit}
              onChange={(event) => setNotarizationDate(event.target.value)}
            />
          </label>

          <label>
            Notary Public Signature Code
            <input
              value={signatureCode}
              disabled={processing || !canEdit}
              onChange={(event) => setSignatureCode(event.target.value)}
              placeholder="Enter signature code"
            />
          </label>

          {selectedDocument && (
            <p>
              <b>Status:</b> {selectedDocument.status}
            </p>
          )}

          {selectedDocument?.status === "Notarized" && (
            <div className="notice">
              <b>Notarization Completed</b>
              <p>
                Reference Number:{" "}
                {selectedDocument.notarial_reference_number || "-"}
              </p>
              <p>
                Notarization Date:{" "}
                {selectedDocument.notarization_date || "-"}
              </p>
              <p>
                Signature Code: {selectedDocument.notary_signature_code || "-"}
              </p>
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="success-message">{success}</p>}

          {selectedDocument?.status === "Approved" && (
            <button
              type="button"
              disabled={processing}
              onClick={submitNotarization}
            >
              {processing ? "Submitting..." : "Submit for Notarization"}
            </button>
          )}

          {selectedDocument?.status === "Pending Notarization" && (
            <button
              type="button"
              disabled={processing}
              onClick={completeNotarization}
            >
              {processing ? "Completing..." : "Complete Notarization"}
            </button>
          )}

          {selectedDocument?.status === "Notarized" && (
            <button type="button" disabled>
              Notarization Completed
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
