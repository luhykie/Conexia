import React from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  Bell,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Filter,
  Folder,
  Gauge,
  Gavel,
  Grid2X2,
  Handshake,
  History,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import "./styles.css";
import { isSupabaseConfigured, supabaseConfig } from "./supabaseConfig";

const roles = {
  super: {
    label: "SUPER ADMIN",
    subtitle: "Manage the entire system, users, roles, permissions, workflows, and audit logs.",
    theme: "SUPER ADMIN",
    user: "Alex Mercer",
    title: "SUPER ADMIN",
    icon: ShieldCheck,
  },
  admin: {
    label: "IRO ADMIN",
    subtitle: "Manage document routing, validate review forms, archive agreements, and generate reports.",
    theme: "IRO ADMIN",
    user: "TROY",
    title: "IRO ADMIN",
    icon: Building2,
  },
  staff: {
    label: "IRO STAFF",
    subtitle: "Receive submissions, log agreements, generate review forms, and route to Legal.",
    theme: "IRO STAFF PORTAL",
    user: "Sarah Jenkins",
    title: "SENIOR OFFICER",
    icon: Folder,
  },
  legal: {
    label: "LEGAL COUNSEL",
    subtitle: "Review agreements, approve or return documents, record notarization.",
    theme: "LEGAL COUNSEL",
    user: "Counsel Elena Vance",
    title: "SENIOR NOTARY",
    icon: Gavel,
  },
  department: {
    label: "DEPARTMENT STAFF",
    subtitle: "Submit documents, monitor status, receive legal comments, and resubmit.",
    theme: "Institutional Repository",
    user: "Dr. Elena Santos",
    title: "Registrar Office",
    icon: GraduationCapLike,
  },
};

const nav = {
  department: [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["submission", "Submission", FilePlus2],
    ["submissions", "My Submissions", FileText],
    ["engagements", "Engagements", Handshake],
    ["expiry", "Expiry", CalendarClock],
    ["notifications", "Notifications", Bell],
  ],
  staff: [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["incoming", "Incoming Submissions", Folder],
    ["log-review", "Log & Review", FileCheck2],
    ["status", "Status Tracker", Gauge],
    ["expiry", "Expiry", CalendarClock],
  ],
  admin: [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["log-review", "Log & Review Form", FileText],
    ["validation", "Validation Queue", ClipboardCheck],
    ["reassign", "Reassign Submissions", RefreshCw],
    ["reports", "Performance Reports", Gauge],
    ["archive", "Archive", Archive],
    ["engagements", "Engagements", Handshake],
    ["expiry", "Expiry", CalendarClock],
    ["notifications", "Notifications", Bell],
  ],
  legal: [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["review", "Review Queue", ClipboardCheck],
    ["notarization", "Notarization Tracker", FileText],
    ["expiry", "Expiry", CalendarClock],
    ["history", "My Action History", History],
  ],
  super: [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["monitoring", "System Monitoring", Gauge],
    ["users", "User Directory", Users],
    ["audit", "Audit Logs", ClipboardCheck],
  ],
};

const statSeed = {
  department: [
    ["14", "Active Submissions", Grid2X2, "OWN OFFICE"],
    ["06", "Pending Corrections", Clock3, "REQUIRES ACTION", "warn"],
    ["128", "Approved", ShieldCheck],
    ["42", "Notarized", Gavel],
  ],
  staff: [
    ["12", "Unlogged", CalendarClock, "+2 New"],
    ["08", "Logged Today", CheckCircle2],
    ["15", "Awaiting Check", ClipboardCheck],
    ["24", "Routed To Legal", Gavel],
  ],
  admin: [
    ["1,284", "Total Submissions", Folder, "+12%"],
    ["42", "Pending Validation", CalendarClock, "! Critical", "warn"],
    ["2.4 days", "Turnaround Avg.", Gauge, "Target"],
    ["892", "Notarized", FileCheck2, "This Month", "dark"],
  ],
  legal: [
    ["14", "Pending Review", CalendarClock, "Priority", "warn"],
    ["08", "Pending Notarization", Gavel, "Staged", "blue"],
    ["22", "Approved", ShieldCheck, "Complete"],
    ["05", "Corrections Sent", FileText, "Action Req", "danger"],
  ],
  super: [
    ["12,842", "Total Submissions", FileText, "+14.2% from last cycle"],
    ["88.4%", "User Engagement", Users, "+2.1 peak efficiency"],
    ["1,054", "Active Sessions", Gauge, "Currently monitored"],
    ["32", "Pending Verification", CalendarClock, "Requires departmental review", "danger"],
  ],
};

