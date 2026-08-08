import React from "react";
import {
  Archive,
  CalendarClock,
  Info,
  Shield,
} from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { StatGrid } from "../../../components/StatGrid";
import { getArchiveSummary } from "../../../services/workflowSummaryService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminArchivePage() {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    async function loadArchive() {
      setLoading(true);
      setError("");

      try {
        const response = await getArchiveSummary({ page });

        if (active) {
          setSummary(response.data ?? {});
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load archive records:", requestError);

        if (active) {
          setError(requestError.message);
          setSummary(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadArchive();

    return () => {
      active = false;
    };
  }, [page]);

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
    <button type="button" className="table-action" disabled key={record.id}>
      View unavailable
    </button>,
  ]);

  return (
    <section className="page iro-admin-page iro-admin-archive-page">
      <PageTitle
        title="Records Archive"
        subtitle="Secure workspace for finalizing agreement distribution and archival."
        action="Export Registry"
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
        {loading && <p>Loading archive records...</p>}
        {error && <p className="auth-error">{error}</p>}
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
