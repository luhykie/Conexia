import React, { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Gavel,
  ShieldCheck,
} from "lucide-react";

import { DataTable } from "../components/DataTable";
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
  approveDocument,
  getLegalReviewQueue,
  requestCorrections,
} from "../services/documentService";

// Routes all Legal Counsel pages through one role-owned component.
export function LegalCounsel({ page, account }) {
  if (page === "notifications") {
    return <NotificationsView roleKey="legal" />;
  }
  if (page === "review") {
    return <ReviewQueue account={account} />;
  }

  if (page === "notarization") {
    return <NotarizationTracker />;
  }

  if (page === "expiry") {
    return (
      <ExpiryView
        title="Institutional Workspace"
        action="New Submission"
      />
    );
  }

  if (page === "history") {
    return <ActionHistory />;
  }

  return (
    <DashboardView
      roleKey="legal"
      title="Legal Counsel Dashboard"
      subtitle="Prioritized legal review, approval, return, and notarization workload."
      action="Open Document"
    />
  );
}

// Provides a Legal Counsel review queue using real Laravel API data.
function ReviewQueue({ account }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] =
    useState(null);

  const [remarks, setRemarks] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [account?.id]);

  async function loadDocuments() {
    if (!account?.id) {
      setLoading(false);
      setErrorMessage(
        "The logged-in Legal Counsel account ID is missing."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setMessage("");

    try {
      const data = await getLegalReviewQueue();

      const queue = Array.isArray(data) ? data : [];

      setDocuments(queue);

      setSelectedDocumentId((currentId) => {
        const currentStillExists = queue.some(
          (document) => document.id === currentId
        );

        if (currentStillExists) {
          return currentId;
        }

        return queue[0]?.id || null;
      });
    } catch (error) {
      console.error(
        "Unable to load Legal Counsel review queue:",
        error
      );

      setDocuments([]);
      setSelectedDocumentId(null);

      setErrorMessage(
        error?.message ||
          "Unable to load documents routed for legal review."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedDocument =
    documents.find(
      (document) =>
        document.id === selectedDocumentId
    ) || documents[0] || null;
  const validatedReviewForm = selectedDocument?.review_form;
  const hasValidatedReviewForm =
    validatedReviewForm?.review_form_status === "validated" &&
    Boolean(validatedReviewForm?.validated_by) &&
    Boolean(validatedReviewForm?.validated_at);

  async function handleApprove() {
    if (!selectedDocument) {
      setMessage("Select a document first.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      await approveDocument(selectedDocument.id);

      setMessage(
        `${selectedDocument.tracking_number} was approved by Legal Counsel.`
      );

      setRemarks("");
      await loadDocuments();
    } catch (error) {
      console.error("Unable to approve document:", error);

      setErrorMessage(
        error?.message ||
          "Unable to approve the selected document."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReturn() {
    if (!selectedDocument) {
      setMessage("Select a document first.");
      return;
    }

    const normalizedRemarks = remarks.trim();

    if (!normalizedRemarks) {
      setMessage(
        "Enter Legal Counsel remarks before returning the document."
      );
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      await requestCorrections(
        selectedDocument.id,
        normalizedRemarks
      );

      setMessage(
        `${selectedDocument.tracking_number} was returned for corrections.`
      );

      setRemarks("");
      await loadDocuments();
    } catch (error) {
      console.error(
        "Unable to return document for corrections:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to return the selected document."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const rows = documents.map((document) => [
    document.tracking_number || "N/A",
    document.partner_institution || "N/A",
    document.document_type || "N/A",
    document.updated_at || document.submitted_at
      ? new Date(
          document.updated_at || document.submitted_at
        ).toLocaleDateString()
      : "N/A",
    document.status || "Unknown",
  ]);

  return (
    <section className="page split-page legal-page">
      <div>
        <PageTitle
          title="Review Queue"
          subtitle="Manage documents assigned to you for legal review."
          action="Refresh Queue"
          onAction={loadDocuments}
        />

        <FilterBar labels={["All Routed", "Urgent"]} />

        <Panel title="Routed Documents">
          {loading && <p>Loading routed documents...</p>}

          {!loading && errorMessage && (
            <div className="error-message">
              <p>{errorMessage}</p>

              <button
                className="btn outline"
                type="button"
                onClick={loadDocuments}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading &&
            !errorMessage &&
            rows.length === 0 && (
              <p className="empty-state">
                No documents are currently assigned to this
                Legal Counsel account.
              </p>
            )}

          {!loading &&
            !errorMessage &&
            rows.length > 0 && (
              <DataTable
                headers={[
                  "Tracking #",
                  "Partner",
                  "Document Type",
                  "Route Date",
                  "Status",
                ]}
                rows={rows}
              />
            )}
        </Panel>
      </div>

      <aside className="review-sidebar">
        <h2>Legal Review</h2>

        {selectedDocument ? (
          <select
            value={selectedDocument.id}
            onChange={(event) => {
              setSelectedDocumentId(event.target.value);
              setRemarks("");
              setMessage("");
              setErrorMessage("");
            }}
            disabled={submitting}
          >
            {documents.map((document) => (
              <option
                value={document.id}
                key={document.id}
              >
                {document.tracking_number} -{" "}
                {document.partner_institution}
              </option>
            ))}
          </select>
        ) : (
          <p>No routed document selected.</p>
        )}

        <div className="dropzone">
          <FileText />

          <b>
            {selectedDocument?.title ||
              "No routed document"}
          </b>

          <p>
            {selectedDocument?.description ||
              "Documents routed by IRO Admin will appear here."}
          </p>

          {selectedDocument && (
            <>
              <p>
                <strong>Type:</strong>{" "}
                {selectedDocument.document_type}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {selectedDocument.status}
              </p>

              <p>
                <strong>Tracking:</strong>{" "}
                {selectedDocument.tracking_number}
              </p>
            </>
          )}
        </div>

        {selectedDocument && (
          <ValidatedReviewForm form={validatedReviewForm} />
        )}

        <label>
          Liability Assessment

          <textarea
            onChange={(event) =>
              setRemarks(event.target.value)
            }
            placeholder="Enter findings, risks, or required corrections..."
            value={remarks}
            disabled={!selectedDocument || !hasValidatedReviewForm || submitting}
          />
        </label>

        <label className="checkline">
          <input
            type="checkbox"
            disabled={!selectedDocument || !hasValidatedReviewForm || submitting}
          />
          Compliance Verified
        </label>

        <footer>
          <button
            className="outline danger"
            type="button"
            disabled={!selectedDocument || !hasValidatedReviewForm || submitting}
            onClick={handleReturn}
          >
            {submitting ? "Processing..." : "Return"}
          </button>

          <button
            type="button"
            disabled={!selectedDocument || !hasValidatedReviewForm || submitting}
            onClick={handleApprove}
          >
            {submitting ? "Processing..." : "Approve"}
          </button>
        </footer>

        {message && (
          <p className="review-status legal-message">
            {message}
          </p>
        )}

        {errorMessage && (
          <p className="error-message">
            {errorMessage}
          </p>
        )}
      </aside>
    </section>
  );
}

function ValidatedReviewForm({ form }) {
  if (
    !form ||
    form.review_form_status !== "validated"
  ) {
    return (
      <div className="card-block error-message">
        <h3>IRO Review Form unavailable</h3>
        <p>
          Legal action is blocked because a validated IRO Review Form was not
          included with this document.
        </p>
      </div>
    );
  }

  const checklist = form.checklist_answers || {};
  const items = [
    ["signatures", "Signatures Present"],
    ["terms", "Terms Defined"],
    ["attachments", "Attachments Included"],
    ["gdpr", "GDPR Compliance"],
  ];

  return (
    <div className="card-block legal-review-form">
      <h3>Validated IRO Review Form</h3>
      <p>
        Prepared by:{" "}
        <strong>
          {form.preparer?.full_name ||
            form.preparer?.email ||
            "IRO Staff"}
        </strong>
      </p>

      <div className="checklist">
        {items.map(([key, label]) => (
          <label className="checkline" key={key}>
            <input
              type="checkbox"
              checked={Boolean(checklist[key])}
              readOnly
              disabled
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="review-form-notes">
        <strong>Staff Remarks</strong>
        <p>{form.staff_remarks || "No staff remarks provided."}</p>
      </div>

      <div className="review-form-notes">
        <strong>IRO Admin Remarks</strong>
        <p>{form.admin_remarks || "No admin remarks provided."}</p>
      </div>

      <p>
        Validated by:{" "}
        <strong>
          {form.validator?.full_name ||
            form.validator?.email ||
            "IRO Admin"}
        </strong>
      </p>
      <time dateTime={form.validated_at}>
        {new Date(form.validated_at).toLocaleString()}
      </time>
    </div>
  );
}

// Records and verifies notarization events.
function NotarizationTracker() {
  return (
    <section className="page legal-page">
      <PageTitle
        title="Notarization Tracker"
        subtitle="Track pending notarization records and completed notarial entries."
      />

      <StatGrid
        stats={[
          ["42", "Total Queue", Gavel],
          [
            "18",
            "Pending Approval",
            CalendarClock,
            "",
            "blue",
          ],
          [
            "124",
            "Completed (MTD)",
            CheckCircle2,
          ],
        ]}
      />

      <div className="two-col">
        <Panel title="Document Tracking Queue">
          <DataTable
            headers={[
              "Document ID",
              "Entity / Client",
              "Status",
              "Last Activity",
              "Action",
            ]}
            rows={[
              [
                "#DOC-2024-881",
                "Sterling-Cooper Ltd.",
                "Pending Notarization",
                "2h ago",
                "Record",
              ],
              [
                "#DOC-2024-879",
                "Arasaka Corp.",
                "Notarized",
                "Yesterday",
                "View",
              ],
              [
                "#DOC-2024-875",
                "Weyland-Yutani",
                "Pending Notarization",
                "3 days ago",
                "Record",
              ],
              [
                "#DOC-2024-870",
                "Massive Dynamic",
                "Notarized",
                "1 week ago",
                "View",
              ],
            ]}
          />
        </Panel>

        <aside className="form-card">
          <h2>Record Notarization</h2>

          {[
            "Selected Document ID",
            "Notarial Reference Number",
            "Date of Notarization",
            "Notary Public Signature Code",
          ].map((field) => (
            <label key={field}>
              {field}

              <input
                placeholder={
                  field === "Selected Document ID"
                    ? "#DOC-2024-881"
                    : field
                }
              />
            </label>
          ))}

          <button type="button">
            Submit for Verification
          </button>
        </aside>
      </div>
    </section>
  );
}

// Lists the legal team's review and notarization history.
function ActionHistory() {
  return (
    <section className="page legal-page">
      <PageTitle
        title="Legal Action History"
        subtitle="Audit Log & Activity"
        action="Download Report"
      />

      <FilterBar
        labels={[
          "All Entities",
          "Date Range",
          "Any Status",
        ]}
      />

      <div className="two-col">
        <Panel title="Audit Log & Activity">
          {[
            [
              "Approved #USJR-2023-0842",
              "Review of Commercial Master Services Agreement completed successfully.",
              "Verified",
            ],
            [
              "Notarized Entry #NX-9921",
              "Digital notarial seal applied to Partnership Addendum.",
              "Recorded",
            ],
            [
              "Rejected #UK-LTD-4401",
              "Insufficient identity verification documents provided.",
              "Correction",
            ],
          ].map(([title, detail, status], index) => (
            <div
              className={`timeline-item ${
                index === 2 ? "danger" : ""
              }`}
              key={title}
            >
              <b>{title}</b>
              <p>{detail}</p>

              <span
                className={`badge ${
                  index === 2 ? "danger" : ""
                }`}
              >
                {status}
              </span>
            </div>
          ))}
        </Panel>

        <Panel title="Expiring Soon">
          <div className="notice danger">
            <b>Strategic Alliances Ltd.</b>
            <p>Expires in 3 days - #CERT-998-AX</p>

            <button
              className="primary"
              type="button"
            >
              Flag for Renewal
            </button>
          </div>

          <div className="notice warn">
            <b>Cloud Systems Inc.</b>
            <p>Expires in 12 days - #CERT-204-VY</p>

            <button
              className="outline"
              type="button"
            >
              Flag for Renewal
            </button>
          </div>

          <section className="dark-card">
            <ShieldCheck />

            <div>
              <h2>Compliance Status</h2>
              <p>
                4 agreements require notarization
                updates this month.
              </p>
            </div>
          </section>
        </Panel>
      </div>
    </section>
  );
}

export default LegalCounsel;
