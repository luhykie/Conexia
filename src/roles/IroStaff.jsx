import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { DashboardHeader } from "../components/DashboardHeader";
import { DashboardStats } from "../components/DashboardStats";
import { PageTitle } from "../components/PageTitle";
import {
  ExpiryView,
  NotificationsView,
} from "../components/SharedViews";
import { QueuePreview } from "../components/QueuePreview";
import { WorkflowActivity } from "../components/WorkflowActivity";
import IncomingSubmissions from "../components/IncomingSubmissions";
import LogReviewPage from "../components/LogReviewPage";

import {
  getDocuments,
  getIncomingDocuments,
  getIroStaffDashboard,
} from "../services/documentService";
// Routes all IRO Staff pages through one role-owned component.
export function IroStaff({ page, account }) {
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
    return (
      <ExpiryView
        title="Global Expiry List"
        action="Bulk Notify Offices"
      />
    );
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
    activities: [],
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadDashboardDocuments();
  }, []);

  async function loadDashboardDocuments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getIroStaffDashboard();
      setDashboard({
        stats: data?.stats ?? {},
        queue: Array.isArray(data?.queue) ? data.queue : [],
        activities: Array.isArray(data?.activities)
          ? data.activities
          : [],
      });
    } catch (error) {
      console.error(
        "Failed to load IRO Staff dashboard documents:",
        error
      );

      setErrorMessage("Unable to load dashboard records.");
    } finally {
      setLoading(false);
    }
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
        <QueuePreview
          documents={dashboard.queue}
          onViewAll={() => navigate("/app/incoming")}
        />
        <WorkflowActivity activities={dashboard.activities} />
      </div>
    </section>
  );
}

// Opens the IRO Staff Log & Review page.
function LogReview({ account }) {
  return <LogReviewPage account={account} />;
}

// Displays document workflow progress using Supabase records.
function StatusTracker() {
  const location = useLocation();

  const filterStatus =
    location.state?.filterStatus || null;

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadStatusDocuments();
  }, []);

  async function loadStatusDocuments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getIncomingDocuments();
      setDocuments(data ?? []);
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

  function getProgressClass(status, stage) {
    const stages = [
      "Submitted",
      "Logged",
      "Under Legal Review",
      "Corrections Needed",
      "Approved",
      "Pending Notarization",
      "Notarized",
      "Archived",
    ];

    const currentIndex = stages.indexOf(status);
    const stageIndex = stages.indexOf(stage);

    return currentIndex >= stageIndex ? "done" : "";
  }

  if (loading) {
    return (
      <section className="page iro-staff-page">
        <p>Loading status tracker...</p>
      </section>
    );
  }

  return (
    <section className="page split-page iro-staff-page">
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
            className="status-card"
            key={document.id}
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

      <aside className="detail-drawer">
        <h2>Audit Trail</h2>

        {[
          "Status Changed to Under Review",
          "Logged & Verified",
          "Initial Submission",
        ].map((entry) => (
          <div
            className="timeline-item"
            key={entry}
          >
            <b>{entry}</b>

            <p>
              Submission lifecycle event recorded for
              export and audit.
            </p>

            <small>Recent activity</small>
          </div>
        ))}

        <button className="primary wide-inline">
          <Download size={18} />
          Generate Export Log
        </button>
      </aside>
    </section>
  );
}
