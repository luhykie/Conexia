import React from "react";
import {
  CheckCircle2,
  FileText,
  Folder,
} from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  ExportButton,
  FilterBar,
} from "../../../components/SharedViews";
import { StatGrid } from "../../../components/StatGrid";
import {
  assignDocumentToLegal,
  getActiveLegalCounselUsers,
  getIncomingDocuments,
  markDocumentAsLogged,
} from "../../../services/iroStaffService";
import { createNotification } from "../../../utils/notifications";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroStaffIncomingPage() {
  const [documents, setDocuments] = React.useState([]);
  const [legalUsers, setLegalUsers] = React.useState([]);
  const [selectedLegal, setSelectedLegal] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
  const [processingId, setProcessingId] = React.useState(null);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const response = await getIncomingDocuments({ page });

      setDocuments(response.documents ?? response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (requestError) {
      reportClientError("Unable to load documents:", requestError);
      setError(requestError.message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadLegalUsers() {
    try {
      const response = await getActiveLegalCounselUsers();

      setLegalUsers(response.data ?? response.users ?? []);
    } catch (requestError) {
      reportClientError(
        "Unable to load Legal Counsel users:",
        requestError,
      );
      setLegalUsers([]);
    }
  }

  React.useEffect(() => {
    Promise.all([loadDocuments(), loadLegalUsers()]);
  }, [page]);

  async function markAsLogged(documentId) {
    const confirmed = window.confirm(
      "Are you sure you want to mark this document as Logged?",
    );

    if (!confirmed) return;

    setProcessingId(documentId);
    setError("");
    setSuccess("");

    try {
      const response = await markDocumentAsLogged(documentId);
      const updatedDocument = response.document ?? response.data;

      if (!updatedDocument) {
        setError(
          "The document was not logged. Refresh the page and check its current status.",
        );
        return;
      }

      setSuccess("Document marked as Logged.");
      await loadDocuments();
    } catch (requestError) {
      reportClientError("Unable to mark document as Logged:", requestError);
      setError(requestError.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function assignLegal(documentId) {
    const legalCounselId = selectedLegal[documentId];

    if (!legalCounselId) {
      setError("Select a Legal Counsel account before assigning the document.");
      return;
    }

    const documentToAssign = documents.find(
      (document) => document.id === documentId,
    );

    if (!documentToAssign) {
      setError("The selected document could not be found.");
      return;
    }

    const selectedCounsel = legalUsers.find(
      (user) => user.id === legalCounselId,
    );

    const confirmed = window.confirm(
      `Assign this document to ${
        selectedCounsel?.full_name ||
        selectedCounsel?.email ||
        "the selected Legal Counsel"
      }?`,
    );

    if (!confirmed) return;

    setProcessingId(documentId);
    setError("");
    setSuccess("");

    try {
      const response = await assignDocumentToLegal(
        documentId,
        legalCounselId,
      );
      const updatedDocument = response.document ?? response.data;

      if (!updatedDocument) {
        setError(
          "The document was not assigned. Refresh the page and check its current status.",
        );
        return;
      }

      const notificationResult = await createNotification({
        userId: legalCounselId,
        documentId,
        title: "New Document Assigned",
        message: `${documentToAssign.tracking_number} has been assigned to you for legal review.`,
        type: "legal_assignment",
      });

      if (!notificationResult.success) {
        reportClientError(
          "The document was assigned, but the notification failed:",
          notificationResult.error,
        );
      }

      setSuccess(
        `Document assigned to ${
          selectedCounsel?.full_name ||
          selectedCounsel?.email ||
          "Legal Counsel"
        }.`,
      );

      setSelectedLegal((currentSelection) => {
        const updatedSelection = { ...currentSelection };
        delete updatedSelection[documentId];
        return updatedSelection;
      });

      await loadDocuments();
    } catch (requestError) {
      reportClientError("Unable to assign Legal Counsel:", requestError);
      setError(requestError.message);
    } finally {
      setProcessingId(null);
    }
  }

  function getAssignedLegalName(document) {
    if (!document.assigned_legal_counsel) {
      return "Not assigned";
    }

    const assignedUser = legalUsers.find(
      (user) => user.id === document.assigned_legal_counsel,
    );

    return (
      assignedUser?.full_name ||
      assignedUser?.email ||
      "Legal Counsel Assigned"
    );
  }

  const pendingCount = documents.filter(
    (document) => document.status === "Submitted",
  ).length;
  const loggedCount = documents.filter(
    (document) => document.status === "Logged",
  ).length;
  const legalReviewCount = documents.filter(
    (document) => document.status === "Under Legal Review",
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
          {processingId === document.id ? "Logging..." : "Mark as Logged"}
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
              setSelectedLegal((currentSelection) => ({
                ...currentSelection,
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
        <span key={`assigned-${document.id}`} className="badge active">
          {getAssignedLegalName(document)}
        </span>
      );
    } else {
      actionContent = (
        <span key={`completed-${document.id}`} className="badge">
          No IRO Action
        </span>
      );
    }

    return [
      document.tracking_number,
      document.department?.code || document.department?.name || "-",
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
    <section className="page iro-staff-page iro-staff-incoming-page">
      <PageTitle
        title="Incoming Queue"
        subtitle="Receive, log, and route department submissions to Legal Counsel."
      />

      <StatGrid
        stats={[
          {
            value: String(pendingCount).padStart(2, "0"),
            label: "Pending Logging",
            icon: Folder,
            badge: "Needs Action",
          },
          {
            value: String(loggedCount).padStart(2, "0"),
            label: "Needs Assignment",
            icon: FileText,
            badge: "Route to Legal",
            tone: "warn",
          },
          {
            value: String(legalReviewCount).padStart(2, "0"),
            label: "Under Legal Review",
            icon: CheckCircle2,
            badge: "Assigned",
          },
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

      <Panel title="Active Submissions" tools={<ExportButton label="Export CSV" />}>
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
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>
    </section>
  );
}
