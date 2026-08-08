import React from "react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  getActiveLegalCounselUsers,
  getIroStatusDocuments,
} from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminReassignPage() {
  const [documents, setDocuments] = React.useState([]);
  const [legalUsers, setLegalUsers] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    async function loadAssignments() {
      setLoading(true);
      setError("");

      try {
        const [documentResponse, userResponse] = await Promise.all([
          getIroStatusDocuments({ page }),
          getActiveLegalCounselUsers(),
        ]);
        const loadedDocuments = documentResponse.documents ?? documentResponse.data ?? [];

        if (active) {
          setDocuments(loadedDocuments);
          setMeta(documentResponse.meta ?? null);
          setLegalUsers(userResponse.data ?? userResponse.users ?? []);
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

        if (active) {
          setError(requestError.message);
          setDocuments([]);
          setSelectedDocument(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAssignments();

    return () => {
      active = false;
    };
  }, [page]);

  function getCounselName(document) {
    if (!document?.assigned_legal_counsel) return "Not assigned";

    const user = legalUsers.find(
      (legalUser) => legalUser.id === document.assigned_legal_counsel,
    );

    return user?.full_name || user?.email || "Legal Counsel";
  }

  const rows = documents.map((document) => [
    document.tracking_number,
    document.department?.code || document.department?.name || "-",
    getCounselName(document),
    document.status || "-",
    <button
      type="button"
      className="table-action"
      key={document.id}
      onClick={() => setSelectedDocument(document)}
    >
      Select
    </button>,
  ]);

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

        <aside className="form-card">
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

          <label>
            Reassign To
            <select disabled>
              <option>Reassignment endpoint unavailable</option>
            </select>
          </label>

          <label>
            Reason for Reassignment
            <textarea
              placeholder="Reassignment requests are disabled until a backend endpoint is available."
              disabled
            />
          </label>

          <button type="button" disabled>
            Confirm Reassignment unavailable
          </button>
          <button type="button" className="outline" disabled>
            Cancel Request unavailable
          </button>
        </aside>
      </div>
    </section>
  );
}
