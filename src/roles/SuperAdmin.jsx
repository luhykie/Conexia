import React from "react";
import { CalendarClock, FileText, Lock, Settings, ShieldCheck, UserPlus } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { DashboardView, ExportButton, FilterBar } from "../components/SharedViews";
import { departments } from "../data/departments";
import { seedUsers } from "../data/seedUsers";

// Routes all Super Admin pages through one role-owned component.
export function SuperAdmin({ page }) {
  if (page === "monitoring") return <SystemMonitoring />;
  if (page === "users") return <UserDirectory />;
  if (page === "audit") return <AuditLogs />;

  return (
    <DashboardView
      roleKey="super"
      title="Overall System Statistics"
      subtitle="Aggregated submissions, engagement, active sessions, and pending actions across all nodes."
      action="Read-only Governance Mode"
    />
  );
}

// Monitors system-wide workflow and infrastructure health.
function SystemMonitoring() {
  return (
    <section className="page super-admin-page">
      <PageTitle title="Workflow Status Monitor" subtitle="Live pipeline and resource health across all offices." />
      <Panel title="Workflow Status Monitor">
        <div className="pipeline">
          <span>Submitted<b>142 Cases</b></span>
          <span>Logged<b>89 Cases</b></span>
          <span>Review<b>34 Pending</b></span>
          <span>Notarization<b>Queue: 12</b></span>
        </div>
        <div className="mini-grid">
          <span>Average Processing Velocity<b>4.2 hrs/node</b></span>
          <span>Bottleneck Warning<b>Compliance Review Node</b></span>
        </div>
      </Panel>
      <Panel title="Pending Actions Tracker" tools={<ExportButton label="Export CSV" />}>
        <DataTable headers={["Office / Role", "Submission ID", "Wait Time", "Category", "Priority", "Status"]} rows={[
          ["Legal Operations - Senior Notary", "#LEX-9902-A", "18h 12m", "Corporate Restructuring", "Critical", "Awaiting Seal"],
          ["Compliance - Tier 2 Auditor", "#LEX-9915-C", "04h 45m", "Risk Assessment", "Standard", "Awaiting Review"],
          ["Institutional Oversight", "#LEX-9884-X", "02d 01h", "Board Resolution", "Critical", "Awaiting Final Sign"],
          ["General Counsel", "#LEX-9922-D", "00h 22m", "Strategic Partnership", "Standard", "Verification"],
        ]} />
      </Panel>
      <section className="dark-card">
        <ShieldCheck size={42} />
        <div><h2>System Integrity Status</h2><p>Uptime 99.998% - Security audits passed - Last check 14 minutes ago.</p></div>
      </section>
    </section>
  );
}

// Central user management for seeded accounts, roles, and department offices.
function UserDirectory() {
  const userRows = seedUsers.map((user) => [
    user.fullName,
    user.email,
    user.role,
    user.office,
    user.department || "-",
    "Active",
    "Shared development password",
  ]);

  return (
    <section className="page super-admin-page">
      <PageTitle title="User Directory & Governance" subtitle="Create accounts, assign roles, and monitor access." action="Create User" />
      <div className="security-note">
        <Lock size={20} /> Public registration is disabled. Accounts are created by Super Admin and protected through RBAC.
      </div>
      <div className="two-col">
        <Panel title="Create User">
          <div className="form-grid admin-form">
            <label>Full Name<input placeholder="Full name" /></label>
            <label>Institutional Email<input placeholder="user@conexia.com" /></label>
            <label>Role<select><option>Department Staff</option><option>IRO Staff</option><option>IRO Admin</option><option>Legal Counsel</option><option>Super Admin</option></select></label>
            <label>Office<select>{departments.map((dept) => <option key={dept.code}>{dept.name}</option>)}</select></label>
            <label>Department<select>{departments.map((dept) => <option key={dept.code}>{dept.code} - {dept.name}</option>)}</select></label>
            <label>Temporary Password<input value="conexia123" readOnly /></label>
          </div>
          <div className="action-strip">
            <button className="primary"><UserPlus size={18} /> Create Development User</button>
            <span>Creates a profile row for the prototype and demonstrates the planned Supabase Admin flow.</span>
          </div>
        </Panel>
        <Panel title="Account Actions">
          {["Edit User", "Activate User", "Deactivate User", "Reset Password", "Change Role", "Change Office", "Change Department"].map((action) => (
            <button className="management-action" key={action}><Settings size={18} /> {action}</button>
          ))}
        </Panel>
      </div>
      <Panel title="Development Seed Accounts">
        <DataTable headers={["Full Name", "Email", "Role", "Office", "Department", "Status", "Password Policy"]} rows={userRows} />
      </Panel>
      <Panel title="Official Schools & Programs">
        <DataTable headers={["Department Code", "Office / Department Name", "Seed Email"]} rows={departments.map((dept) => [dept.code, dept.name, dept.email])} />
      </Panel>
    </section>
  );
}

// Shows immutable system activity and anomaly review events.
function AuditLogs() {
  return (
    <section className="page super-admin-page">
      <PageTitle title="Audit Logs" subtitle="Comprehensive chronological history of system-wide administrative actions." action="Refresh Logs" />
      <FilterBar labels={["All Users", "Global HQ", "All Modules", "All Actions", "11/01/2023 to 11/20/2023"]} />
      <Panel title="1,248 Total Entries - 12 Anomalies Flagged" tools={<ExportButton label="Export CSV" />}>
        <DataTable headers={["Timestamp", "Principal Agent", "Office Context", "Module", "Action", "Target Entity", "Verification"]} rows={[
          ["2023-11-20 14:22:01.442", "Admin_Alpha", "Global HQ", "Security/Auth", "Delete", "USR_TOKEN_44921", "Verified"],
          ["2023-11-20 14:15:48.001", "Gov_Bravo", "London Office", "Asset Management", "Update", "ASSET_ID_9901", "Verified"],
          ["2023-11-20 13:58:22.912", "Sys_Charlie", "Tokyo Hub", "User Registry", "Create", "USR_NEW_NODE_X", "Verified"],
          ["2023-11-20 13:12:05.671", "Unauthenticated_Proxy", "Unknown Node", "Core Kernel", "Purge", "CRITICAL_V_SYS_ROOT", "Flagged"],
        ]} />
      </Panel>
      <div className="stats-grid">
        <article className="stat-card"><CalendarClock /><strong>14%</strong><p>Activity volume increase from previous cycle.</p></article>
        <article className="stat-card danger"><ShieldCheck /><strong>1</strong><p>Anomalous purge action isolated for manual review.</p></article>
        <article className="stat-card"><FileText /><strong>Valid</strong><p>All shown logs are hashed and verified.</p></article>
      </div>
    </section>
  );
}
