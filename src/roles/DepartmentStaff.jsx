import React, { useEffect, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import {
  DashboardView,
  Dropzone,
  ExpiryView,
  FilterBar,
  NotificationsView,
} from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";

import {
  getDepartmentDocuments,
  submitDocument,
} from "../services/documentService";

export function DepartmentStaff({ page, account }) {
  if (page === "submission") {
    return <SubmissionPage account={account} />;
  }

  if (page === "submissions") {
    return <MySubmissionsPage account={account} />;
  }

  if (page === "engagements") {
    return <EngagementsPage />;
  }

  if (page === "expiry") {
    return <ExpiryView action="Manual Update" />;
  }

  if (page === "notifications") {
    return <NotificationsView />;
  }

  return <DepartmentDashboard account={account} />;
}

function DepartmentDashboard({ account }) {
  const navigate = useNavigate();

  return (
    <DashboardView
      roleKey="department"
      title="Institutional Workspace"
      subtitle={`Welcome back, ${
        account?.fullName || "Department Staff"
      }. Here is the real-time status for ${
        account?.office || "your department"
      }.`}
      action="New Submission"
      onAction={() => navigate("/app/submission")}
    />
  );
}

function SubmissionPage({ account }) {
  const navigate = useNavigate();

  const [partnerInstitution, setPartnerInstitution] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [documentType, setDocumentType] = useState("MOA");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const normalizedPartner = partnerInstitution.trim();
    const normalizedEmail = partnerEmail.trim();

    if (!normalizedPartner) {
      setMessage("Please enter the partner institution.");
      return;
    }

    if (!account?.id) {
      setMessage(
        "Authenticated user ID is missing. Please log in again."
      );
      return;
    }

    if (!account?.departmentId) {
      setMessage(
        "This Department Staff account has no assigned department."
      );
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const trackingNumber = `CONEXIA-${Date.now()}`;

      const createdDocument = await submitDocument({
        tracking_number: trackingNumber,
        title: `${normalizedPartner} ${documentType}`,
        document_type: documentType,
        partner_institution: normalizedPartner,
        partner_email: normalizedEmail || null,
        description: `${documentType} submitted by ${
          account.office || account.fullName || "Department Staff"
        }.`,
        department_id: account.departmentId,
        submitted_by: account.id,
      });

      setMessage(
        `${
          createdDocument.tracking_number || trackingNumber
        } was submitted to IRO Staff.`
      );

      setPartnerInstitution("");
      setPartnerEmail("");

      window.setTimeout(() => {
        navigate("/app/submissions");
      }, 700);
    } catch (error) {
      console.error("Document submission failed:", error);

      setMessage(
        error?.message || "Unable to submit the document."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page department-page">
      <PageTitle
        title="Submit New Document"
        subtitle={`Initiate a formal review process from ${
          account?.office || "your department"
        }.`}
      />

      <div className="two-col">
        <div>
          <div className="steps">
            <span className="on">
              1<b>Partner Info</b>
            </span>

            <span>
              2<b>Upload</b>
            </span>

            <span>
              3<b>Confirmation</b>
            </span>
          </div>

          <DepartmentForm
            documentType={documentType}
            onDocumentTypeChange={setDocumentType}
            onPartnerChange={setPartnerInstitution}
            onPartnerEmailChange={setPartnerEmail}
            partnerInstitution={partnerInstitution}
            partnerEmail={partnerEmail}
          />

          <Panel title="Document Upload Section">
            <Dropzone
              label="Drag and drop agreement draft here"
              detail="PDF, DOCX, ODT - MAX 25MB"
            />

            <div className="file-row">
              <FileText />
              University_MOA_Draft_v1.2.pdf
              <small>1.4 MB - READY TO SCAN</small>
            </div>
          </Panel>
        </div>

        <aside className="summary-card">
          <h2>Review Summary</h2>

          <p>
            Intended Partner: {partnerInstitution || "---"}
          </p>

          <p>
            Agreement Class: <b>{documentType}</b>
          </p>

          <p>
            Processing Office:{" "}
            <b>{account?.office || "No assigned office"}</b>
          </p>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? "Submitting..."
              : "Submit for Review"}

            <UploadCloud size={18} />
          </button>

          <button
            className="outline"
            type="button"
            disabled={submitting}
          >
            Save as Draft
          </button>

          {message && (
            <p className="workflow-message">
              {message}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function DepartmentForm({
  documentType,
  onDocumentTypeChange,
  onPartnerChange,
  onPartnerEmailChange,
  partnerInstitution,
  partnerEmail,
}) {
  return (
    <Panel title="Partner Institution Details">
      <div className="form-grid">
        <label>
          Partner Institution Name

          <input
            type="text"
            value={partnerInstitution}
            placeholder="e.g. Global Tech University"
            onChange={(event) =>
              onPartnerChange(event.target.value)
            }
            required
          />
        </label>

        <label>
          Agreement Type

          <select
            value={documentType}
            onChange={(event) =>
              onDocumentTypeChange(event.target.value)
            }
          >
            <option value="MOA">
              Memorandum of Agreement (MOA)
            </option>

            <option value="MOU">
              Memorandum of Understanding (MOU)
            </option>

            <option value="MOF">
              Memorandum of Funding (MOF)
            </option>
          </select>
        </label>

        <label>
          Expected Duration

          <select defaultValue="5 Years (Standard)">
            <option value="5 Years (Standard)">
              5 Years (Standard)
            </option>
            <option value="3 Years">3 Years</option>
            <option value="1 Year">1 Year</option>
          </select>
        </label>

        <label>
          Partner Contact Email

          <input
            type="email"
            value={partnerEmail}
            placeholder="contact@partner.edu"
            onChange={(event) =>
              onPartnerEmailChange(event.target.value)
            }
          />
        </label>
      </div>
    </Panel>
  );
}

function MySubmissionsPage({ account }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (account?.departmentId) {
      loadSubmissions();
    } else {
      setLoading(false);
      setErrorMessage(
        "This account has no assigned department."
      );
    }
  }, [account?.departmentId]);

  async function loadSubmissions() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getDepartmentDocuments(
        account.departmentId
      );

      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        "Unable to load department submissions:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to load your submissions."
      );
    } finally {
      setLoading(false);
    }
  }

  const rows = documents.map((document) => [
    document.tracking_number || "N/A",
    document.partner_institution || "N/A",
    document.document_type || "N/A",
    document.status || "Unknown",
  ]);

  const activeCount = documents.filter((document) =>
    [
      "Submitted",
      "Logged",
      "Under Legal Review",
    ].includes(document.status)
  ).length;

  const pendingCount = documents.filter(
    (document) =>
      document.status === "Pending Notarization"
  ).length;

  const actionCount = documents.filter(
    (document) =>
      document.status === "Corrections Needed"
  ).length;

  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle
          title="My Submissions"
          subtitle="Real-time tracking of institutional documents and partner agreements."
        />

        <StatGrid
          stats={[
            [
              String(activeCount),
              "Currently in Review",
              FileText,
              "Active",
            ],
            [
              String(pendingCount),
              "Awaiting Signature",
              FileText,
              "Pending",
              "warn",
            ],
            [
              String(actionCount),
              "Requires Resubmission",
              FileText,
              "Action",
              "danger",
            ],
          ]}
        />

        <Panel title="Submission Records">
          {loading && <p>Loading submissions...</p>}

          {!loading && errorMessage && (
            <p className="error-message">
              {errorMessage}
            </p>
          )}

          {!loading &&
            !errorMessage &&
            rows.length === 0 && (
              <p>No submissions found.</p>
            )}

          {!loading &&
            !errorMessage &&
            rows.length > 0 && (
              <DataTable
                headers={[
                  "Tracking #",
                  "Partner",
                  "Type",
                  "Status",
                ]}
                rows={rows}
              />
            )}
        </Panel>
      </div>

      <aside className="detail-drawer">
        <h2>Submission Details</h2>

        <p>
          Select a submission to view its legal comments and
          version history.
        </p>
      </aside>
    </section>
  );
}

