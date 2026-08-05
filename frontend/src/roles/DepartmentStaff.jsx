import React, { useEffect, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import DocumentPreview from "../components/DocumentPreview";
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
  getDocumentById,
  resubmitRevision,
  submitDocument,
} from "../services/documentService";

export function DepartmentStaff({ page, account }) {
  if (page === "submission") {
    return <SubmissionPage account={account} />;
  }

  if (page === "submissions") {
    return <MySubmissionsPage account={account} />;
  }

  if (page === "revision-detail") {
    return <RevisionDetailPage account={account} />;
  }

  if (page === "engagements") {
    return <EngagementsPage />;
  }

  if (page === "expiry") {
    return <ExpiryView action="Manual Update" />;
  }

  if (page === "notifications") {
    return <NotificationsView roleKey="department" />;
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
  const [documentFile, setDocumentFile] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const normalizedPartner = partnerInstitution.trim();
    const normalizedEmail = partnerEmail.trim();

    if (!normalizedPartner) {
      setMessage("Please enter the partner institution.");
      return;
    }

    if (!documentFile) {
      setMessage("Please attach the original agreement draft.");
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
        file: documentFile,
      });

      setMessage(
        `${
          createdDocument.tracking_number || trackingNumber
        } was submitted to IRO Staff.`
      );

      setPartnerInstitution("");
      setPartnerEmail("");
      setDocumentFile(null);

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
              label={
                documentFile
                  ? documentFile.name
                  : "Choose the agreement draft"
              }
              detail="PDF, DOC, DOCX, or ODT — maximum 25 MB"
              accept=".pdf,.doc,.docx,.odt"
              disabled={submitting}
              onChange={(event) => {
                setDocumentFile(event.target.files?.[0] || null);
                setMessage("");
              }}
            />

            {documentFile && (
              <div className="file-row">
                <FileText />
                {documentFile.name}
                <small>
                  {(documentFile.size / 1024 / 1024).toFixed(2)} MB — READY TO UPLOAD
                </small>
              </div>
            )}
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedDocumentId = searchParams.get("document");
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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

  useEffect(() => {
    if (!loading && linkedDocumentId) {
      document
        .getElementById(`submission-${linkedDocumentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, linkedDocumentId]);

  async function loadSubmissions() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getDepartmentDocuments(
        account.departmentId
      );

      const records = Array.isArray(data) ? data : [];
      setDocuments(records);
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
      document.status === "Sent to Department for Revision"
  ).length;
  const displayedDocuments = documents.filter((item) => {
    if (statusFilter === "All") return true;
    if (statusFilter === "In Review") {
      return ["Submitted", "Logged", "Review Form Submitted", "Admin Validated", "Under Legal Review", "Revised and Resubmitted"].includes(item.status);
    }
    if (statusFilter === "Corrections Needed") {
      return item.status === "Sent to Department for Revision";
    }
    return item.status === statusFilter;
  });

  return (
    <section className="page department-page department-submissions-page">
      <div>
        <PageTitle
          title="My Submissions"
          subtitle="Real-time tracking of institutional documents and partner agreements."
        />

        <div className="submission-status-tabs" role="tablist" aria-label="Filter submissions by status">
          {["All", "In Review", "Corrections Needed", "Approved", "Notarized"].map((filter) => (
            <button key={filter} type="button" className={statusFilter === filter ? "active" : ""} onClick={() => setStatusFilter(filter)}>{filter}</button>
          ))}
        </div>

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
            displayedDocuments.length === 0 && (
              <p>No submissions found.</p>
            )}

          {!loading &&
            !errorMessage &&
            displayedDocuments.length > 0 && (
              <div className="submission-table-wrap">
                <table className="submission-table">
                  <thead>
                    <tr>
                      <th>Tracking #</th>
                      <th>Partner</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Revision Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedDocuments.map((document) => (
                      <tr
                        id={`submission-${document.id}`}
                        className={[
                          document.id === linkedDocumentId ? "notification-target" : "",
                          document.status === "Sent to Department for Revision" ? "revision-required-row" : "",
                        ].filter(Boolean).join(" ") || undefined}
                        key={document.id}
                      >
                        <td>{document.tracking_number || "N/A"}</td>
                        <td>{document.partner_institution || "N/A"}</td>
                        <td>{document.document_type || "N/A"}</td>
                        <td>{document.status === "Sent to Department for Revision" ? "Corrections Needed" : (document.status || "Unknown")}</td>
                        <td>
                          {document.status === "Sent to Department for Revision" ? (
                            <button type="button" className="btn primary" onClick={() => navigate(`/app/revision-detail?document=${document.id}`)}>View Revision Request</button>
                          ) : (
                            <span className="muted-text">No action required</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Panel>
      </div>

    </section>
  );
}

function RevisionDetailPage({ account }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("document");
  const [record, setRecord] = useState(null);
  const [file, setFile] = useState(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!documentId) {
      setLoading(false);
      setMessage("No revision request was selected.");
      return;
    }
    setLoading(true);
    getDocumentById(documentId)
      .then((data) => {
        setRecord(data);
        if (data.status !== "Sent to Department for Revision") {
          setMessage("This document is not currently awaiting a department revision.");
        }
      })
      .catch((error) => setMessage(error.message || "Unable to load the revision request."))
      .finally(() => setLoading(false));
  }, [documentId, account?.departmentId]);

  async function handleResubmit() {
    if (!file) {
      setMessage("Choose the corrected PDF, DOC, DOCX, or ODT file first.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await resubmitRevision(record.id, file, revisionNote);
      setMessage("The revised document was resubmitted successfully.");
      window.setTimeout(() => navigate("/app/submissions"), 1200);
    } catch (error) {
      setMessage(error.message || "Unable to resubmit the revised document.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <section className="page department-page"><p>Loading revision request...</p></section>;

  if (!record) return <section className="page department-page"><PageTitle title="Revision Request" subtitle="The selected document could not be opened." /><p className="error-message">{message}</p><button className="btn outline" type="button" onClick={() => navigate("/app/submissions")}>Back to My Submissions</button></section>;

  const canResubmit = record.status === "Sent to Department for Revision";

  return (
    <section className="page department-page revision-detail-page">
      <PageTitle title="Revision Request" subtitle="Review the document and Legal Counsel’s comments before uploading the corrected version." />
      <button className="btn outline" type="button" onClick={() => navigate("/app/submissions")}>Back to My Submissions</button>
      <div className="revision-detail-layout">
        <DocumentPreview document={record} canViewContent />
        <aside className="revision-detail-panel">
          <h2>Required Revision</h2>
          <dl>
            <div><dt>Tracking Number</dt><dd>{record.tracking_number}</dd></div>
            <div><dt>Status</dt><dd>{record.status}</dd></div>
            <div><dt>Designated Department</dt><dd>{record.department?.name || record.departments?.name || "Department unavailable"}</dd></div>
          </dl>
          <label>Legal Counsel Comments<textarea value={record.legal_notes || "No comments provided."} readOnly /></label>
          <label>IRO Staff Forwarding Note<textarea value={record.staff_forwarding_note || "No additional note provided."} readOnly /></label>
          {canResubmit && <label className="revision-file-label">Upload Revised Document<input type="file" accept=".pdf,.doc,.docx,.odt" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>}
          {canResubmit && <label>Revision Note <span className="optional-label">Optional</span><textarea value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="Summarize the corrections made..." /></label>}
          {canResubmit && <button className="btn primary large" type="button" disabled={!file || submitting} onClick={handleResubmit}>{submitting ? "Resubmitting..." : "Resubmit Revised Document"}</button>}
          {message && <p className={message.includes("successfully") ? "review-status" : "error-message"}>{message}</p>}
        </aside>
      </div>
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
