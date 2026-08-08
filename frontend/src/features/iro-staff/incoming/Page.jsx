import React from "react";
import {
  Bell,
  Clock3,
  Folder,
} from "lucide-react";

import { DataTable } from "../../../components/DataTable";
import {
  DocumentFilters,
  useDocumentFilters,
} from "../../../components/DocumentFilters";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { StatGrid } from "../../../components/StatGrid";
import { getIncomingDocuments } from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroStaffIncomingPage() {
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

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      const response = await getIncomingDocuments({
        page,
        ...queryParams,
      });

      setDocuments(response.documents ?? response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (requestError) {
      reportClientError("Unable to load reminder queue:", requestError);
      setError(requestError.message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDocuments();
  }, [page, queryParams]);

  const submittedCount = documents.filter(
    (document) => document.status === "Submitted",
  ).length;
  const pendingCount = documents.filter((document) =>
    [
      "Submitted",
      "Logged",
      "Under Legal Review",
      "Corrections Needed",
    ].includes(document.status),
  ).length;
  const overdueCount = documents.filter((document) =>
    isOlderThan(document.submitted_at, 3),
  ).length;

  const rows = documents.map((document) => [
    document.tracking_number,
    departmentName(document),
    formatDate(document.submitted_at),
    ageLabel(document.submitted_at),
    statusBadge(document),
    <span key={`reminder-${document.id}`} className="badge active">
      Reminder only
    </span>,
  ]);

  return (
    <section className="page iro-staff-page iro-staff-incoming-page">
      <PageTitle
        title="Incoming Queue"
        subtitle="Monitor submissions for reminders and IRO Admin follow-up."
      />

      <StatGrid
        stats={[
          {
            value: String(submittedCount).padStart(2, "0"),
            label: "New Submissions",
            icon: Folder,
            badge: "Monitor",
          },
          {
            value: String(pendingCount).padStart(2, "0"),
            label: "Pending Follow-up",
            icon: Bell,
            badge: "Reminder",
            tone: "warn",
          },
          {
            value: String(overdueCount).padStart(2, "0"),
            label: "Older Than 3 Days",
            icon: Clock3,
            badge: "Aging",
          },
        ]}
      />

      <Panel title="Reminder Queue">
        <DocumentFilters
          filters={filters}
          onChange={changeFilter}
          onClear={() => {
            clearFilters();
            setPage(1);
          }}
          searchPlaceholder="Search by tracking number or submitting office..."
          statusOptions={[
            "Submitted",
            "Logged",
            "Under Legal Review",
            "Corrections Needed",
            "Approved",
            "Pending Notarization",
            "Notarized",
          ]}
          showAgreementType={false}
          showDepartment={false}
          unsupported={{
            partnership_scope: true,
            date_from: true,
            date_to: true,
          }}
        />
        {loading && <p>Loading reminder queue...</p>}
        {error && <p className="auth-error">{error}</p>}

        {!loading && !error && documents.length === 0 && (
          <p>No reminder items are available.</p>
        )}

        {!loading && documents.length > 0 && (
          <DataTable
            headers={[
              "Tracking #",
              "Submitting Office",
              "Date Submitted",
              "Age",
              "Current Status",
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

function departmentName(document) {
  return document.department?.code || document.department?.name || "-";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function ageLabel(value) {
  if (!value) return "-";

  const days = Math.floor(
    Math.max(Date.now() - new Date(value).getTime(), 0) /
      (1000 * 60 * 60 * 24),
  );

  return days === 1 ? "1 day" : `${days} days`;
}

function isOlderThan(value, days) {
  if (!value) return false;

  return Date.now() - new Date(value).getTime() >
    days * 24 * 60 * 60 * 1000;
}

function statusBadge(document) {
  return (
    <span
      key={`status-${document.id}`}
      className={`badge ${
        document.status === "Submitted"
          ? "pending"
          : document.status === "Corrections Needed"
            ? "danger"
            : "active"
      }`}
    >
      {document.status}
    </span>
  );
}
