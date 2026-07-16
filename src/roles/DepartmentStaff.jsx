import React from "react";
import { FileText, UploadCloud } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import { DashboardView, Dropzone, ExpiryView, FilterBar, NotificationsView } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";

// Routes all Department Staff pages through one role-owned component.
export function DepartmentStaff({ page, account }) {
  if (page === "submission") return <SubmissionPage account={account} />;
  if (page === "submissions") return <MySubmissionsPage />;
  if (page === "engagements") return <EngagementsPage />;
  if (page === "expiry") return <ExpiryView action="Manual Update" />;
  if (page === "notifications") return <NotificationsView />;

  return (
    <DashboardView
      roleKey="department"
      title="Institutional Workspace"
      subtitle={`Welcome back, ${account.fullName}. Here is the real-time status for ${account.office}.`}
      action="New Submission"
    />
  );
}

// Handles the department upload workflow for new agreements.
function SubmissionPage({ account }) {
  return (
    <section className="page department-page">
      <PageTitle
        title="Submit New Document"
        subtitle={`Initiate a formal review process from ${account.office}.`}
      />
      <div className="two-col">
        <div>
          <div className="steps">
            <span className="on">1<b>Partner Info</b></span>
            <span>2<b>Upload</b></span>
            <span>3<b>Confirmation</b></span>
          </div>
          <DepartmentForm />
          <Panel title="Document Upload Section">
            <Dropzone label="Drag and drop agreement draft here" detail="PDF, DOCX, ODT - MAX 25MB" />
            <div className="file-row">
              <FileText /> University_MOA_Draft_v1.2.pdf <small>1.4 MB - READY TO SCAN</small>
            </div>
          </Panel>
        </div>
        <aside className="summary-card">
          <h2>Review Summary</h2>
          <p>Intended Partner: ---</p>
          <p>Agreement Class: <b>Memorandum of Agreement</b></p>
          <p>Processing Office: <b>Central Admin Office</b></p>
          <button>Submit for Review <UploadCloud size={18} /></button>
          <button className="outline">Save as Draft</button>
        </aside>
      </div>
    </section>
  );
}

// Collects partner metadata before the upload moves to review.
function DepartmentForm() {
  return (
    <Panel title="Partner Institution Details">
      <div className="form-grid">
        <label>Partner Institution Name<input placeholder="e.g. Global Tech University" /></label>
        <label>Agreement Type<select><option>Memorandum of Agreement (MOA)</option><option>Memorandum of Understanding (MOU)</option></select></label>
        <label>Expected Duration<select><option>5 Years (Standard)</option><option>3 Years</option><option>1 Year</option></select></label>
        <label>Partner Contact Email<input placeholder="contact@partner.edu" /></label>
      </div>
    </Panel>
  );
}

// Shows department-owned submissions and legal comments.
function MySubmissionsPage() {
  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle title="My Submissions" subtitle="Real-time tracking of institutional documents and partner agreements." />
        <StatGrid stats={[
          ["12", "Currently in Review", FileText, "Active"],
          ["04", "Awaiting Signature", FileText, "Pending", "warn"],
          ["02", "Requires Resubmission", FileText, "Action", "danger"],
        ]} />
        <Panel title="Submission Records">
          <DataTable
            headers={["Tracking #", "Partner", "Type", "Status"]}
            rows={[
              ["#USJR-2023-0842", "Metro Pacific Hospitals", "Internship MOA", "Resubmit Required"],
              ["#USJR-2023-0912", "Silliman University", "Joint Research Fund", "Pending"],
              ["#USJR-2023-1105", "PLDT Enterprise", "Tech Infrastructure MOU", "Approved"],
              ["#USJR-2023-1140", "Cebu IT Park Auth", "Land Lease Agreement", "Active"],
            ]}
          />
        </Panel>
      </div>
      <aside className="detail-drawer">
        <span className="badge danger">Resubmit Required</span>
        <h2>Metro Pacific Hospitals MOA</h2>
        <p>Legal review requested clause correction and partner notarization before second submission.</p>
        <div className="comment danger">
          <b>Atty. Marcus V.</b>
          <p>The indemnity clause in Section 4.2 is too broad. Please align with the standard university template.</p>
        </div>
        <h3>Version History</h3>
        <div className="file-row"><FileText /> V2_MOA_Draft_Final.pdf</div>
        <button className="primary wide-inline">Submit Corrected Document</button>
      </aside>
    </section>
  );
}

// Lists external partnerships visible to the department.
function EngagementsPage() {
  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle title="Engagements Management" subtitle="Oversee institutional partnerships and document compliance for your office." action="Create Engagement" />
        <FilterBar labels={["All Institutions", "All", "Active", "Pending", "Expiring"]} />
        <Panel title="Partner Engagements">
          <DataTable
            headers={["Partner Organization", "Agreement", "Duration", "Documents", "Status"]}
            rows={[
              ["De La Salle University", "MOA - Faculty Exchange", "Jan 2024 - Jan 2029", "12/12 Verified", "Active"],
              ["UP Manila", "MOU - Research Grant", "Legal Review", "4/8 Pending", "Pending"],
              ["Ateneo de Cebu", "MOA - Internship Program", "Expires in 14 Days", "Renew Agreement", "Expiring"],
              ["St. Theresa College", "Student Exchange", "Ended Dec 2023", "Archived", "Completed"],
            ]}
          />
        </Panel>
      </div>
      <aside className="detail-drawer">
        <h2>Engagement Details</h2>
        <div className="mini-grid">
          <span>Start Date<b>Jan 12, 2024</b></span>
          <span>Expiration<b>Jan 11, 2029</b></span>
        </div>
        <h3>Submission Compliance</h3>
        <div className="notice"><b>Notarized MOA</b><p>Verified</p></div>
        <div className="notice"><b>Institutional Profile</b><p>Verified</p></div>
        <div className="notice warn"><b>Financial Audit</b><p>Pending</p></div>
        <button className="primary wide-inline">Renew Agreement</button>
      </aside>
    </section>
  );
}