function EngagementsPage() {
  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle
          title="Engagements Management"
          subtitle="Oversee institutional partnerships and document compliance for your office."
          action="Create Engagement"
        />

        <FilterBar
          labels={[
            "All Institutions",
            "All",
            "Active",
            "Pending",
            "Expiring",
          ]}
        />

        <Panel title="Partner Engagements">
          <DataTable
            headers={[
              "Partner Organization",
              "Agreement",
              "Duration",
              "Documents",
              "Status",
            ]}
            rows={[
              [
                "De La Salle University",
                "MOA - Faculty Exchange",
                "Jan 2024 - Jan 2029",
                "12/12 Verified",
                "Active",
              ],
              [
                "UP Manila",
                "MOU - Research Grant",
                "Legal Review",
                "4/8 Pending",
                "Pending",
              ],
              [
                "Ateneo de Cebu",
                "MOA - Internship Program",
                "Expires in 14 Days",
                "Renew Agreement",
                "Expiring",
              ],
              [
                "St. Theresa College",
                "Student Exchange",
                "Ended Dec 2023",
                "Archived",
                "Completed",
              ],
            ]}
          />
        </Panel>
      </div>

      <aside className="detail-drawer">
        <h2>Engagement Details</h2>

        <div className="mini-grid">
          <span>
            Start Date
            <b>Jan 12, 2024</b>
          </span>

          <span>
            Expiration
            <b>Jan 11, 2029</b>
          </span>
        </div>

        <h3>Submission Compliance</h3>

        <div className="notice">
          <b>Notarized MOA</b>
          <p>Verified</p>
        </div>

        <div className="notice">
          <b>Institutional Profile</b>
          <p>Verified</p>
        </div>

        <div className="notice warn">
          <b>Financial Audit</b>
          <p>Pending</p>
        </div>

        <button
          className="primary wide-inline"
          type="button"
        >
          Renew Agreement
        </button>
      </aside>
    </section>
  );
}

export default DepartmentStaff;