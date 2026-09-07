import React from "react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { getLegalHistory } from "../../../services/legalCounselServices";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function LegalCounselHistoryPage() {
  const [historyItems, setHistoryItems] = React.useState([]);
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
    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await getLegalHistory({
          page,
          ...queryParams,
        });
        const loadedHistory =
          response.history ?? response.data ?? response.items ?? [];

        setHistoryItems(loadedHistory);
        setMeta(response.meta ?? null);
      } catch (requestError) {
        reportClientError("Unable to load legal action history:", requestError);
        setError(requestError.message);
        setHistoryItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [page, queryParams]);

  return (
    <section className="page legal-page legal-counsel-history-page">
      <PageTitle
        title="Legal Action History"
        subtitle="Audit Log & Activity"
      />

      <div>
        <Panel title="Audit Log & Activity">
          <DocumentFilters
            filters={filters}
            onChange={changeFilter}
            onClear={() => {
              clearFilters();
              setPage(1);
            }}
            statusOptions={[
              "Correction Required",
              "Corrections Needed",
              "Approved",
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
          {loading && <p>Loading legal action history...</p>}
          {error && <p className="auth-error">{error}</p>}

          {!loading && !error && historyItems.length === 0 && (
            <p>No legal actions recorded yet.</p>
          )}

          {!loading &&
            !error &&
            historyItems.map((item, index) => {
              const title = Array.isArray(item)
                ? item[0]
                : item.title ||
                  item.action ||
                  item.status ||
                  "Legal action";
              const detail = Array.isArray(item)
                ? item[1]
                : item.detail ||
                  item.description ||
                  item.message ||
                  item.legal_notes ||
                  "";
              const status = Array.isArray(item)
                ? item[2]
                : item.badge || item.status || item.type || "Recorded";
              const isDanger = [
                "Correction",
                "Corrections Needed",
                "Rejected",
              ].includes(status);

              return (
                <div
                  className={`timeline-item ${isDanger ? "danger" : ""}`}
                  key={`${title}-${index}`}
                >
                  <b>{title}</b>
                  <p>{detail}</p>
                  <span className={`badge ${isDanger ? "danger" : ""}`}>
                    {status}
                  </span>
                </div>
              );
            })}

          {!loading && !error && historyItems.length > 0 && meta && (
            <div className="table">
              <footer>
                Showing {meta.from || 0}-{meta.to || 0} of {meta.total} records
                <div>
                  <button
                    disabled={meta.current_page <= 1}
                    onClick={() => setPage(meta.current_page - 1)}
                  >
                    &lt;
                  </button>
                  <button className="active-page">{meta.current_page}</button>
                  <button
                    disabled={meta.current_page >= meta.last_page}
                    onClick={() => setPage(meta.current_page + 1)}
                  >
                    &gt;
                  </button>
                </div>
              </footer>
            </div>
          )}
        </Panel>

      </div>
    </section>
  );
}
