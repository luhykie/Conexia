import React from "react";
import {
  FileCheck2,
  RefreshCw,
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
import { getReportSummary } from "../../../services/workflowSummaryService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminReportsPage() {
  const [summary, setSummary] = React.useState(null);
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

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
          const response = await getReportSummary({
            page,
            ...queryParams,
          });

        if (active) {
          setSummary(response.data ?? {});
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load report summary:", requestError);

        if (active) {
          setError(requestError.message);
          setSummary(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, [page, queryParams]);

  const stats = summary?.stats ?? {};
  const breakdownRows = (summary?.department_breakdown ?? []).map((row) => [
    row.department,
    row.total_requests,
    row.approved,
    row.returned,
    row.average_turnaround,
    row.success_rate,
  ]);

  return (
    <section className="page iro-admin-page iro-admin-reports-page">
      <PageTitle
        title="Institutional Performance Reports"
        subtitle="Institutional oversight"
      />

      <StatGrid
        stats={[
          {
            value: String(stats.total_reviewed ?? 0),
            label: "Total Reviewed",
            icon: FileCheck2,
          },
          {
            value: String(stats.total_returned ?? 0),
            label: "Total Returned",
            icon: RefreshCw,
            tone: "danger",
          },
          {
            value: String(stats.total_notarized ?? 0),
            label: "Total Notarized",
            icon: Shield,
          },
        ]}
      />

      <div className="two-col">
        <Panel title="Workflow Efficiency: Average Time per Stage">
          {["Document Logging", "Administrative Review", "Legal Counsel Approval", "Final Notarization"].map((stage, index) => (
            <div className="bar-row" key={stage}>
              <span>
                Stage {index + 1}: {stage}
              </span>
              <b>{[0.4, 1.8, 3.2, 0.8][index]} Days</b>
              <i style={{ width: `${[16, 55, 82, 28][index]}%` }} />
            </div>
          ))}
        </Panel>

        <Panel title="Agreement Volume Trends">
          <div className="bars">
            {[46, 58, 66, 82, 62, 50].map((height, index) => (
              <span style={{ height: `${height}%` }} key={index} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Departmental Breakdown">
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
        />
        {loading && <p>Loading report data...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && breakdownRows.length === 0 && (
          <p>No report data is available.</p>
        )}
        {!loading && !error && breakdownRows.length > 0 && (
          <DataTable
            headers={[
              "Department / Office",
              "Total Requests",
              "Approved",
              "Returned",
              "Avg. Turnaround",
              "Success Rate",
            ]}
            rows={breakdownRows}
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>
    </section>
  );
}
