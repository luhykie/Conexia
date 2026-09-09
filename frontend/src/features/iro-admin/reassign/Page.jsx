import React from "react";
import { Eye } from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  reassignDocumentToLegal,
} from "../../../services/iroAdminService";
import { getReassignableIroDocuments } from "../../../services/iroDocumentService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminReassignPage() {
  const drawerRef = React.useRef(null);
  const drawerCloseRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
  const [destinationId, setDestinationId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState("");

  const loadAssignments = React.useCallback(async (isActive = () => true) => {
    setLoading(true);
    setError("");

    try {
      const documentResponse = await getReassignableIroDocuments({ page });
      const loadedDocuments = (
        documentResponse.documents ?? documentResponse.data ?? []
      ).filter((document) =>
        document.status !== "Archived" &&
        (document.reassignment_destinations?.length ?? 0) > 0
      );

      if (isActive()) {
        setDocuments(loadedDocuments);
        setMeta(documentResponse.meta ?? null);
        setSelectedDocument((current) => {
          if (!loadedDocuments.length) return null;

          return loadedDocuments.find((document) => document.id === current?.id) || null;
        });
      }
    } catch (requestError) {
      reportClientError("Unable to load assignments:", requestError);

      if (isActive()) {
        setError(requestError.message);
        setDocuments([]);
        setSelectedDocument(null);
      }
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    let active = true;

    loadAssignments(() => active);

    return () => {
      active = false;
    };
  }, [loadAssignments]);

  React.useEffect(() => {
    setDestinationId("");
    setReason("");
    setSuccess("");
    setError("");
  }, [selectedDocument?.id]);

  React.useEffect(() => {
    if (!selectedDocument) return undefined;

    drawerCloseRef.current?.focus();

    return undefined;
  }, [selectedDocument?.id]);

  React.useEffect(() => {
    if (!selectedDocument) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape" && !submitting) {
        closeDrawer();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll(
        'button:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedDocument, submitting]);

  const destinationOptions = React.useMemo(
    () => selectedDocument?.reassignment_destinations ?? [],
    [selectedDocument?.reassignment_destinations],
  );

  React.useEffect(() => {
    if (destinationOptions.length === 1) {
      setDestinationId(destinationOptions[0].key);
      return;
    }

    if (
      destinationId &&
      !destinationOptions.some((destination) => destination.key === destinationId)
    ) {
      setDestinationId("");
    }
  }, [destinationOptions, destinationId]);

  function openDrawer(document, trigger) {
    triggerRef.current = trigger;
    setSelectedDocument(document);
  }

  function closeDrawer() {
    if (submitting) return;

    const trigger = triggerRef.current;
    setSelectedDocument(null);
    window.requestAnimationFrame(() => trigger?.focus());
  }

  const rows = documents.map((document) => [
    document.title || "-",
    document.tracking_number || "-",
    document.partnership_scope || "-",
    document.document_type || "-",
    document.status || "-",
    <button
      type="button"
      className="iro-dashboard-view-action"
      key={document.id}
      aria-label={`Reassign ${document.tracking_number || "submission"}`}
      title="Open reassignment"
      onClick={(event) => openDrawer(document, event.currentTarget)}
    >
      <Eye size={16} aria-hidden="true" />
    </button>,
  ]);

  async function submitReassignment(event) {
    event.preventDefault();

    if (!selectedDocument?.id) {
      setError("Select a submission before reassigning.");
      return;
    }

    const selectedDestination = destinationOptions.find(
      (destination) => destination.key === destinationId,
    );

    if (!selectedDestination) {
      setError("Select a valid reassignment destination.");
      return;
    }

    if (!reason.trim()) {
      setError("Enter a reason for reassignment.");
      return;
    }

    if (!window.confirm("Reassign this submission to the selected destination?")) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await reassignDocumentToLegal(
        selectedDocument.id,
        selectedDestination,
        reason.trim(),
      );
      setReason("");
      setDestinationId("");
      setSuccess("Submission reassigned successfully.");
      await loadAssignments(() => true);
    } catch (requestError) {
      reportClientError("Unable to reassign submission:", requestError);
      setError(requestError.message || "Unable to reassign submission.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page iro-admin-page iro-admin-reassign-page">
      <PageTitle
        title="Reassign Submissions"
        subtitle="Review active case assignments and workload distribution."
      />

      <Panel title="Active Assignments">
          {loading && <p>Loading active assignments...</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p>No active assignments are available.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <DataTable
              headers={[
                "Partner/Institution",
                "Tracking Number",
                "Partnership Scope",
                "Document Type",
                "Status",
                "Action",
              ]}
              rows={rows}
              meta={meta}
              onPageChange={setPage}
              columnClasses={[
                "",
                "",
                "iro-reassign-column--center",
                "iro-reassign-column--center",
                "iro-reassign-column--center iro-reassign-column--status",
                "iro-reassign-column--center",
              ]}
              statusColumnIndex={4}
              rowClasses={documents.map((document) =>
                document.id === selectedDocument?.id ? "iro-reassign-row--selected" : "")}
            />
          )}
      </Panel>

      {selectedDocument && (
        <div
          className="iro-reassign-drawer-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
        <form
          ref={drawerRef}
          className="form-card iro-reassign-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="iro-reassign-drawer-title"
          onSubmit={submitReassignment}
        >
          <header className="iro-reassign-drawer__header">
            <h2 id="iro-reassign-drawer-title">Assignment Details</h2>
            <button
              ref={drawerCloseRef}
              type="button"
              className="outline"
              onClick={closeDrawer}
              disabled={submitting}
            >
              Close
            </button>
          </header>
          <div className="selected-record">
            {selectedDocument?.tracking_number || "Select a submission"}
            <br />
            <small>
              {selectedDocument?.partner_institution ||
                selectedDocument?.title ||
                "No record selected"}
            </small>
          </div>

          <div className="assignment-context">
            <span>Current Assignment</span>
            <b>{selectedDocument?.current_assignment?.label || "Not assigned"}</b>
          </div>

          <label>
            Reassign To
            {destinationOptions.length === 1 ? (
              <div className="selected-record reassignment-assignee">
                <small>{destinationOptions[0].category}</small>
                <b>{destinationOptions[0].label}</b>
                {destinationOptions[0].email && (
                  <small>{destinationOptions[0].email}</small>
                )}
              </div>
            ) : (
              <select
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
                disabled={
                  !selectedDocument ||
                  submitting ||
                  destinationOptions.length === 0
                }
                required
              >
                <option value="">
                  {destinationOptions.length === 0
                    ? "No valid destinations"
                    : "Select destination"}
                </option>
                {destinationOptions.map((destination) => (
                  <option key={destination.key} value={destination.key}>
                    {destination.category}: {destination.label}
                  </option>
                ))}
              </select>
            )}
          </label>

          {selectedDocument && destinationOptions.length === 0 && (
            <p className="auth-error">
              This submission has no valid reassignment destination for its current workflow state.
            </p>
          )}

          <label>
            Reason for Reassignment
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Enter the reassignment reason."
              disabled={!selectedDocument || submitting}
              required
            />
          </label>

          {success && <p className="success-message">{success}</p>}

          <button
            type="submit"
            disabled={
              !selectedDocument ||
              submitting ||
              destinationOptions.length === 0 ||
              !destinationId ||
              !reason.trim()
            }
          >
            {submitting ? "Reassigning..." : "Confirm Reassignment"}
          </button>
        </form>
        </div>
      )}
    </section>
  );
}
