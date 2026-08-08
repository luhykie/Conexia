import React, { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { DashboardHeader } from "../components/DashboardHeader";
import { DashboardStats } from "../components/DashboardStats";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { NotificationsView } from "../components/SharedViews";
import { Panel } from "../components/Panel";
import { QueuePreview } from "../components/QueuePreview";
import { WorkflowActivity } from "../components/WorkflowActivity";
import IncomingSubmissions from "../components/IncomingSubmissions";
import LogReviewPage from "../components/LogReviewPage";
import DistributionTasks from "../components/DistributionTasks";

import {
  getIroStaffDocuments,
  getIroStaffExpiryDocuments,
  getIncomingDocuments,
  getIroStaffDashboard,
} from "../services/documentService";
// Routes all IRO Staff pages through one role-owned component.
export function IroStaff({ page, account }) {
  if (page === "distribution-tasks") {
    return <DistributionTasks />;
  }
  if (page === "incoming") {
    return <IncomingSubmissions roleKey="staff" />;
  }

  if (page === "log-review") {
    return <LogReview account={account} />;
  }

  if (page === "status") {
    return <StatusTracker />;
  }

  if (page === "expiry") {
    return <IroStaffExpiry />;
  }

  if (page === "notifications") {
    return <NotificationsView roleKey="staff" />;
  }

  return <IroStaffDashboard account={account} />;
}

function IroStaffDashboard({ account }) {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState({
    stats: {},
    queue: [],
    assignedQueue: [],
    activities: [],
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const dashboardRequestRef = useRef(null);
  const lastDashboardLoadRef = useRef(0);

  useEffect(() => {
    loadDashboardDocuments();
    const refresh = () => {
      if (Date.now() - lastDashboardLoadRef.current >= 10000) {
        loadDashboardDocuments();
      }
    };
    const handleStorage = (event) => {
      if (event.key === "conexia-workflow-changed-at") refresh();
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("conexia:workflow-changed", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("conexia:workflow-changed", refresh);
    };
  }, []);

  async function loadDashboardDocuments() {
    if (dashboardRequestRef.current) return dashboardRequestRef.current;

    setLoading(true);
    setErrorMessage("");

    const request = (async () => {
      try {
      const data = await getIroStaffDashboard();
      setDashboard({
        stats: data?.stats ?? {},
        queue: Array.isArray(data?.queue) ? data.queue : [],
        assignedQueue: Array.isArray(data?.assignedQueue)
          ? data.assignedQueue
          : [],
        activities: Array.isArray(data?.activities)
          ? data.activities
          : [],
      });
      lastDashboardLoadRef.current = Date.now();
      } catch (error) {
      console.error(
        "Failed to load IRO Staff dashboard documents:",
        error
      );

      setErrorMessage("Unable to load dashboard records.");
      } finally {
        setLoading(false);
        dashboardRequestRef.current = null;
      }
    })();
    dashboardRequestRef.current = request;
    return request;
  }

  function handleCardClick(label) {
    switch (label) {
      case "Unlogged":
        navigate("/app/incoming");
        break;

      case "Logged Today":
        navigate("/app/log-review");
        break;

      case "Awaiting Check":
        navigate("/app/log-review", {
          state: {
            filterStatus: "awaiting",
          },
        });
        break;

      case "Routed to Legal":
        navigate("/app/status", {
          state: {
            filterStatus: "routed",
          },
        });
        break;

      default:
        break;
    }
  }

  if (loading) {
    return (
      <section className="page iro-staff-dashboard">
        <p>Loading dashboard...</p>
      </section>
    );
  }

  return (
    <section className="page iro-staff-dashboard">
      <DashboardHeader
        account={account}
        incomingCount={dashboard.stats.incoming ?? 0}
      />

      {errorMessage && (
        <div className="notice">
          {errorMessage}
        </div>
      )}

      <DashboardStats
        stats={dashboard.stats}
        onCardClick={handleCardClick}
      />

      <div className="iro-dashboard-grid">
        <div className="iro-dashboard-primary">
          {dashboard.queue.length > 0 && (
            <QueuePreview
              documents={dashboard.queue}
              onViewAll={() => navigate("/app/incoming")}
            />
          )}

          <Panel
            title="My Assigned Submissions"
            tools={<span className="assigned-count">{dashboard.assignedQueue.length} active</span>}
          >
            {dashboard.assignedQueue.length === 0 ? (
              <p className="notification-state">No active submissions are assigned to you.</p>
            ) : (
              <div className="submission-table-wrap">
                <table className="submission-table iro-assigned-table">
                  <thead>
                    <tr>
                      <th>Tracking #</th>
                      <th>Partner</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.assignedQueue.map((document) => {
                      const canContinue = [
                        "Logged",
                        "Review Form Sent Back",
                      ].includes(document.status);

                      return (
                        <tr key={document.id}>
                          <td><strong>{document.tracking_number}</strong></td>
                          <td>{document.partner_institution}</td>
                          <td>{document.document_type}</td>
                          <td><span className="badge">{document.status}</span></td>
                          <td>
                            <button
                              className="outline"
                              type="button"
                              onClick={() => navigate(
                                document.status === "Assigned for Distribution"
                                  ? "/app/distribution-tasks"
                                  : canContinue
                                    ? `/app/log-review?document=${document.id}`
                                    : "/app/status",
                                canContinue ? undefined : {
                                  state: { documentId: document.id },
                                }
                              )}
                            >
                              {document.status === "Assigned for Distribution"
                                ? "Distribute"
                                : canContinue ? "Continue Work" : "View Status"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
        <WorkflowActivity activities={dashboard.activities} />
      </div>
    </section>
  );
}

// Opens the IRO Staff Log & Review page.
function LogReview({ account }) {
  return <LogReviewPage account={account} />;
}

function IroStaffExpiry() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadExpiryDocuments();
  }, []);

  async function loadExpiryDocuments() {
    setLoading(true);
    setError("");
    try {
      const items = await getIroStaffExpiryDocuments();
      setDocuments(
        (items || [])
          .filter((item) => item.expiry_date)
          .sort(
            (first, second) =>
              new Date(first.expiry_date) - new Date(second.expiry_date)
          )
      );
    } catch (loadError) {
      setError(loadError.message || "Unable to load expiry records.");
    } finally {
      setLoading(false);
    }
  }

  const rows = documents.map((document) => [
    document.tracking_number,
    document.partner_institution,
    document.document_type,
    formatExpiryDate(document.expiry_date),
    expiryState(document.expiry_date),
  ]);

  return (
    <section className="page iro-staff-page">
      <PageTitle
        title="Agreement Expiry Tracking"
        subtitle="Documents with persisted expiry dates."
        action={loading ? "Refreshing..." : "Refresh"}
        onAction={loadExpiryDocuments}
        actionDisabled={loading}
      />

      {error ? (
        <div className="notice">
          <p>{error}</p>
          <button className="btn outline" type="button" onClick={loadExpiryDocuments}>Try Again</button>
        </div>
      ) : (
        <Panel title="Expiry Records">
          {loading ? (
            <p className="notification-state">Loading expiry records...</p>
          ) : rows.length ? (
            <DataTable
              headers={["Tracking #", "Partner", "Type", "Expiry Date", "State"]}
              rows={rows}
            />
          ) : (
            <p className="notification-state">No documents have an expiry date.</p>
          )}
        </Panel>
      )}
    </section>
  );
}

function formatExpiryDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString();
}

function expiryState(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return "Expires today";
  return `${days} days remaining`;
}

/*
    getIroStaffDocuments()
      .then((items) =>
        setDocuments(
          (items || [])
            .filter((item) => item.expiry_date)
            .sort(
              (first, second) =>
                new Date(first.expiry_date) - new Date(second.expiry_date)
            )
        )
      )
      .catch((loadError) =>
        setError(loadError.message || "Unable to load expiry records.")
      )
      .finally(() => setLoading(false));
  }, []);

  const records = documents.map((document) => ({
    ...document,
    daysRemaining: daysUntil(document.expiry_date),
  }));
  const visibleRecords = records.filter((document) => {
    if (filter === "expired") return document.daysRemaining < 0;
    if (filter === "urgent") {
      return document.daysRemaining >= 0 && document.daysRemaining <= 30;
    }
    if (filter === "upcoming") {
      return document.daysRemaining > 30 && document.daysRemaining <= 90;
    }
    return true;
  });
  const expiringSoon = records.filter(
    (document) =>
      document.daysRemaining >= 0 && document.daysRemaining <= 90
  ).length;
  const urgent = records.filter(
    (document) =>
      document.daysRemaining >= 0 && document.daysRemaining <= 30
  ).length;
  const expired = records.filter(
    (document) => document.daysRemaining < 0
  ).length;

  function exportExpiryList() {
    const escapeCsv = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Tracking Number", "Title", "Partner", "Type", "Expiry Date", "Days Remaining", "Status"],
      ...visibleRecords.map((document) => [
        document.tracking_number,
        document.title,
        document.partner_institution,
        document.document_type,
        document.expiry_date,
        document.daysRemaining,
        expiryLabel(document.daysRemaining),
      ]),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "iro-staff-expiry-list.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="page iro-staff-page">
      <PageTitle
        title="Global Expiry List"
        subtitle="Authorized agreements with persisted expiry dates."
        action="Export Expiry List"
        onAction={exportExpiryList}
        actionDisabled={visibleRecords.length === 0}
      />
      {error && <div className="notice">{error}</div>}
      <StatGrid
        stats={[
          [String(records.length), "Tracked Agreements", Filter],
          [String(expiringSoon), "Expiring Within 90 Days", Filter],
          [String(urgent), "Urgent: Next 30 Days", Filter, "", "danger"],
          [String(expired), "Expired", Filter, "", "danger"],
        ]}
      />
      <Panel
        title="Agreement Expiry Records"
        tools={
          <label className="expiry-filter">
            <Filter size={18} />
            <span className="sr-only">Filter expiry records</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All records</option>
              <option value="expired">Expired</option>
              <option value="urgent">Next 30 days</option>
              <option value="upcoming">31–90 days</option>
            </select>
          </label>
        }
      >
        {loading ? (
          <p className="notification-state">Loading expiry records...</p>
        ) : visibleRecords.length === 0 ? (
          <p className="notification-state">
            No authorized agreements match this expiry filter.
          </p>
        ) : (
          <div className="submission-table-wrap">
            <table className="submission-table">
              <thead>
                <tr>
                  <th>Document / ID</th>
                  <th>Partner</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <b>{document.title}</b>
                      <small>{document.tracking_number}</small>
                    </td>
                    <td>{document.partner_institution}</td>
                    <td>
                      {new Date(document.expiry_date).toLocaleDateString()}
                      <small>{expiryDaysLabel(document.daysRemaining)}</small>
                    </td>
                    <td>
                      <span className={`badge ${expiryTone(document.daysRemaining)}`}>
                        {expiryLabel(document.daysRemaining)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="outline"
                        type="button"
                        onClick={() =>
                          navigate(`/app/status?document=${document.id}`)
                        }
                      >
                        View Document
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </section>
  );
}

function daysUntil(value) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(value);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / 86400000);
}

function expiryLabel(days) {
  if (days < 0) return "Expired";
  if (days <= 30) return "Urgent";
  if (days <= 90) return "Expiring Soon";
  return "Active";
}

function expiryTone(days) {
  if (days < 0) return "danger";
  if (days <= 30) return "urgent";
  if (days <= 90) return "expiring";
  return "active";
}

function expiryDaysLabel(days) {
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}
*/

// Displays document workflow progress using Supabase records.
function StatusTracker() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const linkedDocumentId = searchParams.get("document");

  const filterStatus =
    location.state?.filterStatus || null;

  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    linkedDocumentId || ""
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadStatusDocuments();
  }, []);

  useEffect(() => {
    if (!loading && linkedDocumentId) {
      document
        .getElementById(`status-${linkedDocumentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, linkedDocumentId]);

  async function loadStatusDocuments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getIroStaffDocuments();
      setDocuments(data ?? []);
      setSelectedDocumentId((current) =>
        current && data?.some((document) => document.id === current)
          ? current
          : ""
      );
    } catch (error) {
      console.error(
        "Failed to load status documents:",
        error
      );

      setErrorMessage("Unable to load document statuses.");
    } finally {
      setLoading(false);
    }
  }

  const visibleDocuments = filterStatus
    ? documents.filter((document) => {
        if (filterStatus === "routed") {
          return (
            document.status === "Under Legal Review"
          );
        }

        return true;
      })
    : documents;

  const selectedDocument =
    visibleDocuments.find(
      (document) => document.id === selectedDocumentId
    ) || null;
  const auditEvents = [...(selectedDocument?.workflow_events || [])]
    .sort(
      (first, second) =>
        new Date(second.created_at) - new Date(first.created_at)
    );

  function exportAuditLog() {
    if (!selectedDocument || auditEvents.length === 0) return;
    const escapeCsv = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Tracking Number", "Event", "From Status", "To Status", "Actor Role", "Notes", "Timestamp"],
      ...auditEvents.map((event) => [
        selectedDocument.tracking_number,
        event.event_type,
        event.from_status,
        event.to_status,
        event.actor_role,
        event.notes,
        event.created_at,
      ]),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedDocument.tracking_number}-audit-log.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function getProgressClass(status, stage) {
    const statusRank = {
      Submitted: 0,
      Logged: 1,
      "Review Form Submitted": 1,
      "Review Form Sent Back": 1,
      "Admin Validated": 1,
      "Under Legal Review": 2,
      "Corrections Needed": 2,
      Approved: 3,
      "Pending Notarization": 4,
      Notarized: 5,
      "Ready for Distribution": 6,
      "Distribution Complete": 7,
      Archived: 8,
    };
    return (statusRank[status] ?? -1) >= (statusRank[stage] ?? 0)
      ? "done"
      : "";
  }

  if (loading) {
    return (
      <section className="page iro-staff-page">
        <p>Loading status tracker...</p>
      </section>
    );
  }

  return (
    <section className={`page split-page iro-staff-page status-tracker-page ${selectedDocument ? "audit-open" : ""}`}>
      <div>
        <PageTitle
          title="Submission Progression"
          subtitle="Real-time status of active institutional agreements."
        />

        {errorMessage && (
          <div className="notice">
            {errorMessage}
          </div>
        )}

        {!errorMessage &&
          visibleDocuments.length === 0 && (
            <div className="panel">
              <p>No documents found.</p>
            </div>
          )}

        {visibleDocuments.map((document) => (
          <article
            id={`status-${document.id}`}
            className={`status-card ${
              document.id === linkedDocumentId
                ? "notification-target"
                : ""
            }`}
            key={document.id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedDocument?.id === document.id}
            onClick={() => setSelectedDocumentId((current) =>
              current === document.id ? "" : document.id
            )}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedDocumentId((current) =>
                  current === document.id ? "" : document.id
                );
              }
            }}
          >
            <span className="badge active">
              ID: {document.tracking_number}
            </span>

            <h2>
              {document.partner_institution ||
                document.title}
            </h2>

            <div className="progress-steps">
              <span
                className={getProgressClass(
                  document.status,
                  "Submitted"
                )}
              >
                Submitted
              </span>

              <span
                className={getProgressClass(
                  document.status,
                  "Logged"
                )}
              >
                Logged
              </span>

              <span
                className={getProgressClass(
                  document.status,
                  "Under Legal Review"
                )}
              >
                Under Review
              </span>
            </div>

            <footer>
              <span>
                {document.document_type || "N/A"}
              </span>

              <span>
                {document.departments?.name ||
                  "Department not available"}
              </span>

              <b>{document.status}</b>
            </footer>
          </article>
        ))}
      </div>

      {selectedDocument && <aside className="detail-drawer audit-trail-panel">
        <header>
          <h2>Audit Trail</h2>
          {selectedDocument && <small>{selectedDocument.tracking_number}</small>}
        </header>

        <div className="audit-trail-list">
        {!selectedDocument ? (
          <p className="notification-state">
            Select a document to view its audit trail.
          </p>
        ) : auditEvents.length === 0 ? (
          <p className="notification-state">
            No workflow events have been recorded for this document.
          </p>
        ) : auditEvents.map((event) => (
          <div
            className="timeline-item"
            key={event.id || `${event.event_type}-${event.created_at}`}
          >
            <b>{formatEventName(event.event_type)}</b>

            <p>
              {event.from_status
                ? `${event.from_status} → ${event.to_status}`
                : event.to_status}
              {event.notes ? ` — ${event.notes}` : ""}
            </p>

            <small>
              {event.actor_role?.replaceAll("_", " ") || "System"} ·{" "}
              {event.created_at
                ? new Date(event.created_at).toLocaleString()
                : "Time unavailable"}
            </small>
          </div>
        ))}
        </div>

        <footer>
          <button
            className="primary"
            type="button"
            disabled={!selectedDocument || auditEvents.length === 0}
            onClick={exportAuditLog}
          >
            <Download size={17} />
            Generate Export Log
          </button>
        </footer>
      </aside>}
    </section>
  );
}

function formatEventName(eventType) {
  return String(eventType || "workflow event")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