const seededUsers = [
  ["Conexia Super Admin", "admin@conexia.com", "Super Admin", "System Administration", "-", "Active", "Today 08:00 AM"],
  ["PAIR IRO Staff", "irostaff@conexia.com", "IRO Staff", "Partnerships and International Relations Office", "-", "Active", "Today 08:12 AM"],
  ["PAIR IRO Administrator", "iroadmin@conexia.com", "IRO Admin", "Partnerships and International Relations Office", "-", "Active", "Today 08:20 AM"],
  ["Legal Counsel", "legal@conexia.com", "Legal Counsel", "Legal Office", "-", "Active", "Yesterday 04:40 PM"],
  ["SBM Department Staff", "sbm@conexia.com", "Department Staff", "School of Business and Management", "SBM", "Active", "Pending first login"],
  ["SEA Department Staff", "sea@conexia.com", "Department Staff", "School of Engineering and Architecture", "SEA", "Active", "Pending first login"],
  ["SAS Department Staff", "sas@conexia.com", "Department Staff", "School of Arts and Sciences", "SAS", "Active", "Pending first login"],
  ["SAMS Department Staff", "sams@conexia.com", "Department Staff", "School of Allied Medical Sciences", "SAMS", "Active", "Pending first login"],
  ["SCS Department Staff", "scs@conexia.com", "Department Staff", "School of Computer Studies", "SCS", "Active", "Pending first login"],
  ["SED Department Staff", "sed@conexia.com", "Department Staff", "School of Education", "SED", "Active", "Pending first login"],
  ["SOL Department Staff", "sol@conexia.com", "Department Staff", "School of Law", "SOL", "Active", "Pending first login"],
  ["ETEEAP Department Staff", "eteeap@conexia.com", "Department Staff", "Expanded Tertiary Education Equivalency and Accreditation Program", "ETEEAP", "Active", "Pending first login"],
];

const departments = [
  ["SBM", "School of Business and Management"],
  ["SEA", "School of Engineering and Architecture"],
  ["SAS", "School of Arts and Sciences"],
  ["SAMS", "School of Allied Medical Sciences"],
  ["SCS", "School of Computer Studies"],
  ["SED", "School of Education"],
  ["SOL", "School of Law"],
  ["ETEEAP", "Expanded Tertiary Education Equivalency and Accreditation Program"],
];

const activities = [
  ["#IRO-84920", "Vertex Logistics Corp.", "Annual Audit", "10:45 AM", "Approved"],
  ["#IRO-84918", "Global Nexus Ltd.", "License Renewal", "09:12 AM", "Pending"],
  ["#IRO-84915", "Starlight Foundation", "Compliance Filings", "Yesterday", "Notarized"],
  ["#IRO-84912", "Apex Manufacturing", "Tax Exemption", "Yesterday", "Approved"],
  ["#IRO-84909", "Oceanic Blue LLC", "Risk Assessment", "Oct 24, 2023", "Flagged"],
];

function GraduationCapLike(props) {
  return <Shield {...props} />;
}

function App() {
  const [role, setRole] = React.useState("department");
  const [screen, setScreen] = React.useState("role");
  const [page, setPage] = React.useState("dashboard");

  const selectRole = (next) => {
    setRole(next);
    setPage("dashboard");
  };

  if (screen === "landing") return <Landing onStart={() => setScreen("role")} />;
  if (screen === "role") {
    return <RoleSelect role={role} setRole={selectRole} onLogin={() => setScreen("login")} onContinue={() => setScreen("app")} />;
  }
  if (screen === "login") {
    return <Login onBack={() => setScreen("role")} onLogin={() => setScreen("app")} />;
  }
  return <Shell roleKey={role} page={page} setPage={setPage} onLogout={() => setScreen("role")} />;
}

function Landing({ onStart }) {
  return (
    <main className="landing">
      <header className="marketing-nav">
        <strong>CONEXIA</strong>
        <nav><span className="active-link">Product</span><span>Solutions</span><span>Security</span><span>Pricing</span></nav>
        <button className="ghost">Login</button>
        <button onClick={onStart}>Get Started</button>
      </header>
      <section className="hero">
        <div>
          <span className="pill">Trusted by 500+ universities</span>
          <h1>Connecting Institutions,<br /><em>Simplifying Partnerships</em></h1>
          <p>The definitive OS for global academic document management. Automate workflows with security and real-time compliance.</p>
          <button onClick={onStart}>Get Started</button>
          <button className="link-btn">Explore Platform <ChevronRight size={20} /></button>
        </div>
      </section>
      <section className="feature-band">
        <h2>Streamlined Institutional Management</h2>
        <p>A unified platform for secure academic document management and global partnership scaling.</p>
        <div className="feature-grid">
          {["Smart Workflows", "Global Compliance", "Secure Vault", "Digital Signing"].map((item, i) => {
            const Icon = [FileCheck2, Gauge, Shield, Handshake][i];
            return (
            <article className="feature-card" key={item}>
              <Icon size={26} />
              <h3>{item}</h3>
              <p>Automated logic for repetitive requests.</p>
            </article>
          )})}
        </div>
      </section>
    </main>
  );
}

function RoleSelect({ role, setRole, onLogin, onContinue }) {
  return (
    <main className="role-screen">
      <section className="role-hero">
        <strong>CONEXIA</strong>
        <div>
          <h1>Connecting Institutions,<br /><span>Simplifying Partnerships</span></h1>
          <p>Manage MOA, MOU, and MOF documents through a secure and intelligent workflow system designed for universities and partner institutions.</p>
          <div className="role-pills"><span>Secure Document Repository</span><span>Automated Workflow</span><span>International Collaboration</span></div>
        </div>
        <footer>© 2026 CONEXIA / University International Relations Office</footer>
      </section>
      <section className="role-picker">
        <div className="secure-badge"><ShieldCheck size={18} /> Secure Institutional Portal</div>
        <h2>Select Your Role</h2>
        <p>Choose your workspace to continue to the dashboard.</p>
        <div className="role-list">
          {Object.entries(roles).map(([key, item]) => {
            const Icon = item.icon;
            return (
              <button className={`role-card ${role === key ? "selected" : ""}`} onClick={() => setRole(key)} key={key}>
                <span><Icon size={30} /></span>
                <b>{item.label}</b>
                <small>{item.subtitle}</small>
              </button>
            );
          })}
        </div>
        <button className="wide" onClick={onLogin}>LOGIN <ChevronRight /></button>
        <button className="text-action" onClick={onContinue}>Preview Dashboard</button>
      </section>
    </main>
  );
}

