import React, {
  useEffect,
  useState,
} from "react";
import {
  ClipboardCheck,
  Download,
  ShieldAlert,
} from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import {
  exportAuditLogs,
  getAuditLogs,
} from "../../../services/superAdminService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function Page() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function loadLogs() {
    setLoading(true);
    setError("");

    try {
      const response = await getAuditLogs({
        page,
        search,
        sort: "created_at",
        direction: "desc",
      });

      setLogs(response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (requestError) {
      reportClientError("Unable to load audit logs:", requestError);
      setError(requestError.message || "Unable to load audit logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [page]);

  async function exportLogs() {
    setExporting(true);
    setError("");

    try {
      const { blob, filename } = await exportAuditLogs({ search });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = href;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(href);
    } catch (requestError) {
      reportClientError("Unable to export audit logs:", requestError);
      setError(requestError.message || "Unable to export audit logs.");
    } finally {
      setExporting(false);
    }
  }

  const rows = logs.map((log) => [
    log.created_at ? new Date(log.created_at).toLocaleString() : "-",
    log.user || "System",
    formatRole(log.role),
    log.action || "-",
    "Recorded",
  ]);

  return (
    <section className="super-admin-page">
      <PageTitle
        title="Audit Logs"
        subtitle="Review administrative activity recorded by CONEXIA."
      >
        <Button icon={Download} onClick={exportLogs} disabled={exporting}>
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </PageTitle>

      <Panel title="Administrative Audit Entries">
        <form
          className="admin-filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            loadLogs();
          }}
        >
          <label>
            Search audit logs
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user or activity"
            />
          </label>
          <button type="submit" disabled={loading}>
            Search
          </button>
          <button type="button" onClick={loadLogs} disabled={loading}>
            <ClipboardCheck size={16} />
            Refresh
          </button>
        </form>

        {loading && <p>Loading audit logs...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <section className="audit-empty">
            <ShieldAlert size={24} />
            <div>
              <strong>No audit entries found</strong>
              <p>Administrative actions will appear here after they are recorded.</p>
            </div>
          </section>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={["Timestamp", "User", "Role", "Activity", "Status"]}
            rows={rows}
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>
    </section>
  );
}

function formatRole(role) {
  return String(role || "-")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
