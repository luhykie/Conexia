import React from "react";
import { ChevronDown, Download, Filter, UploadCloud } from "lucide-react";
import { DataTable } from "./DataTable";
import { Panel } from "./Panel";
import { PageTitle } from "./PageTitle";
import { StatGrid } from "./StatGrid";
import { dashboardStats, expiryRows, notificationRows, recentActivity } from "../data/mockData";

// Shared dashboard skeleton used by all roles.
export function DashboardView({ roleKey, title, subtitle, action }) {
  return (
    <section className="page">
      <PageTitle title={title} subtitle={subtitle} action={action} />
      <StatGrid stats={dashboardStats[roleKey]} />
      <div className="dashboard-grid">
        <Panel title="Recent Activity">
          <DataTable headers={["Submission ID", "Entity Name", "Type", "Timestamp", "Status"]} rows={recentActivity} />
        </Panel>
        <NotificationCenter />
      </div>
    </section>
  );
}

// Shared notification cards for dashboards.
export function NotificationCenter() {
  const items = [
    ["Validation Required", "Batch #402-A requires urgent validation before the daily cycle cutoff.", "new"],
    ["Task Reassigned", "Submission #IRO-84192 reassigned to Office B.", "info"],
    ["Expiry Alert", "12 files are approaching the 30-day archival threshold.", "warn"],
    ["Report Ready", "Q3 Performance Report is now available.", "ok"],
  ];

  return (
    <Panel title="Notification Center">
      {items.map(([title, detail, tone]) => (
        <div className={`notice ${tone}`} key={title}>
          <b>{title}</b>
          <p>{detail}</p>
          <small>Oct 26, 2023 11:02 AM</small>
        </div>
      ))}
    </Panel>
  );
}

// Shared expiry monitoring table for roles with expiry access.
export function ExpiryView({ title = "Expiry Monitoring", subtitle = "Manage and track agreements nearing expiration.", action }) {
  return (
    <section className="page">
      <PageTitle title={title} subtitle={subtitle} action={action} />
      <StatGrid
        stats={[
          ["18", "Total Expiring Soon", Filter],
          ["5", "Urgent Renewals", Filter, "", "danger"],
          ["12", "Awaiting Dept. Action", Filter],
          ["24", "Renewed (MTD)", Filter],
        ]}
      />
      <Panel title="Urgent Attention (Next 30 Days)" tools={<button className="outline"><Filter size={18} /> Filter</button>}>
        <DataTable headers={["Document Name / ID", "Partner Entity", "Expiry / Days", "Status", "Actions"]} rows={expiryRows} />
      </Panel>
    </section>
  );
}

// Shared notification archive for Department Staff and IRO Admin.
export function NotificationsView() {
  return (
    <section className="page">
      <PageTitle title="Notifications Archive" subtitle="Detailed chronological record of all alerts and submission updates." action="Mark All as Read" />
      <FilterBar labels={["All", "Submissions", "System", "Security", "Oct 01 - Oct 24"]} />
      <Panel title="Notification Details">
        <DataTable headers={["Type", "Notification Details", "Timestamp"]} rows={notificationRows} />
      </Panel>
    </section>
  );
}

// Shared filter strip used by dense list pages.
export function FilterBar({ labels }) {
  return (
    <div className="filter-bar">
      <Filter size={20} />
      {labels.map((label, index) => (
        <button className={index === 0 ? "active-filter" : ""} key={label}>
          {label}
          <ChevronDown size={16} />
        </button>
      ))}
    </div>
  );
}

// Shared upload dropzone used by submission and log/review pages.
export function Dropzone({ label = "Drag and drop file here", detail = "PDF, DOCX up to 25MB", selectedFile, onFileChange }) {
  const fileInputRef = React.useRef(null);

  function handleClick() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function handleFileSelect(event) {
    const nextFile = event.target?.files?.[0];
    if (nextFile && onFileChange) {
      onFileChange(nextFile);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    const nextFile = event.dataTransfer?.files?.[0];
    if (nextFile && onFileChange) {
      onFileChange(nextFile);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  return (
    <div
      className="dropzone"
      onClick={onFileChange ? handleClick : undefined}
      onDrop={onFileChange ? handleDrop : undefined}
      onDragOver={onFileChange ? handleDragOver : undefined}
      style={onFileChange ? { cursor: "pointer" } : undefined}
    >
      <UploadCloud size={42} />
      <b>{label}</b>
      <p>{detail}</p>
      {onFileChange && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.odt"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      )}
      {selectedFile && (
        <div className="dropzone-file-info">
          <strong>Selected file:</strong> {selectedFile.name}
        </div>
      )}
    </div>
  );
}

export function ExportButton({ label = "Export" }) {
  return (
    <button className="primary">
      <Download size={18} /> {label}
    </button>
  );
}
