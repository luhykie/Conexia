import React from "react";

import { DataTable } from "../../../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  Dropzone,
} from "../../../components/SharedViews";
import { getIncomingDocuments } from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminLogReviewPage() {
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

    async function loadIncoming() {
      setLoading(true);
      setError("");

      try {
          const response = await getIncomingDocuments({
            page,
            ...queryParams,
          });

        if (active) {
          setDocuments(response.documents ?? response.data ?? []);
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
  }, [page, queryParams]);

  const rows = documents.map((document) => [
    document.tracking_number,
    document.department?.code || document.department?.name || "-",
    document.partner_institution || "-",
    document.document_type || "-",
    document.status || "-",
  ]);

  return (
    <section className="page iro-admin-page iro-admin-log-review-page">
      <PageTitle
        title="Log & Review Form"
        subtitle="Monitor incoming agreements and administrative review readiness."
      />

      <div className="two-col">
        <Panel title="Incoming Queue">
          <DocumentFilters
            filters={filters}
            onChange={changeFilter}
            onClear={() => {
              clearFilters();
              setPage(1);
            }}
            statusOptions={["Submitted", "Logged"]}
            showDepartment
            unsupported={{
              document_type: true,
              partnership_scope: true,
              date_from: true,
              date_to: true,
              department: true,
            }}
          />
          {loading && <p>Loading incoming documents...</p>}
          {error && <p className="auth-error">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p>No incoming records are available.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <DataTable
              headers={[
                "Tracking #",
                "Department",
                "Partner",
                "Document Type",
                "Status",
              ]}
              rows={rows}
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </Panel>

        <aside className="review-panel">
          <h2>Administrative Review</h2>
          {[
            "Signatures Present",
            "Terms Defined",
            "Attachments Included",
            "GDPR Compliance",
          ].map((item) => (
            <label className="checkline" key={item}>
              <input type="checkbox" disabled /> {item}
            </label>
          ))}

          <label>
            Route To
            <select disabled>
              <option>Use IRO Staff assignment workflow</option>
            </select>
          </label>

          <label>
            Staff Remarks
            <textarea
              placeholder="Standalone admin review submission is unavailable."
              disabled
            />
          </label>

          <Panel title="Document Upload">
            <Dropzone detail="Use the document file panel on a routed record." />
          </Panel>

          <button type="button" disabled>
            Submit & Route unavailable
          </button>
          <button type="button" className="outline" disabled>
            Save Draft unavailable
          </button>
        </aside>
      </div>
    </section>
  );
}
