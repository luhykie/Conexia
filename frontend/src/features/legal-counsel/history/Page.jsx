import React from "react";
import { ShieldCheck } from "lucide-react";

import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { getLegalHistory } from "../../../services/legalCounselServices";
import {
  getExpirySummary,
  requestDocumentRenewal,
} from "../../../services/workflowSummaryService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function LegalCounselHistoryPage() {
  const [historyItems, setHistoryItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
  const [expiryItems, setExpiryItems] = React.useState([]);
  const [expiryError, setExpiryError] = React.useState("");
  const [expiryProcessingId, setExpiryProcessingId] = React.useState(null);
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

  React.useEffect(() => {
    async function loadExpiry() {
      setExpiryError("");

      try {
        const response = await getExpirySummary();

        setExpiryItems(
          response.data?.records ?? response.data?.upcoming ?? [],
        );
      } catch (requestError) {
        reportClientError("Unable to load legal expiry records:", requestError);
        setExpiryError(requestError.message);
        setExpiryItems([]);
      }
    }

    loadExpiry();
  }, []);

  async function requestRenewal(record) {
    if (!record?.id) return;

    setExpiryProcessingId(record.id);
    setExpiryError("");

    try {
      await requestDocumentRenewal(record.id);
      const response = await getExpirySummary();

      setExpiryItems(
        response.data?.records ?? response.data?.upcoming ?? [],
      );
    } catch (requestError) {
      reportClientError("Unable to flag document for renewal:", requestError);
      setExpiryError(requestError.message);
    } finally {
      setExpiryProcessingId(null);
    }
  }

  return (
    <section className="page legal-page legal-counsel-history-page">
      <PageTitle
        title="Legal Action History"
        subtitle="Audit Log & Activity"
      />

      <div className="two-col">
        <Panel title="Audit Log & Activity">
          <DocumentFilters
            filters={filters}
            onChange={changeFilter}
            onClear={() => {
              clearFilters();
              setPage(1);
            }}
            statusOptions={[
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

        <Panel title="Expiring Soon">
          {expiryError && <p className="auth-error">{expiryError}</p>}

          {!expiryError && expiryItems.length === 0 && (
            <p>No assigned documents are expiring soon.</p>
          )}

          {!expiryError &&
            expiryItems.map((record) => (
              <div
                className={`notice ${
                  record.classification === "expired" ? "danger" : "warn"
                }`}
                key={record.id}
              >
                <b>
                  {record.partner_institution ||
                    record.document_name ||
                    record.tracking_number}
                </b>
                <p>
                  {record.expiry} - {record.tracking_number}
                </p>
                <button
                  className={
                    record.classification === "expired"
                      ? "primary"
                      : "outline"
                  }
                  disabled={
                    expiryProcessingId === record.id ||
                    record.renewal_status === "renewal_requested"
                  }
                  onClick={() => requestRenewal(record)}
                >
                  {expiryProcessingId === record.id
                    ? "Flagging..."
                    : record.renewal_status === "renewal_requested"
                      ? "Renewal Flagged"
                      : "Flag for Renewal"}
                </button>
              </div>
            ))}

          <section className="dark-card">
            <ShieldCheck />
            <div>
              <h2>Compliance Status</h2>
              <p>
                {expiryItems.length} assigned agreement
                {expiryItems.length === 1 ? "" : "s"} require renewal attention.
              </p>
            </div>
          </section>
        </Panel>
      </div>
    </section>
  );
}
