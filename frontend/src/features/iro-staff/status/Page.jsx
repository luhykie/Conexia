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
import { getIroStatusDocuments } from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function IroStaffStatusPage() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState(null);
  const [statistics, setStatistics] = React.useState(null);
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

  async function loadStatusTracker() {
    setLoading(true);
    setError("");

    try {
      const response = await getIroStatusDocuments({
        page,
        ...queryParams,
      });
      const loadedDocuments = response.documents ?? response.data ?? [];

      setDocuments(loadedDocuments);
      setMeta(response.meta ?? null);
      setStatistics(response.statistics ?? null);
      setSelectedDocumentId((currentId) => {
        if (!currentId) return null;

        return loadedDocuments.some((document) => document.id === currentId)
          ? currentId
          : null;
      });
    } catch (requestError) {
      reportClientError("Unable to load status tracker:", requestError);
      setError(requestError.message);
      setDocuments([]);
      setSelectedDocumentId(null);
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadStatusTracker();
  }, [page, queryParams]);

  const activeCount = statistics?.active ?? 0;
  const needsFollowUpCount = statistics?.pending ?? 0;
  const agingCount = statistics?.status_older_than_three_days ?? 0;
  const selectedDocument = documents.find(
    (document) => document.id === selectedDocumentId,
  ) ?? null;

  const rows = documents.map((document) => [
    document.tracking_number,
    departmentName(document),
    statusBadge(document),
    formatDate(document.submitted_at),
    formatDate(document.updated_at),
    ageLabel(document.updated_at || document.submitted_at),
    <button
      key={`view-${document.id}`}
      type="button"
      className="table-action"
      aria-pressed={selectedDocumentId === document.id}
      onClick={() => setSelectedDocumentId(document.id)}
    >
      View Reminder
    </button>,
  ]);

  return (
    <section
      className={`page iro-staff-page iro-staff-status-page${
        selectedDocument ? " split-page" : ""
      }`}
    >
      <div>
        <PageTitle
          title="Status Tracker"
          subtitle="Monitor workflow status for reminders and follow-up."
        />

        <StatGrid
          stats={[
            {
              value: String(activeCount).padStart(2, "0"),
              label: "Active Items",
              icon: Folder,
            },
            {
              value: String(needsFollowUpCount).padStart(2, "0"),
              label: "Needs Follow-up",
              icon: Bell,
              tone: "warn",
            },
            {
              value: String(agingCount).padStart(2, "0"),
              label: "Aging Items",
              icon: Clock3,
            },
          ]}
        />

        <Panel title="Submission Status Tracker">
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
          {loading && <p>Loading submission statuses...</p>}
          {error && <p className="auth-error">{error}</p>}

          {!loading && !error && documents.length === 0 && (
            <p>No submissions are available.</p>
          )}

          {!loading && documents.length > 0 && (
            <DataTable
              headers={[
                "Tracking #",
                "Submitting Office",
                "Current Status",
                "Date Submitted",
                "Last Updated",
                "Age",
                "Action",
              ]}
              rows={rows}
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </Panel>
      </div>

      {selectedDocument && (
        <aside className="detail-drawer">
          <button
            type="button"
            aria-label="Close Reminder Details"
            title="Close Reminder Details"
            onClick={() => setSelectedDocumentId(null)}
          >
            ×
          </button>
          <h2>Reminder Details</h2>

          <>
            {statusBadge(selectedDocument)}

            <p>
              <b>Tracking Number:</b> {selectedDocument.tracking_number}
            </p>
            <p>
              <b>Submitting Office:</b> {departmentName(selectedDocument)}
            </p>
            <p>
              <b>Date Submitted:</b>{" "}
              {formatDateTime(selectedDocument.submitted_at)}
            </p>
            <p>
              <b>Last Updated:</b>{" "}
              {formatDateTime(selectedDocument.updated_at)}
            </p>
            <p>
              <b>Time in Current Status:</b>{" "}
              {ageLabel(selectedDocument.updated_at || selectedDocument.submitted_at)}
            </p>

            <div className="notice">
              <b>IRO Staff Access</b>
              <p>
                This page is limited to reminder monitoring. Document contents
                and workflow decisions are handled by IRO Admin.
              </p>
            </div>
          </>
        </aside>
      )}
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

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function ageLabel(value) {
  if (!value) return "-";

  const totalHours = Math.floor(
    Math.max(Date.now() - new Date(value).getTime(), 0) /
      (1000 * 60 * 60),
  );
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

function statusBadge(document) {
  return (
    <span
      key={`status-${document.id}`}
      className={`badge ${
        document.status === "Corrections Needed"
          ? "danger"
          : document.status === "Submitted"
            ? "pending"
            : "active"
      }`}
    >
      {document.status}
    </span>
  );
}
