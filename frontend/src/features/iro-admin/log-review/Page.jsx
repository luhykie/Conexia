import React from "react";

import { DataTable } from "../../../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { useNavigate } from "react-router-dom";
import { DocumentReviewPage } from "../../../components/DocumentReviewPanel";
import { getIncomingDocuments } from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminLogReviewPage({ documentId }) {
  const navigate = useNavigate();
  const [documents, setDocuments] = React.useState([]);
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

    if (documentId) {
      return () => { active = false; };
    }

    async function loadIncoming() {
      setLoading(true);
      setError("");

      try {
          const response = await getIncomingDocuments({
            page,
            ...queryParams,
          });

        if (active) {
          const loadedDocuments = response.documents ?? response.data ?? [];
          setDocuments(loadedDocuments);
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load incoming documents:", requestError);

        if (active) {
          setError(requestError.message);
          setDocuments([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadIncoming();

    return () => {
      active = false;
    };
  }, [documentId, page, queryParams]);

  const rows = documents.map((document) => [
    document.tracking_number,
    partnershipScope(document),
    document.partner_institution || "-",
    document.document_type || "-",
    document.review_status || document.status || "-",
    <button
      type="button"
      className="table-action"
      key={document.id}
      onClick={() => navigate(`/app/log-review/${document.id}`)}
    >
      Review
    </button>,
  ]);

  if (documentId) {
    return <DocumentReviewPage documentId={documentId} />;
  }

  return (
    <section className="page iro-admin-page iro-admin-log-review-page">
      <PageTitle
        title="Log & Review"
        subtitle="Review documents processed and routed by IRO Staff."
      />

      <Panel title="Logged Documents">
          <DocumentFilters
            filters={filters}
            onChange={changeFilter}
            onClear={() => {
              clearFilters();
              setPage(1);
            }}
            statusOptions={["Logged", "Revised"]}
            partnershipScopeOptions={["Local", "Departmental", "International"]}
            showDepartment
          />
          {loading && <p>Loading incoming documents...</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p>No logged documents are awaiting IRO Admin review.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <DataTable
              headers={[
                "Tracking #",
                "Partnership Scope",
                "Partner",
                "Document Type",
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

function partnershipScope(document) {
  const scope = document.partnership_scope || document.partnership_type;
  return ["Departmental", "Local", "International"].includes(scope)
    ? scope
    : "-";
}
