import React from "react";
import {
  CalendarClock,
  CheckCircle2,
  Info,
} from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { FilterBar } from "../../../components/SharedViews";
import { StatGrid } from "../../../components/StatGrid";
import { getIncomingDocuments } from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroAdminValidationPage() {
  const [documents, setDocuments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError("");

      try {
        const response = await getIncomingDocuments({ page });

        if (active) {
          setDocuments(response.documents ?? response.data ?? []);
          setMeta(response.meta ?? null);
        }
      } catch (requestError) {
        reportClientError("Unable to load validation queue:", requestError);

        if (active) {
          setError(requestError.message);
          setDocuments([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadQueue();

    return () => {
      active = false;
    };
  }, [page]);

  const urgentCount = documents.filter(
    (document) => document.status === "Submitted",
  ).length;
  const rows = documents.map((document) => [
    document.tracking_number,
    document.submitted_at
      ? new Date(document.submitted_at).toLocaleDateString()
      : "-",
    document.department?.code || document.department?.name || "-",
    document.partner_institution || document.title || "-",
    document.status === "Submitted" ? "High" : "Normal",
    <span
      key={`status-${document.id}`}
      className={`badge ${document.status === "Submitted" ? "pending" : "active"}`}
    >
      {document.status}
    </span>,
    <button type="button" className="table-action" disabled key={document.id}>
      Validate in Incoming Queue
    </button>,
  ]);

  return (
    <section className="page iro-admin-page iro-admin-validation-page">
      <PageTitle
        title="Validation Queue"
        subtitle="Pending document verifications and institutional submission approvals."
        action="Refresh Queue"
      />

      <StatGrid
        stats={[
          {
            value: `${documents.length} Cases`,
            label: "Pending Total",
            icon: CalendarClock,
          },
          {
            value: `${urgentCount} Cases`,
            label: "Urgent",
            icon: Info,
            tone: "danger",
          },
          {
            value: "0 Hours",
            label: "Avg. Wait Time",
            icon: CalendarClock,
            tone: "blue",
          },
          {
            value: "0 Cases",
            label: "Validated Today",
            icon: CheckCircle2,
          },
        ]}
      />

      <FilterBar labels={["All Departments", "All Priorities", "All Statuses"]} />

      <Panel title="Validation Queue">
        {loading && <p>Loading validation queue...</p>}
        {error && <p className="auth-error">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p>No documents are pending validation.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={[
              "ID / Case Ref",
              "Submission Date",
              "Department",
              "Entity Name",
              "Priority",
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
