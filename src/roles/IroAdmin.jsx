import React from "react";
import { FileText } from "lucide-react";

import { DataTable } from "../components/DataTable";
import IncomingSubmissions from "../components/IncomingSubmissions";
import ManageSubmissions from "../components/ManageSubmissions";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import {
  DashboardView,
  ExpiryView,
  FilterBar,
  NotificationsView,
} from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";

import {
  archiveStats,
  reportStats,
} from "../data/mockData";

// Routes all IRO Admin pages through one role-owned component.
export function IroAdmin({ page, account }) {
  if (page === "incoming") {
    return <IncomingSubmissions />;
  }

  if (page === "manage-submissions") {
    return <ManageSubmissions account={account} />;
  }

  if (page === "reassign") {
    return <ReassignSubmissions />;
  }

  if (page === "distribution-lists") {
    return <DistributionLists />;
  }

  if (page === "reports") {
    return <PerformanceReports />;
  }

  if (page === "archive") {
    return <ArchivePage />;
  }

  if (page === "expiry") {
    return (
      <ExpiryView
        title="Agreement Expiry Tracking"
        action="Apply Filters"
      />
    );
  }

  if (page === "notifications") {
    return <NotificationsView />;
  }

  return (
    <DashboardView
      roleKey="admin"
      title="Office Overview"
      subtitle="Real-time status of institutional document submissions and office throughput."
    />
  );
}

// Transfers active submissions between IRO Staff members.
function ReassignSubmissions() {
  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Reassign Submissions"
        subtitle="Transfer active submissions between IRO Staff members to balance office workload."
      />

      <div className="two-col">
        <Panel title="Assigned Submissions">
          <DataTable
            headers={[
              "Tracking #",
              "Partner",
              "Current Assignee",
              "Status",
            ]}
            rows={[
              [
                "CONEXIA-2026-001",
                "Global Logistics Corp.",
                "Jane Doe",
                "Logged",
              ],
              [
                "CONEXIA-2026-002",
                "Apex Tech Solutions",
                "Marcus Smith",
                "Under Admin Review",
              ],
              [
                "CONEXIA-2026-003",
                "City Health Group",
                "Jane Doe",
                "Logged",
              ],
            ]}
          />
        </Panel>

        <aside className="form-card">
          <h2>Assignment Details</h2>

          <div className="selected-record">
            CONEXIA-2026-002
            <br />
            <small>Apex Tech Solutions</small>
          </div>

          <label>
            Reassign To
            <select defaultValue="">
              <option value="" disabled>
                Select IRO Staff member...
              </option>
              <option value="staff-1">Jane Doe</option>
              <option value="staff-2">Marcus Smith</option>
            </select>
          </label>

          <label>
            Reason for Reassignment
            <textarea placeholder="Briefly explain the administrative reason..." />
          </label>

          <button type="button">
            Confirm Reassignment
          </button>

          <button
            className="outline"
            type="button"
          >
            Cancel Request
          </button>
        </aside>
      </div>
    </section>
  );
}

// Manages recipients assigned to each document type.
function DistributionLists() {
  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Distribution Lists"
        subtitle="Manage recipient lists assigned to every institutional document type."
        action="Add Recipient"
      />

      <FilterBar
        labels={[
          "All Document Types",
          "All Offices",
        ]}
      />

      <Panel title="Distribution Recipients">
        <DataTable
          headers={[
            "Document Type",
            "Recipient",
            "Office",
            "Email",
            "Action",
          ]}
          rows={[
            [
              "MOA",
              "Legal Counsel",
              "Legal Affairs",
              "legal@conexia.edu",
              "Remove",
            ],
            [
              "MOU",
              "IRO Administration",
              "International Relations",
              "iroadmin@conexia.edu",
              "Remove",
            ],
            [
              "MOF",
              "Finance Representative",
              "Finance Office",
              "finance@conexia.edu",
              "Remove",
            ],
          ]}
        />
      </Panel>
    </section>
  );
}

// Summarizes institutional throughput and workflow bottlenecks.
function PerformanceReports() {
  const stages = [
    {
      label: "Document Logging",
      days: 0.4,
      percentage: 16,
    },
    {
      label: "Administrative Review",
      days: 1.8,
      percentage: 55,
    },
    {
      label: "Legal Counsel Approval",
      days: 3.2,
      percentage: 82,
    },
    {
      label: "Final Notarization",
      days: 0.8,
      percentage: 28,
    },
  ];

  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Institutional Performance Reports"
        subtitle="Review office performance, workflow turnaround, and document outcomes."
        action="Export Report"
      />

      <StatGrid stats={reportStats} />

      <FilterBar
        labels={[
          "All Date Ranges",
          "All Departments",
          "All Staff",
        ]}
      />

      <div className="two-col">
        <Panel title="Workflow Efficiency: Average Time per Stage">
          {stages.map((stage, index) => (
            <div
              className="bar-row"
              key={stage.label}
            >
              <span>
                Stage {index + 1}: {stage.label}
              </span>

              <b>{stage.days} Days</b>

              <i
                style={{
                  width: `${stage.percentage}%`,
                }}
              />
            </div>
          ))}
        </Panel>

        <Panel title="Agreement Volume Trends">
          <div className="bars">
            {[46, 58, 66, 82, 62, 50].map(
              (height, index) => (
                <span
                  key={`${height}-${index}`}
                  style={{ height: `${height}%` }}
                />
              )
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Departmental Breakdown">
        <DataTable
          headers={[
            "Department / Office",
            "Total Requests",
            "Approved",
            "Returned",
            "Avg. Turnaround",
            "Success Rate",
          ]}
          rows={[
            [
              "College of Law",
              "412",
              "390",
              "22",
              "4.2 Days",
              "94.6%",
            ],
            [
              "Engineering & Technology",
              "285",
              "240",
              "45",
              "6.8 Days",
              "84.2%",
            ],
            [
              "Medicine & Health",
              "354",
              "342",
              "12",
              "3.1 Days",
              "96.6%",
            ],
          ]}
        />
      </Panel>
    </section>
  );
}

// Finalizes distributed records into the secure archive.
function ArchivePage() {
  return (
    <section className="page iro-admin-page">
      <PageTitle
        title="Records Archive"
        subtitle="Secure workspace for finalizing document distribution and archival."
        action="Export Registry"
      />

      <StatGrid stats={archiveStats} />

      <Panel title="Archive Records">
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
          rows={[
            [
              "#2024-AG-9102",
              "Global Tech Solutions Inc.",
              "MOA",
              "Oct 12, 2024",
              "100%",
              "Distributed",
              "Mark as Archived",
            ],
            [
              "#2024-AG-8841",
              "Sovereign Logistics Ltd.",
              "MOU",
              "Sep 28, 2024",
              "100%",
              "Archived",
              "View Vault",
            ],
            [
              "#2024-AG-7922",
              "Emerald Heritage Foundation",
              "MOF",
              "Oct 05, 2024",
              "65%",
              "In Distribution",
              "Locked",
            ],
          ]}
        />
      </Panel>
    </section>
  );
}

export default IroAdmin;