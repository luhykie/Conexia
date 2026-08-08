import React from "react";

import { DataTable } from "../../../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { getIroStatusDocuments } from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminEngagementsPage() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
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
            if (!loadedDocuments.length) return null;

            return (
              loadedDocuments.find((document) => document.id === current?.id) ||
              loadedDocuments[0]
            );
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

  const rows = documents.map((document) => [
    document.partner_institution || "-",
    `${document.document_type || "-"} / ${
      document.department?.code || document.department?.name || "-"
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
    <section className="page split-page iro-admin-page iro-admin-engagements-page">
      <div>
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
              "Pending Notarization",
              "Notarized",
              "Archived",
            ]}
            showDepartment
            unsupported={{
              document_type: true,
              partnership_scope: true,
              date_from: true,
              date_to: true,
              department: true,
            }}
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

      <aside className="detail-drawer">
        <span className="badge">Partner Record</span>
        <h2>{selectedDocument?.partner_institution || "Select an engagement"}</h2>
        <p>
          {selectedDocument?.description ||
            "Select a partner agreement to view its current lifecycle status."}
        </p>
        <div className="mini-grid">
          <span>
            Status
            <b>{selectedDocument?.status || "-"}</b>
          </span>
          <span>
            Type
            <b>{selectedDocument?.document_type || "-"}</b>
          </span>
        </div>
        <button className="primary wide-inline" type="button" disabled>
          Edit Engagement unavailable
        </button>
      </aside>
    </section>
  );
}
