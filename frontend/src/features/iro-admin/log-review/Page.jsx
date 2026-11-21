// [FEATURE: Shared/Utility] - provides shared application infrastructure and reusable interface behavior.
import React from "react";
import { Eye } from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { useNavigate } from "react-router-dom";
import { DocumentReviewPage } from "../../../components/DocumentReviewPanel";
import {
  routeLegalCorrectionToDepartment,
} from "../../../services/iroAdminService";
import { getIncomingDocuments } from "../../../services/iroDocumentService";
import { reportClientError } from "../../../utils/reportClientError";
import {
  documentTableHeaders,
  documentTableValues,
  iroDocumentTableFilterDefinitions,
} from "../../../utils/documentTable";
import "./Page.css";

// Shows the IRO review queue or one selected review workspace.
export default function IroAdminLogReviewPage({ documentId }) {
  const navigate = useNavigate();
  const [documents, setDocuments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [routingId, setRoutingId] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  // Sends Legal's correction request to the originating department.
  async function routeCorrection(document) {
    setRoutingId(document.id);
    setError("");

    try {
      await routeLegalCorrectionToDepartment(document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } catch (requestError) {
      reportClientError("Unable to route legal correction:", requestError);
      setError(requestError.message);
    } finally {
      setRoutingId("");
    }
  }

  React.useEffect(() => {
    let active = true;

    if (documentId) {
      return () => { active = false; };
    }

    // Fetches the current page of documents waiting for IRO action.
    async function loadIncoming() {
      setLoading(true);
      setError("");

      try {
          const response = await getIncomingDocuments({
            page,
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
  }, [documentId, page]);

  const rows = documents.map((document) => [
    ...documentTableValues(document),
    document.review_status || document.status || "-",
    document.status === "Correction Required" && !isIroAdminCreated(document) ? (
      <button
        type="button"
        className="table-action"
        key={document.id}
        disabled={routingId === document.id}
        onClick={() => routeCorrection(document)}
      >
        {routingId === document.id ? "Routing..." : "Route to Department"}
      </button>
    ) : (
      <button
        type="button"
        className="iro-dashboard-view-action"
        key={document.id}
        aria-label={`Review ${document.tracking_number || "document"}`}
        title="View document"
        onClick={() => navigate(`/app/log-review/${document.id}`)}
      >
        <Eye size={16} aria-hidden="true" />
      </button>
    ),
  ]);

  if (documentId) {
    return <DocumentReviewPage documentId={documentId} />;
  }

  return (
    <section className="page iro-admin-page iro-admin-log-review-page">
      <PageTitle
        title="Log & Review"
        subtitle="Review documents submitted by departments and IRO Admin."
      />

      <Panel title="Logged Documents">
          {loading && <p>Loading incoming documents...</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p>No logged documents are awaiting IRO Admin review.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <DataTable
              headers={[...documentTableHeaders, "Action"]}
              rows={rows}
              meta={meta}
              onPageChange={setPage}
              columnClasses={[
                "",
                "",
                "",
                "",
                "iro-log-review-column--center",
                "iro-log-review-column--center",
                "iro-log-review-column--status",
                "",
              ]}
              statusColumnIndex={6}
              filterDefinitions={iroDocumentTableFilterDefinitions}
            />
          )}
      </Panel>
    </section>
  );
}

// Identifies engagements created directly by an IRO Admin.
function isIroAdminCreated(document) {
  return document.created_by?.role === "iro_admin";
}
