import React from "react";
import {
  Archive,
  CalendarClock,
  Info,
  Shield,
} from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { StatGrid } from "../../../components/StatGrid";
import { getArchiveSummary } from "../../../services/workflowSummaryService";
import { unarchiveIroDocument } from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminArchivePage() {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
  const [processingId, setProcessingId] = React.useState(null);
  const [success, setSuccess] = React.useState("");
  const {
    filters,
    queryParams,
    updateFilter,
    clearFilters,
  } = useDocumentFilters({ status: "Archived" });

  function changeFilter(key, value) {
    updateFilter(key, value);
    setPage(1);
  }

  const loadArchive = React.useCallback(async (isActive = () => true) => {
      setLoading(true);
      setError("");

      try {
        const response = await getArchiveSummary({
          page,
          ...queryParams,
        });

        if (isActive()) {
          setSummary(response.data ?? {});
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load archive records:", requestError);

        if (isActive()) {
          setError(requestError.message);
          setSummary(null);
        }
      } finally {
        if (isActive()) setLoading(false);
      }
  }, [page, queryParams]);

  React.useEffect(() => {
    let active = true;

    loadArchive(() => active);

    return () => {
      active = false;
    };
  }, [loadArchive]);

  async function unarchiveRecord(record) {
    if (!record?.id) return;

    if (!window.confirm(`Unarchive ${record.tracking_number || "this record"}?`)) {
      return;
    }

    setProcessingId(record.id);
    setError("");
    setSuccess("");

    try {
      await unarchiveIroDocument(record.id);
      setSuccess("Record unarchived successfully.");
      await loadArchive(() => true);
    } catch (requestError) {
      reportClientError("Unable to unarchive record:", requestError);
      setError(requestError.message || "Unable to unarchive record.");
    } finally {
      setProcessingId(null);
    }
  }

  const stats = summary?.stats ?? {};
  const rows = (summary?.records ?? []).map((record) => [
    record.tracking_number || "-",
    record.partner_institution || "-",
    record.document_type || "-",
    record.distribution_date
      ? new Date(record.distribution_date).toLocaleDateString()
      : "-",
    record.completion || "-",
    record.status || "-",
    <button
      type="button"
      className="table-action"
      disabled={processingId === record.id}
      key={record.id}
      onClick={() => unarchiveRecord(record)}
    >
      {processingId === record.id ? "Restoring..." : "Unarchive"}
    </button>,
  ]);

  return (
    <section className="page iro-admin-page iro-admin-archive-page">
      <PageTitle
        title="Records Archive"
        subtitle="Secure workspace for finalizing agreement distribution and archival."
      />

      <StatGrid
        stats={[
          {
            value: String(stats.total_archived ?? 0),
            label: "Total Archived",
            icon: Archive,
          },
          {
            value: String(stats.finalized_today ?? 0),
            label: "Finalized Today",
            icon: Shield,
          },
          {
            value: String(stats.pending_archival ?? 0),
            label: "Pending Archival",
            icon: CalendarClock,
            tone: "warn",
          },
          {
            value: String(stats.audit_flags ?? 0),
            label: "Audit Flags",
            icon: Info,
            tone: "danger",
          },
        ]}
      />

      <Panel title="Archive Records">
        <DocumentFilters
          filters={filters}
          onChange={changeFilter}
          onClear={() => {
            clearFilters();
            setPage(1);
          }}
          statusOptions={["Archived"]}
          showDepartment
          unsupported={{
            partnership_scope: true,
          }}
        />
        {loading && <p>Loading archive records...</p>}
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        {!loading && !error && rows.length === 0 && (
          <p>No archived records are available.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={[
              "Tracking ID",
              "Partner Name",
              "Type",
              "Distribution Date",
              "Completion",
              "Status",
              "Actions",
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
