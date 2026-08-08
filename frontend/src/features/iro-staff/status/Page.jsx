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
  const [selectedDocument, setSelectedDocument] = React.useState(null);
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
      setSelectedDocument((currentDocument) => {
        if (!loadedDocuments.length) return null;

        return (
          loadedDocuments.find(
            (document) => document.id === currentDocument?.id,
          ) || loadedDocuments[0]
        );
      });
    } catch (requestError) {
      reportClientError("Unable to load status tracker:", requestError);
      setError(requestError.message);
      setDocuments([]);
      setSelectedDocument(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadStatusTracker();
  }, [page, queryParams]);

  const activeCount = documents.filter(
    (document) => document.status !== "Archived",
  ).length;
  const needsFollowUpCount = documents.filter((document) =>
    [
      "Submitted",
      "Logged",
      "Under Legal Review",
      "Corrections Needed",
    ].includes(document.status),
  ).length;
  const agingCount = documents.filter((document) =>
    isOlderThan(document.updated_at || document.submitted_at, 3),
  ).length;

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
      onClick={() => setSelectedDocument(document)}
    >
      Reminder View
    </button>,
  ]);

  return (
    <section className="page split-page iro-staff-page iro-staff-status-page">
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
            unsupported={{
              partnership_scope: true,
              date_from: true,
              date_to: true,
            }}
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

      <aside className="detail-drawer">
        <h2>Reminder Details</h2>

        {!selectedDocument ? (
          <p>Select a submission to view reminder-level status.</p>
        ) : (
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
        )}
      </aside>
    </section>
  );
}

function departmentName(document) {
  return document.department?.code || document.department?.name || "-";
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
