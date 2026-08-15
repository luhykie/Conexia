import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const [success, setSuccess] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
  const [statistics, setStatistics] = React.useState(null);
  const {
    filters,
    queryParams,
    updateFilter,
    clearFilters,
  } = useDocumentFilters();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const message = location.state?.success;
    if (!message) return;

    setSuccess(message);
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.search, location.state?.success, navigate]);

  React.useEffect(() => {
    if (!success) return undefined;

    const timeout = window.setTimeout(() => setSuccess(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [success]);

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
      setStatistics(response.statistics ?? null);
    } catch (requestError) {
      reportClientError("Unable to load reminder queue:", requestError);
      setError(requestError.message);
      setDocuments([]);
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDocuments();
  }, [page, queryParams]);

  const submittedCount = statistics?.submitted ?? 0;
  const pendingCount = statistics?.pending ?? 0;
  const overdueCount = statistics?.older_than_three_days ?? 0;

  const rows = documents.map((document) => [
    document.tracking_number,
    departmentName(document),
    formatDate(document.submitted_at),
    ageLabel(document.submitted_at),
    statusBadge(document),
    <div key={`action-${document.id}`} className="table-action-group">
      <button
        type="button"
        className="table-action"
        onClick={() => navigate(`/app/incoming/${document.id}`)}
      >
        View Details
      </button>
    </div>,
  ]);

  return (
    <section className="page iro-staff-page iro-staff-incoming-page">
      <PageTitle
        title="Incoming Queue"
        subtitle="Monitor submissions for reminders and IRO Admin follow-up."
      />

      {success && <div className="notice success"><b>{success}</b></div>}

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
  const department = document.department;
  if (!department) return "PAIR/IRO";
  return department.code && department.name
    ? `${department.code} - ${department.name}`
    : department.code || department.name || "PAIR/IRO";
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
