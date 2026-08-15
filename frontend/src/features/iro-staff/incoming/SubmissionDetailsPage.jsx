import React from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  getIroDocument,
  returnDocumentForCorrection,
  submitDocumentToIroAdmin,
} from "../../../services/iroStaffService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function SubmissionDetailsPage({ documentId }) {
  const navigate = useNavigate();
  const [document, setDocument] = React.useState(null);
  const [remarks, setRemarks] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [showReturnConfirmation, setShowReturnConfirmation] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;

    async function loadDocument() {
      setLoading(true);
      setError("");

      try {
        const response = await getIroDocument(documentId);
        if (active) setDocument(response.document ?? response.data ?? null);
      } catch (requestError) {
        reportClientError("Unable to load submission details:", requestError);
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDocument();
    return () => { active = false; };
  }, [documentId]);

  async function submitToAdmin(event) {
    event.preventDefault();
    if (!document || document.status !== "Submitted" || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await submitDocumentToIroAdmin(
        document.id,
        remarks.trim(),
      );
      navigate("/app/incoming", {
        replace: true,
        state: {
          success: "Submission forwarded to IRO Admin successfully.",
        },
      });
    } catch (requestError) {
      reportClientError("Unable to submit to IRO Admin:", requestError);
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function requestReturnForCorrection() {
    if (!document || document.status !== "Submitted" || submitting) return;

    if (!remarks.trim()) {
      setError("IRO Staff remarks are required when returning a submission for correction.");
      return;
    }

    setError("");
    setShowReturnConfirmation(true);
  }

  async function returnForCorrection() {
    if (!document || document.status !== "Submitted" || submitting) return;

    setShowReturnConfirmation(false);
    setSubmitting(true);
    setError("");

    try {
      await returnDocumentForCorrection(
        document.id,
        remarks.trim(),
      );
      navigate("/app/incoming", {
        replace: true,
        state: {
          success: "Submission returned for correction successfully.",
        },
      });
    } catch (requestError) {
      reportClientError("Unable to return submission for correction:", requestError);
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const eligible = document?.status === "Submitted";

  return (
    <section className="page iro-staff-page iro-staff-incoming-page iro-staff-submission-details-page">
      <button type="button" className="outline back-button" onClick={() => navigate("/app/incoming")}>
        <ArrowLeft size={16} /> Back to Incoming Submissions
      </button>

      <PageTitle
        title="Submission Details"
        subtitle="Review the submission before forwarding it to IRO Admin."
      />

      {loading && <p>Loading submission details...</p>}
      {error && <p className="auth-error">{error}</p>}

      {!loading && document && (
        <>
          <Panel
            title="Submitted Form"
            subtitle="Read-only information provided by the submitting user"
            className="submission-details-panel"
          >
            <div className="submission-details-sections">
              {detailSections(document).map((section) => (
                <section key={section.title} className="submission-detail-section">
                  <h3>{section.title}</h3>
                  <dl>
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        className={item.wide ? "detail-row detail-row--wide" : "detail-row"}
                      >
                        <dt>{item.label}</dt>
                        <dd className={item.status ? "detail-status" : ""}>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>

            <div className="document-restriction-notice" role="note">
              <LockKeyhole size={18} aria-hidden="true" />
              <div>
                <b>Document access restricted</b>
                <p>Uploaded documents cannot be viewed, previewed, downloaded, edited, or annotated by IRO Staff.</p>
              </div>
            </div>
          </Panel>

          <Panel
            title="IRO Staff Review"
            subtitle="Return submissions for correction or forward ready records for IRO Admin validation"
            className="submission-forwarding-panel"
          >
            <form onSubmit={submitToAdmin} className="iro-staff-forward-form">
              <label>
                <span>IRO Staff Remarks <small>Required for correction; optional when forwarding</small></span>
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  maxLength={2000}
                  rows={5}
                  disabled={!eligible || submitting}
                  placeholder="Explain required corrections or add context for IRO Admin validation."
                />
              </label>

              {eligible ? (
                <div className="forward-form-actions">
                  <button
                    type="button"
                    className="outline return-for-correction-button"
                    disabled={submitting}
                    onClick={requestReturnForCorrection}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Return for Correction
                  </button>
                  <button type="submit" className="primary submit-to-admin-button" disabled={submitting}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {submitting ? "Processing..." : "Ready & Forward to IRO Admin"}
                  </button>
                </div>
              ) : document.status === "Corrections Needed" ? (
                <div className="already-forwarded-notice returned-for-correction-notice">
                  <b>Returned for Correction.</b>
                  <p>This submission has been returned to the originating office for correction. Current status: Corrections Needed.</p>
                </div>
              ) : (
                <div className="already-forwarded-notice">
                  <b>Already forwarded</b>
                  <p>This record is no longer eligible for resubmission. Current status: {document.status}.</p>
                </div>
              )}
            </form>
          </Panel>
        </>
      )}

      {showReturnConfirmation && (
        <div
          className="iro-staff-confirmation-backdrop"
          role="presentation"
          onClick={() => !submitting && setShowReturnConfirmation(false)}
        >
          <section
            className="iro-staff-confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-correction-title"
            aria-describedby="return-correction-description"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="return-correction-title">Return for Correction?</h2>
            </header>
            <p id="return-correction-description">
              This submission will be returned to the originating office with your remarks.
            </p>
            <footer>
              <button
                type="button"
                className="outline"
                disabled={submitting}
                onClick={() => setShowReturnConfirmation(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={submitting}
                onClick={returnForCorrection}
              >
                {submitting ? "Returning..." : "Return for Correction"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

function detailSections(document) {
  return [
    {
      title: "Submission Information",
      items: [
        detail("Tracking Number", document.tracking_number),
        detail("Created By", createdByName(document)),
        detail("Submitting Office", departmentName(document)),
        detail("Agreement Type", document.document_type),
        detail("Description", document.description, { wide: true }),
      ],
    },
    {
      title: "Partnership Details",
      items: [
        detail("Partner Institution", document.partner_institution),
        detail("Partnership Type", document.partnership_type ?? "-"),
        detail("Partnership Scope", document.partnership_scope ?? "-"),
        detail("Partner Email", document.partner_email),
      ],
    },
    {
      title: "Contact Information",
      items: [
        detail("Contact Person", document.contact_person),
        detail("Position", document.contact_position),
        detail("Email Address", document.contact_email),
        detail("Contact Number", document.contact_number),
      ],
    },
    {
      title: "Timeline / Status",
      items: [
        detail("Date Submitted", formatDate(document.submitted_at)),
        detail("Requested Completion", formatDate(document.requested_completion_date)),
        detail("Effective Date", formatDate(document.effective_date)),
        detail("Expiry Date", formatDate(document.expiry_date)),
        detail("Urgency", document.urgency),
        detail("Current Status", document.status, { status: true }),
      ],
    },
  ];
}

function detail(label, value, options = {}) {
  return { label, value: value || "-", ...options };
}

function createdByName(document) {
  const creator = document.created_by;
  if (!creator) return "-";

  const identity = creator.full_name || creator.email;
  const role = creator.role
    ? creator.role.split("_").map((word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
      ).join(" ")
    : "";

  return [identity, role].filter(Boolean).join(" — ") || "-";
}

function departmentName(document) {
  const department = document.department;
  if (!department) return document.department_name || "PAIR/IRO";
  return department.code && department.name
    ? `${department.code} - ${department.name}`
    : department.code || department.name || "PAIR/IRO";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}
