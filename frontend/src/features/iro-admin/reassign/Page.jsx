import React from "react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  getIroStatusDocuments,
  reassignDocumentToLegal,
} from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminReassignPage() {
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
      const documentResponse = await getIroStatusDocuments({ page });
      const loadedDocuments = documentResponse.documents ?? documentResponse.data ?? [];

      if (isActive()) {
        setDocuments(loadedDocuments);
        setMeta(documentResponse.meta ?? null);
        setSelectedDocument((current) => {
          if (!loadedDocuments.length) return null;

          return (
            loadedDocuments.find((document) => document.id === current?.id) ||
            loadedDocuments[0]
          );
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

  function getAssignmentName(document) {
    return document?.current_assignment?.label || "Not assigned";
  }

  const rows = documents.map((document) => [
    document.tracking_number,
    document.department?.code || document.department?.name || "PAIR/IRO",
    getAssignmentName(document),
    document.status || "-",
    isTerminal(document) ? (
      <span key={document.id}>No reassignment</span>
    ) : (
      <button
        type="button"
        className="table-action"
        key={document.id}
        onClick={() => setSelectedDocument(document)}
      >
        Select
      </button>
    ),
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

  function resetForm() {
    setDestinationId(
      destinationOptions.length === 1 ? destinationOptions[0].key : "",
    );
    setReason("");
    setError("");
    setSuccess("");
  }

  function isTerminal(document) {
    return ["Archived", "Notarized"].includes(document?.status);
  }

  return (
    <section className="page iro-admin-page iro-admin-reassign-page">
      <PageTitle
        title="Reassign Submissions"
        subtitle="Review active case assignments and workload distribution."
      />

      <div className="two-col">
        <Panel title="Active Assignments">
          {loading && <p>Loading active assignments...</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p>No active assignments are available.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <DataTable
              headers={[
                "Submission ID",
                "Department",
                "Current Assignee",
                "Status",
                "Action",
              ]}
              rows={rows}
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </Panel>

        <form className="form-card" onSubmit={submitReassignment}>
          <h2>Assignment Details</h2>
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
              destinationOptions.length === 0
            }
          >
            {submitting ? "Reassigning..." : "Confirm Reassignment"}
          </button>
          <button
            type="button"
            className="outline"
            onClick={resetForm}
            disabled={submitting}
          >
            Cancel Request
          </button>
        </form>
      </div>
    </section>
  );
}