function Login({ onLogin }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <h1>CONEXIA</h1>
        <p>INTELLIGENT DOCUMENT SYSTEMS</p>
        <div className={`auth-status ${isSupabaseConfigured ? "ready" : "pending"}`}>
          <ShieldCheck size={18} />
          {isSupabaseConfigured ? "Supabase Auth connected" : "Supabase URL saved. Add anon key to enable real login."}
          <small>{supabaseConfig.url}</small>
        </div>
        <label>Email<input placeholder="role@conexia.com" /></label>
        <label>Password<input placeholder="••••••••" type="password" /></label>
        <a>Forgot Password?</a>
        <button onClick={onLogin}>Log In <ChevronRight /></button>
        <small>Accounts are created only by the Super Admin.</small>
      </div>
      <footer>© 2024 CONEXIA University Systems <span>Secure Institutional Portal</span><span>Privacy Policy</span><span>Accessibility</span><span>Help</span></footer>
    </main>
  );
}

function Shell({ roleKey, page, setPage, onLogout }) {
  const role = roles[roleKey];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><div className="seal"><FileText size={34} /></div><h1>CONEXIA</h1><p>{role.theme}</p></div>
        <nav>
          {nav[roleKey].map(([id, label, Icon]) => (
            <button className={page === id ? "active" : ""} onClick={() => setPage(id)} key={id}><Icon size={23} /> {label}</button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button><Settings size={22} /> Settings</button>
          <button onClick={onLogout}><LogOut size={22} /> Logout</button>
        </div>
      </aside>
      <main className="workspace">
        <Topbar role={role} roleKey={roleKey} />
        <Page roleKey={roleKey} page={page} />
      </main>
    </div>
  );
}

function Topbar({ role, roleKey }) {
  return (
    <header className="topbar">
      <div className="search"><Search size={24} /><input placeholder={roleKey === "super" ? "Search system events..." : "Search tracking ID, partner, or department..."} /></div>
      <Bell size={24} /><Settings size={24} />
      <div className="profile"><div>{role.user}<small>{role.title}</small></div><div className="avatar">{role.user[0]}</div></div>
    </header>
  );
}

function Page({ roleKey, page }) {
  if (page === "submission") return <SubmissionPage />;
  if (page === "submissions") return <MySubmissions />;
  if (page === "engagements") return <Engagements roleKey={roleKey} />;
  if (page === "expiry") return <Expiry roleKey={roleKey} />;
  if (page === "notifications") return <Notifications roleKey={roleKey} />;
  if (page === "incoming") return <Incoming />;
  if (page === "log-review") return <LogReview roleKey={roleKey} />;
  if (page === "status") return <StatusTracker />;
  if (page === "validation") return <Validation />;
  if (page === "reassign") return <Reassign />;
  if (page === "reports") return <Reports />;
  if (page === "archive") return <ArchivePage />;
  if (page === "review") return <ReviewQueue />;
  if (page === "notarization") return <Notarization />;
  if (page === "history") return <HistoryPage />;
  if (page === "monitoring") return <Monitoring />;
  if (page === "users") return <UsersPage />;
  if (page === "audit") return <AuditLogs />;
  return <Dashboard roleKey={roleKey} />;
}

function Dashboard({ roleKey }) {
  return (
    <section className="page">
      <PageTitle title={roleKey === "super" ? "Overall System Statistics" : roleKey === "admin" ? "Office Overview" : roleKey === "legal" ? "Legal Counsel Dashboard" : roleKey === "staff" ? "Dashboard Overview" : "Institutional Workspace"} subtitle="Real-time status of institutional document submissions and office throughput." action={roleKey !== "super" ? "New Submission" : "Read-only Governance Mode"} />
      <StatGrid stats={statSeed[roleKey]} />
      <div className="dashboard-grid">
        <Panel title={roleKey === "staff" ? "Pending Submissions Detail" : "Recent Activity"}>
          <DataTable headers={["Submission ID", "Entity Name", "Type", "Timestamp", "Status"]} rows={activities} />
        </Panel>
        <NotificationPanel />
      </div>
      {roleKey === "legal" && <DarkCallout />}
      {roleKey === "super" && <SystemCharts />}
    </section>
  );
}

function PageTitle({ title, subtitle, action }) {
  return (
    <div className="page-title">
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      {action && <button className="primary"><Plus size={20} /> {action}</button>}
    </div>
  );
}

function StatGrid({ stats }) {
  return <div className="stats-grid">{stats.map(([value, label, Icon, tag, tone]) => <article className={`stat-card ${tone || ""}`} key={label}><Icon size={34} /><span>{tag}</span><strong>{value}</strong><p>{label}</p></article>)}</div>;
}

function Panel({ title, children, tools }) {
  return <section className="panel"><header><h2>{title}</h2><div>{tools}</div></header>{children}</section>;
}

function DataTable({ headers, rows }) {
  return (
    <div className="table" style={{ "--cols": headers.length }}>
      <div className="thead">{headers.map((h) => <span key={h}>{h}</span>)}</div>
      {rows.map((row, i) => <div className="tr" key={i}>{row.map((cell, j) => <span key={j} className={j === row.length - 1 ? `badge ${String(cell).toLowerCase().replaceAll(" ", "-")}` : ""}>{cell}</span>)}</div>)}
      <footer>Showing 1-{rows.length} of 128 records <div><button>‹</button><button className="active-page">1</button><button>2</button><button>›</button></div></footer>
    </div>
  );
}

function NotificationPanel() {
  const items = [
    ["Validation Required", "Batch #402-A requires urgent validation before the daily cycle cutoff.", "new"],
    ["Task Reassigned", "Submission #IRO-84192 reassigned to Office B.", "info"],
    ["Expiry Alert", "12 files are approaching the 30-day archival threshold.", "warn"],
    ["Report Ready", "Q3 Performance Report is now available.", "ok"],
  ];
  return <Panel title="Notification Center">{items.map(([t, d, k]) => <div className={`notice ${k}`} key={t}><b>{t}</b><p>{d}</p><small>Oct 26, 2023 11:02 AM</small></div>)}<button className="outline wide-inline">Clear All Notifications</button></Panel>;
}

function SubmissionPage() {
  return (
    <section className="page">
      <PageTitle title="Submit New Document" subtitle="Initiate a formal review process for Memorandums of Agreement, Understanding, or Facilities." />
      <div className="two-col">
        <div>
          <StepLine />
          <FormPanel title="Partner Institution Details" fields={["Partner Institution Name", "Agreement Type", "Expected Duration"]} />
          <Panel title="Document Upload Section"><div className="dropzone"><UploadCloud size={46} /><b>Drag and drop agreement draft here</b><p>PDF, DOCX, ODT · MAX 25MB</p></div><div className="file-row"><FileText /> University_MOA_Draft_v1.2.pdf <small>1.4 MB · READY TO SCAN</small></div></Panel>
        </div>
        <aside className="summary-card"><h2>Review Summary</h2><p>Intended Partner: ---</p><p>Agreement Class: <b>Memorandum of Agreement</b></p><p>Processing Office: <b>Central Admin Office</b></p><button>Submit for Review <ChevronRight /></button><button className="outline">Save as Draft</button></aside>
      </div>
    </section>
  );
}

function StepLine() {
  return <div className="steps"><span className="on">1<b>Partner Info</b></span><span>2<b>Upload</b></span><span>3<b>Confirmation</b></span></div>;
}

function FormPanel({ title, fields }) {
  return <Panel title={title}><div className="form-grid">{fields.map((f) => <label key={f}>{f}<input placeholder={f.includes("Date") ? "mm/dd/yyyy" : f} /></label>)}</div></Panel>;
}

function MySubmissions() {
  return (
    <section className="page split-page">
      <div>
        <PageTitle title="My Submissions" subtitle="Real-time tracking of institutional documents and partner agreements." />
        <StatGrid stats={[["12", "Currently in review", Gauge, "Active"], ["04", "Awaiting signature", Clock3, "Pending"], ["02", "Requires resubmission", FileText, "Resubmit", "danger"]]} />
        <Panel title="Submission Records"><DataTable headers={["Tracking #", "Partner", "Type"]} rows={[["#USJR-2023-0842", "Metro Pacific Hospitals", "Internship MOA"], ["#USJR-2023-0912", "Silliman University", "Joint Research Fund"], ["#USJR-2023-1105", "PLDT Enterprise", "Tech Infrastructure MOU"], ["#USJR-2023-1140", "Cebu IT Park Auth", "Land Lease Agreement"]]} /></Panel>
      </div>
      <aside className="detail-drawer"><button><X /></button><span className="badge danger">Resubmit Required</span><h2>Metro Pacific Hospitals MOA</h2><p>Submitted by Dr. Elena Santos · Oct 20, 2023</p><h3>Legal Comments</h3><div className="comment danger"><b>Atty. Marcus V.</b><p>The indemnity clause in Section 4.2 is too broad. Please align with the standard university template.</p></div><h3>Version History</h3><div className="file-row"><FileText /> V2_MOA_Draft_Final.pdf <Download /></div><button className="primary wide-inline">Submit Corrected Document</button></aside>
    </section>
  );
}

function Engagements({ roleKey }) {
  return (
    <section className="page split-page">
      <div>
        <PageTitle title={roleKey === "admin" ? "Partner Engagements" : "Engagements Management"} subtitle="Oversee institutional partnerships and document compliance." action="New Engagement" />
        <FilterBar labels={["All Departments", "All Agreement Types", "Active"]} />
        <Panel title="Active Engagements"><DataTable headers={["Partner Organization", "Type / Department", "Validity Period", "Status", "Action"]} rows={[["Global Health Alliance", "Research Collaboration", "Jan 12, 2024 - Jan 11, 2027", "Active", "⋮"], ["Nordic Tech University", "Student Exchange", "Expires in 14 days", "Expiring", "Renew Now"], ["Quantum Dynamics Ltd.", "Strategic MOU", "Approval In Progress", "Pending", "Edit"], ["City Urban Planning Board", "Consultancy Project", "Ended Dec 2023", "Completed", "Download"]]} /></Panel>
      </div>
      <aside className="detail-drawer"><button><X /></button><span className="badge active">Active Partner</span><h2>Global Health Alliance</h2><p>Multinational health research non-profit focused on tropical disease mitigation.</p><div className="mini-grid"><span>Status<b>Verified Active</b></span><span>Risk Level<b>Low (Tier 1)</b></span></div><h3>Agreement Documents</h3><div className="file-row"><FileText /> signed_mou_v2.pdf <Download /></div><div className="file-row"><FileText /> risk_assessment.docx <Download /></div><button className="primary wide-inline">Edit Engagement</button></aside>
    </section>
  );
}

function Expiry({ roleKey }) {
  return (
    <section className="page">
      <PageTitle title={roleKey === "admin" ? "Agreement Expiry Tracking" : roleKey === "legal" ? "Institutional Workspace" : "Expiry Monitoring"} subtitle="Manage and track agreements nearing expiration." action={roleKey === "staff" ? "Bulk Notify Offices" : roleKey === "legal" ? "New Submission" : "Manual Update"} />
      <StatGrid stats={[["18", "Total Expiring Soon", CalendarClock], ["5", "Urgent Renewals", Info, "", "danger"], ["12", "Awaiting Dept. Action", ClipboardCheck], ["24", "Renewed (MTD)", ShieldCheck]]} />
      <Panel title={roleKey === "legal" ? "Notarized Agreements Monitoring" : "Urgent Attention (Next 30 Days)"} tools={<><button className="outline"><Filter size={18} /> Filter</button></>}>
        <DataTable headers={["Document Name / ID", "Partner Entity", "Expiry / Days", "Status", "Actions"]} rows={[["MOU: Global Tech Internship Program", "Global Tech Solutions", "Expired (3 days ago)", "Critical", "Initiate Renewal"], ["Facility Access Lease: Block 4 Annex", "Real Estate Management Corp.", "Expires in 5 days", "Expiring", "Initiate Renewal"], ["Data Processing Agreement", "Azure Systems Int.", "Expires in 15 days", "Active", "View Document"], ["Student Insurance Master Policy", "Metropolitan Insurance", "Expires in 22 days", "Active", "View Document"]]} />
      </Panel>
    </section>
  );
}

function Notifications() {
  return (
    <section className="page">
      <PageTitle title="Notifications Archive" subtitle="Detailed chronological record of all system alerts, submission updates, and administrative actions." action="Mark All as Read" />
      <FilterBar labels={["All", "Submissions", "System", "Security", "Oct 01, 2023 - Oct 24, 2023"]} />
      <Panel title="Notification Details"><DataTable headers={["Type", "Notification Details", "Timestamp"]} rows={[["Urgent", "Correction Requested: MOU Renewal", "October 24, 2023 02:15 PM"], ["Success", "Submission Approved: International Research Grant", "October 24, 2023 11:30 AM"], ["Success", "Notarization Completed: Property Lease Agreement", "October 23, 2023 04:45 PM"], ["Security", "New User Access Granted", "October 23, 2023 09:12 AM"], ["Info", "System Maintenance Schedule", "October 22, 2023 01:30 PM"]]} /></Panel>
    </section>
  );
}

function Incoming() {
  return <section className="page"><PageTitle title="Incoming Queue" subtitle="Cross-department incoming document submissions." /><StatGrid stats={[["42", "Total Pending", Folder, "+12 New"], ["18", "Under Review", FileText, "Avg 2.4d"]]} /><FilterBar labels={["All Departments", "College of Law", "Engineering", "Business School", "Medicine"]} /><Panel title="Active Submissions" tools={<button className="primary"><Download size={18} /> Export CSV</button>}><DataTable headers={["Tracking #", "Department", "Document Type", "Date Submitted", "Status"]} rows={[["#IRO-2024-0012", "College of Law", "MOU - Legal Internship", "Oct 24, 2023 09:45 AM", "Submitted"], ["#IRO-2024-0013", "Engineering", "MOA - Tech Exchange", "Oct 23, 2023 02:15 PM", "Logged"], ["#IRO-2024-0015", "Business School", "MOF - Corporate Funding", "Oct 22, 2023 11:30 AM", "Under Review"], ["#IRO-2024-0018", "College of Law", "MOU - Research Collab", "Oct 21, 2023 04:50 PM", "Submitted"]]} /></Panel></section>;
}

function LogReview({ roleKey }) {
  return (
    <section className="page">
      <PageTitle title="Log & Review Form" subtitle="Register institutional agreements and perform initial administrative reviews." action={roleKey === "staff" ? "Mark as Logged" : undefined} />
      <div className="two-col">
        <div>{roleKey === "staff" && <DocumentPreview />}<FormPanel title="Partner Information" fields={["Partner Name", "Institution Type", "Country", "Contact Person"]} /><FormPanel title="Agreement Details" fields={["Agreement Type", "Effective Date", "Expiry Date", "Objective / Purpose"]} />{roleKey !== "staff" && <Panel title="Document Upload"><div className="dropzone"><UploadCloud /><b>Drag and drop file here</b><p>PDF, DOCX up to 25MB</p></div></Panel>}</div>
        <aside className="review-panel"><h2>Administrative Review</h2>{["Signatures Present", "Terms Defined", "Attachments Included", "GDPR Compliance"].map((x) => <label className="checkline" key={x}><input type="checkbox" /> {x}</label>)}<label>Route To<select><option>Legal Counsel</option></select></label><label>Staff Remarks<textarea placeholder="Add administrative notes..." /></label><button>Submit & Route <ChevronRight /></button><button className="outline">Save Draft</button></aside>
      </div>
    </section>
  );
}

function DocumentPreview() {
  return <Panel title="Document Preview: DRAFT_MOA_V2.1.PDF"><div className="doc-preview"><h3>MEMORANDUM OF AGREEMENT</h3><p>Standard Institutional Template v4.0</p><p>KNOW ALL MEN BY THESE PRESENTS:</p><p>This Agreement made and entered into this 24th day of October 2023 by and between the Department of Institutional Relations and Global Logistics Solutions Inc...</p></div></Panel>;
}

function StatusTracker() {
  return <section className="page split-page"><div><PageTitle title="Submission Progression" subtitle="Real-time status of active institutional agreements." /><StatusCard id="CTX-9902" name="Pacific Global University" active /><StatusCard id="CTX-9884" name="Nautical Research Institute" /><StatusCard id="CTX-9871" name="Vanguard Medical College" active /></div><aside className="detail-drawer static"><h2>Audit Trail</h2>{["Status Changed to Under Review", "Logged & Verified", "Initial Submission"].map((x) => <div className="timeline-item" key={x}><b>{x}</b><p>Complete lifecycle history of the current submission.</p><small>OCT 14, 11:30</small></div>)}<button className="primary wide-inline">Generate Export Log</button></aside></section>;
}

function StatusCard({ id, name, active }) {
  return <article className="status-card"><span className="badge active">ID: {id}</span><h2>{name}</h2><div className="progress-steps"><span className="done">Submitted</span><span className="done">Logged</span><span className={active ? "done" : ""}>Under Review</span></div><footer><span>MOA (Institutional)</span><span>Engineering Dept.</span><b>Time in Current Status {active ? "2d 14h" : "14h 22m"}</b></footer></article>;
}

function Validation() {
  return <section className="page"><PageTitle title="Validation Queue" subtitle="Pending document verifications and institutional submission approvals." action="Refresh Queue" /><StatGrid stats={[["124 Cases", "Pending Total", CalendarClock], ["18 Cases", "Urgent", Info, "", "danger"], ["4.2 Hours", "Avg. Wait Time", Clock3], ["42 Cases", "Validated Today", CheckCircle2]]} /><FilterBar labels={["All Departments", "All Priorities", "All Statuses"]} /><Panel title="Validation Queue"><DataTable headers={["ID / Case Ref", "Submission Date", "Department", "Entity Name", "Priority", "Status", "Actions"]} rows={[["#VAL-98231", "24 Oct 2023, 09:12", "Global Compliance", "Nexus Logistics Ltd", "Urgent", "New Submission", "Validate"], ["#VAL-98228", "23 Oct 2023, 16:45", "Institutional Finance", "Apex Capital Partners", "High", "Under Review", "Validate"], ["#VAL-98225", "23 Oct 2023, 14:10", "Legal Affairs", "Stellar Biotech", "Medium", "New Submission", "Validate"]]} /></Panel></section>;
}

function Reassign() {
  return <section className="page"><PageTitle title="Reassign Submissions" subtitle="Transfer active cases between department staff to optimize workflow distribution." /><div className="two-col"><Panel title="Pending Submissions"><DataTable headers={["Submission ID", "Requester", "Current Assignee", "Priority"]} rows={[["IRO-2023-9081", "Global Logistics Corp", "Jane Doe", "High"], ["IRO-2023-9095", "Apex Tech Solutions", "Marcus Smith", "Normal"], ["IRO-2023-9112", "City Health Group", "Jane Doe", "Medium"]]} /></Panel><aside className="form-card"><h2>Assignment Details</h2><div className="selected-record">IRO-2023-9095<br /><small>Apex Tech Solutions</small></div><label>Reassign To<select><option>Select staff member...</option></select></label><label>Reason for Reassignment<textarea placeholder="Briefly explain the administrative reason..." /></label><button>Confirm Reassignment</button><button className="outline">Cancel Request</button></aside></div></section>;
}

function Reports() {
  return <section className="page"><PageTitle title="Institutional Performance Reports" subtitle="Institutional oversight" action="Export Report" /><StatGrid stats={[["1,482", "Total Reviewed", FileCheck2, "+12.5% from last quarter"], ["94", "Total Returned", RefreshCw, "-4.2% correction rate", "danger"], ["1,126", "Total Notarized", Shield, "86% fulfillment rate"]]} /><div className="two-col"><Panel title="Workflow Efficiency: Average Time per Stage">{["Document Logging", "Administrative Review", "Legal Counsel Approval", "Final Notarization"].map((s, i) => <div className="bar-row" key={s}><span>Stage {i + 1}: {s}</span><b>{[0.4, 1.8, 3.2, 0.8][i]} Days</b><i style={{ width: `${[16, 55, 82, 28][i]}%` }} /></div>)}</Panel><Panel title="Agreement Volume Trends"><div className="bars">{[46, 58, 66, 82, 62, 50].map((h, i) => <span style={{ height: h + "%" }} key={i} />)}</div></Panel></div><Panel title="Departmental Breakdown"><DataTable headers={["Department / Office", "Total Requests", "Approved", "Returned", "Avg. Turnaround", "Success Rate"]} rows={[["College of Law", "412", "390", "22", "4.2 Days", "94.6%"], ["Engineering & Tech", "285", "240", "45", "6.8 Days", "84.2%"], ["Medicine & Health", "354", "342", "12", "3.1 Days", "96.6%"]]} /></Panel></section>;
}

function ArchivePage() {
  return <section className="page"><PageTitle title="Records Archive" subtitle="Secure workspace for finalizing agreement distribution and archival." action="Export Registry" /><StatGrid stats={[["1,284", "Total Archived", Archive], ["24", "Finalized Today", Check], ["12", "Pending Archival", CalendarClock, "", "warn"], ["03", "Audit Flags", Info, "", "danger"]]} /><Panel title="Archive Records"><DataTable headers={["Tracking ID", "Partner Name", "Type", "Distribution Date", "Completion", "Status", "Actions"]} rows={[["#2024-AG-9102", "Global Tech Solutions Inc.", "MOA", "Oct 12, 2024", "100%", "Distributed", "Mark as Archived"], ["#2024-AG-8841", "Sovereign Logistics Ltd.", "MOU", "Sep 28, 2024", "100%", "Archived", "View Vault"], ["#2024-AG-7922", "Emerald Heritage Foundation", "MOF", "Oct 05, 2024", "65%", "In Distribution", "Locked"]]} /></Panel></section>;
}

function ReviewQueue() {
  return <section className="page split-page"><div><PageTitle title="Review Queue" subtitle="Manage and audit documents explicitly routed for your counsel." /><FilterBar labels={["All Routed", "Urgent"]} /><Panel title="Routed Documents"><DataTable headers={["Tracking #", "Partner", "Document Type", "Route Date", "Status"]} rows={[["#CX-88219", "Global Logistics Corp", "Draft MOA", "Oct 12, 2023", "Pending Review"], ["#CX-88224", "Artemis Ventures", "MOU Amendment", "Oct 14, 2023", "Pending Review"], ["#CX-88231", "Pacific Energy", "ND Agreement", "Oct 15, 2023", "Pending Review"]]} /></Panel></div><aside className="review-sidebar"><h2>Review Sidebar</h2><div className="dropzone"><FileText /><b>Draft MOA_v2.pdf</b><p>1.4 MB · Generated Oct 12</p></div><label>Liability Assessment<textarea placeholder="Enter findings on indemnity clauses..." /></label><label className="checkline"><input type="checkbox" /> Compliance Verified</label><footer><button className="outline danger">Return</button><button>Approve</button></footer></aside></section>;
}

function Notarization() {
  return <section className="page"><PageTitle title="Notarization Tracker" subtitle="Track pending notarization records and completed notarial entries." /><StatGrid stats={[["42", "Total Queue", ClipboardCheck], ["18", "Pending Approval", CalendarClock, "", "blue"], ["124", "Completed (MTD)", CheckCircle2]]} /><div className="two-col"><Panel title="Document Tracking Queue"><DataTable headers={["Document ID", "Entity / Client", "Status", "Last Activity", "Action"]} rows={[["#DOC-2024-881", "Sterling-Cooper Ltd.", "Pending Notarization", "2h ago", "Record"], ["#DOC-2024-879", "Arasaka Corp.", "Notarized", "Yesterday", "View"], ["#DOC-2024-875", "Weyland-Yutani", "Pending Notarization", "3 days ago", "Record"]]} /></Panel><aside className="form-card"><h2>Record Notarization</h2>{["Selected Document ID", "Notarial Reference Number", "Date of Notarization", "Notary Public Signature Code"].map((f) => <label key={f}>{f}<input placeholder={f === "Selected Document ID" ? "#DOC-2024-881" : f} /></label>)}<button>Submit for Verification</button></aside></div></section>;
}

function HistoryPage() {
  return <section className="page"><PageTitle title="Legal Action History" subtitle="Audit Log & Activity" action="Download Report" /><FilterBar labels={["All Entities", "Date Range", "Any Status"]} /><div className="two-col"><Panel title="Audit Log & Activity">{["Approved #USJR-2023-0842", "Notarized Entry #NX-9921", "Rejected #UK-LTD-4401"].map((x, i) => <div className={`timeline-item ${i === 2 ? "danger" : ""}`} key={x}><b>{x}</b><p>Review event completed and recorded in the immutable activity stream.</p><small>OCT {25 - i}, 10:30 AM</small></div>)}</Panel><Panel title="Expiring Soon"><div className="notice danger"><b>Strategic Alliances Ltd.</b><p>Expires in 3 days · #CERT-998-AX</p><button className="primary">Flag for Renewal</button></div><div className="notice warn"><b>Cloud Systems Inc.</b><p>Expires in 12 days · #CERT-204-VY</p></div></Panel></div></section>;
}

function Monitoring() {
  return <section className="page"><PageTitle title="Workflow Status Monitor" subtitle="Live pipeline" /><Panel title="Workflow Status Monitor"><div className="pipeline"><span>Submitted<b>142 Cases</b></span><span>Logged<b>89 Cases</b></span><span>Review<b>34 Pending</b></span><span>Notarization<b>Queue: 12</b></span></div><div className="mini-grid"><span>Average Processing Velocity<b>4.2 hrs/node</b></span><span>Bottleneck Warning<b>Compliance Review Node</b></span></div></Panel><Panel title="Pending Actions Tracker"><DataTable headers={["Office / Role", "Submission ID", "Wait Time", "Category", "Priority", "Status"]} rows={[["Legal Operations - Senior Notary", "#LEX-9902-A", "18h 12m", "Corporate Restructuring", "Critical", "Awaiting Seal"], ["Compliance - Tier 2 Auditor", "#LEX-9915-C", "04h 45m", "Risk Assessment", "Standard", "Awaiting Review"], ["Institutional Oversight", "#LEX-9884-X", "02d 01h", "Board Resolution", "Critical", "Awaiting Final Sign"]]} /></Panel><section className="dark-card"><h2>System Integrity Status</h2><p>Uptime 99.998% · Security Audits Passed · Last check 14m ago</p></section></section>;
}

function UsersPage() {
  return (
    <section className="page">
      <PageTitle title="User Management" subtitle="Super Admin-only account creation, role assignment, activation, password reset, and access monitoring." action="Create User" />
      <div className="security-note"><Lock size={20} /> Public registration is disabled. Accounts are created through backend Supabase Admin integration only; the service-role key must never appear in frontend code.</div>
      <div className="two-col">
        <Panel title="Create User">
          <div className="form-grid admin-form">
            {["Full Name", "Institutional Email"].map((field) => <label key={field}>{field}<input placeholder={field} /></label>)}
            <label>Role<select><option>Department Staff</option><option>IRO Staff</option><option>IRO Admin</option><option>Legal Counsel</option><option>Super Admin</option></select></label>
            <label>Office<select>{departments.map(([code, name]) => <option key={code}>{name}</option>)}</select></label>
            <label>Department<select>{departments.map(([code, name]) => <option key={code}>{code} - {name}</option>)}</select></label>
            <label>Temporary Password<input value="conexia123" readOnly /></label>
          </div>
          <div className="action-strip">
            <button className="primary"><UserPlus size={18} /> Create Supabase User</button>
            <span>Creates auth account, profile, role, office/department assignment, and audit record.</span>
          </div>
        </Panel>
        <Panel title="Account Actions">
          {["Edit User", "Activate User", "Deactivate User", "Reset Password", "Change Role", "Change Office", "Change Department"].map((action) => (
            <button className="management-action" key={action}><Settings size={18} /> {action}</button>
          ))}
        </Panel>
      </div>
      <Panel title="Development Seed Accounts">
        <DataTable headers={["Full Name", "Email", "Role", "Office", "Department", "Status", "Last Login"]} rows={seededUsers} />
      </Panel>
      <Panel title="Official Schools & Programs">
        <DataTable headers={["Department Code", "Office / Department Name"]} rows={departments} />
      </Panel>
    </section>
  );
}

function AuditLogs() {
  return <section className="page"><PageTitle title="Audit Logs" subtitle="Comprehensive chronological history of system-wide administrative actions." action="Refresh Logs" /><FilterBar labels={["All Users", "Global HQ", "All Modules", "All Actions", "11/01/2023 to 11/20/2023"]} /><Panel title="1,248 Total Entries · 12 Anomalies Flagged"><DataTable headers={["Timestamp", "Principal Agent", "Office Context", "Module", "Action", "Target Entity", "Verification"]} rows={[["2023-11-20 14:22:01.442", "Admin_Alpha", "Global HQ", "Security/Auth", "Delete", "USR_TOKEN_44921", "Verified"], ["2023-11-20 14:15:48.001", "Gov_Bravo", "London Office", "Asset Management", "Update", "ASSET_ID_9901", "Verified"], ["2023-11-20 13:12:05.671", "Unauthenticated_Proxy", "Unknown Node", "Core Kernel", "Purge", "CRITICAL_V_SYS_ROOT", "Flagged"]]} /></Panel></section>;
}

function FilterBar({ labels }) {
  return <div className="filter-bar"><Filter size={20} />{labels.map((x, i) => <button className={i === 0 ? "active-filter" : ""} key={x}>{x}<ChevronDown size={16} /></button>)}</div>;
}

function DarkCallout() {
  return <section className="dark-card"><Info size={42} /><div><span>Critical Delinquency Alert</span><h2>14 Days Awaiting Review: MOA - Global Tech</h2><p>This document has exceeded the standard 48-hour internal SLA.</p></div><button>Open Document <ChevronRight /></button></section>;
}

function SystemCharts() {
  return <div className="two-col"><Panel title="Departmental Engagement Flux"><div className="bars">{[45, 32, 72, 61, 46, 78, 28].map((h, i) => <span style={{ height: h + "%" }} key={i} />)}</div></Panel><Panel title="System Resource Allocation">{["Compute Nodes 64%", "Storage Tier 1 88%", "API Traffic 22%", "Network Latency Optimal"].map((x, i) => <div className="bar-row" key={x}><span>{x}</span><i style={{ width: [64, 88, 22, 15][i] + "%" }} /></div>)}</Panel></div>;
}

createRoot(document.getElementById("root")).render(<App />);
