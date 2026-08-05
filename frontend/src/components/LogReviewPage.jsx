import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import {
  getDocumentById,
  getReviewForm,
  getIroStaffDashboard,
  checkRevision,
  logDocument,
  saveReviewForm,
  saveRevisionForwardingDraft,
  sendRevisionToDepartment,
  submitReviewForm,
} from "../services/documentService";

import { LogReviewHeader } from "./LogReviewHeader";
import { DashboardStats } from "./DashboardStats";
import DocumentPreview from "./DocumentPreview";
import Checklist from "./Checklist";
import StaffRemarks from "./StaffRemarks";
import ReviewActions from "./ReviewActions";

export function LogReviewPage({ account }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [document, setDocument] = useState(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const documentId =
    searchParams.get("document") || location.state?.documentId;
  const filterStatus = location.state?.filterStatus || null;
  const isStaff = account?.roleKey === "staff";

  const checklistItems = [
    { key: "signatures", label: "Signatures Present" },
    { key: "terms", label: "Terms Defined" },
    { key: "attachments", label: "Attachments Included" },
    { key: "gdpr", label: "Data Privacy Compliance" },
  ];
  const [checklist, setChecklist] = useState({
    signatures: false,
    terms: false,
    attachments: false,
    gdpr: false,
  });
  const [staffRemarks, setStaffRemarks] = useState("");
  const [reviewFormStatus, setReviewFormStatus] = useState("draft");
  const [forwardingNote, setForwardingNote] = useState("");

  const [stats, setStats] = useState({
    incoming: 0,
    loggedToday: 0,
    awaitingCheck: 0,
    routedToLegal: 0,
  });

  useEffect(() => {
    loadDashboardStats();
    if (documentId) {
      loadDocument();
    } else {
      setDocument(null);
      setLoadingDocument(false);
    }
  }, [documentId]);

  async function loadDashboardStats() {
    try {
      const dashboard = await getIroStaffDashboard();
      setStats((current) => ({
        ...current,
        ...(dashboard?.stats || {}),
      }));
    } catch (error) {
      console.error("Unable to load workflow statistics:", error);
    }
  }

  async function loadDocument() {
    setLoadingDocument(true);
    setStatusMessage("");
    try {
      const data = await getDocumentById(documentId);
      setDocument(data);
      setForwardingNote(data.staff_forwarding_note || "");

      const form = data.review_form || await getReviewForm(documentId);
      if (form) {
        setChecklist((current) => ({
          ...current,
          ...(form.checklist_answers || {}),
        }));
        setStaffRemarks(form.staff_remarks || "");
        setReviewFormStatus(form.review_form_status || "draft");
        if (form.sent_back_reason) {
          setStatusMessage(`Sent back by IRO Admin: ${form.sent_back_reason}`);
        }
      }
    } catch (error) {
      console.error("Unable to load selected document:", error);
      setStatusMessage("Unable to load the selected document.");
    } finally {
      setLoadingDocument(false);
    }
  }

  async function handleLogSubmission() {
    if (!documentId) {
      setStatusMessage("Select an incoming submission before logging it.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Logging submission...");
    try {
      await logDocument(documentId);
      setStatusMessage("Submission logged. Complete the Review Form to route it to IRO Admin.");
      await loadDashboardStats();
      await loadDocument();
    } catch (error) {
      setStatusMessage(error?.message || "Unable to log the submission.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForwardingDraft() {
    setIsSubmitting(true);
    setStatusMessage("");
    try {
      await saveRevisionForwardingDraft(documentId, forwardingNote);
      setStatusMessage("Forwarding note saved as draft.");
    } catch (error) {
      setStatusMessage(error.message || "Unable to save the forwarding note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendRevisionToDepartment() {
    setIsSubmitting(true);
    setStatusMessage("");
    try {
      await sendRevisionToDepartment(documentId, forwardingNote);
      setStatusMessage("Revision request sent to the designated department.");
      await loadDocument();
    } catch (error) {
      setStatusMessage(error.message || "Unable to send the revision request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitRevisionToAdmin() {
    setIsSubmitting(true);
    setStatusMessage("");
    try {
      await checkRevision(documentId);
      setStatusMessage("Revised document submitted to IRO Admin for validation.");
      await loadDashboardStats();
      await loadDocument();
    } catch (error) {
      setStatusMessage(error.message || "Unable to submit the revised document to IRO Admin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCardClick(label) {
    switch (label) {
      case "Unlogged":
        navigate("/app/incoming");
        break;

      case "Logged Today":
        navigate(
          account?.roleKey === "admin"
            ? "/app/manage-submissions"
            : "/app/log-review"
        );
        break;

      case "Awaiting Check":
        if (account?.roleKey === "admin") {
          navigate("/app/manage-submissions");
        } else {
          navigate("/app/log-review", {
            state: { filterStatus: "awaiting" },
          });
        }
        break;

      case "Routed to Legal":
        navigate(
          account?.roleKey === "admin"
            ? "/app/manage-submissions"
            : "/app/status",
          account?.roleKey === "admin"
            ? undefined
            : { state: { filterStatus: "routed" } }
        );
        break;

      default:
        break;
    }
  }

  function toggleChecklist(key) {
    setChecklist((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function handleSaveDraft() {
    if (!documentId) {
      setStatusMessage(
        "Open an incoming submission before saving the review form."
      );
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Saving Review Form draft...");
    try {
      const form = await saveReviewForm(documentId, {
        staff_remarks: staffRemarks,
      });
      setReviewFormStatus(form.review_form_status);
      setStatusMessage("Review Form draft saved.");
    } catch (error) {
      setStatusMessage(error.message || "Unable to save the Review Form.");
    } finally {
      setIsSubmitting(false);
    }
  }

async function handleSubmitToAdmin() {
  if (!documentId) {
    setStatusMessage(
      "No document is selected. Return to Incoming Submissions and click Start Logging."
    );
    return;
  }

  if (!account?.id) {
    setStatusMessage(
      "Your authenticated account ID is missing. Please log out and sign in again."
    );
    return;
  }

  setIsSubmitting(true);
  setStatusMessage("Submitting Review Form for validation...");

  try {
    const form = await submitReviewForm(documentId, {
      staff_remarks: staffRemarks,
    });
    setReviewFormStatus(form.review_form_status);

    setStatusMessage("Review Form successfully submitted for validation.");

    setTimeout(() => {
      navigate(
        account?.roleKey === "admin"
          ? "/app/manage-submissions"
          : "/app/status"
      );
    }, 1200);
  } catch (error) {
    console.error("Review Form submission failed:", error);

    setStatusMessage(
      error?.message ||
        "Supabase prevented the document update."
    );
  } finally {
    setIsSubmitting(false);
  }
}

  const isSubmittedDocument = document?.status === "Submitted";
  const canEditReviewForm = isStaff && [
    "Logged",
    "Review Form Sent Back",
  ].includes(document?.status);
  const isRevisionForwarding = isStaff && (
    document?.status === "Assigned for Revision Handling" ||
    (
      document?.status === "Review Form Sent Back" &&
      document?.review_form?.review_form_status === "validated" &&
      Boolean(document?.legal_notes)
    )
  );
  const isResubmittedRevision = isStaff && document?.status === "Revised and Resubmitted";
  const showReviewForm = !isStaff || canEditReviewForm || isRevisionForwarding || isResubmittedRevision;
  const reviewFormLocked = ["submitted", "validated"].includes(reviewFormStatus)
    || (isStaff && !canEditReviewForm);
  const staffStage = isResubmittedRevision
    ? "review-revision"
    : isRevisionForwarding
    ? "forward-revision"
    : document?.status === "Review Form Sent Back"
    ? "revise"
    : canEditReviewForm
      ? "review"
      : "log";

  return (
    <section className="page iro-staff-page log-review-page">
      <LogReviewHeader staffOnly={isStaff} stage={staffStage} />

      <DashboardStats
        stats={stats}
        onCardClick={handleCardClick}
      />

      {filterStatus === "awaiting" && (
        <div
          className="notice"
          style={{ marginTop: 12 }}
        >
          <b>Showing:</b> Submissions awaiting completeness
          check are highlighted for review.
        </div>
      )}

      <div className={showReviewForm ? "two-col" : "log-submission-layout"}>
        <div>
          {!documentId ? (
            <section className="panel document-selection-state">
              <h2>Select a submission</h2>
              <p>
                Open Incoming Submissions and choose a document to begin
                logging or continue its review form.
              </p>
              <button
                className="primary"
                type="button"
                onClick={() => navigate("/app/incoming")}
              >
                View Incoming Submissions
              </button>
            </section>
          ) : loadingDocument ? (
            <section className="panel document-selection-state" aria-live="polite">
              <p>Loading the selected submission...</p>
            </section>
          ) : document ? (
            <DocumentPreview
              document={document}
              canViewContent={!isStaff}
            />
          ) : (
            <section className="panel document-selection-state error">
              <h2>Document unavailable</h2>
              <p>{statusMessage || "The selected submission could not be loaded."}</p>
              <button
                className="outline"
                type="button"
                onClick={() => navigate("/app/incoming")}
              >
                Return to Incoming Submissions
              </button>
            </section>
          )}

          {isStaff && document && isSubmittedDocument && (
            <div className="panel log-submission-actions">
              <button
                className="btn primary large"
                type="button"
                disabled={isSubmitting}
                onClick={handleLogSubmission}
              >
                {isSubmitting ? "Logging..." : "Log Submission"}
              </button>
              {statusMessage && <p className="review-status">{statusMessage}</p>}
            </div>
          )}
        </div>

        {showReviewForm && (isResubmittedRevision ? (
          <aside className="review-sidebar admin-review revision-forward-panel">
            <header className="admin-review-intro"><h2>Revision Completeness Check</h2><p>Status: <strong>Revised and Resubmitted</strong></p></header>
            <div className="card-block">
              <p>The department uploaded a new document version. Confirm the revision record is ready for IRO Admin validation.</p>
              <label>Tracking Number<input value={document.tracking_number || "Not available"} readOnly /></label>
              <label>Designated Department<input value={document.department?.name || document.departments?.name || "Department unavailable"} readOnly /></label>
              <label>Legal Counsel Comments<textarea value={document.legal_notes || "No comments provided."} readOnly /></label>
            </div>
            <button className="btn primary large" type="button" disabled={isSubmitting} onClick={handleSubmitRevisionToAdmin}>{isSubmitting ? "Submitting..." : "Submit Revised Document to IRO Admin"}</button>
            {statusMessage && <p className="review-status">{statusMessage}</p>}
          </aside>
        ) : isRevisionForwarding ? (
          <aside className="review-sidebar admin-review revision-forward-panel">
            <header className="admin-review-intro"><h2>Revision Request</h2><p>Status: <strong>Assigned for Revision Handling</strong></p></header>
            <div className="card-block">
              <label>Designated Department<input value={document.department?.name || document.departments?.name || "Department unavailable"} readOnly /></label>
              <label>Legal Counsel Comments<textarea value={document.legal_notes || "No comments provided."} readOnly /></label>
              <label>IRO Admin Instructions<textarea value={document.admin_revision_instructions || "No additional instructions provided."} readOnly /></label>
              <label>Staff Forwarding Note<textarea value={forwardingNote} disabled={isSubmitting} onChange={(event) => setForwardingNote(event.target.value)} placeholder="Add a message for the department..." /></label>
            </div>
            <div className="revision-forward-actions">
              <button className="btn outline" type="button" disabled={isSubmitting} onClick={handleForwardingDraft}>Save Draft</button>
              <button className="btn primary" type="button" disabled={isSubmitting} onClick={handleSendRevisionToDepartment}>{isSubmitting ? "Sending..." : "Send to Department"}</button>
            </div>
            {statusMessage && <p className="review-status">{statusMessage}</p>}
          </aside>
        ) : <aside className="review-sidebar dark-card admin-review">
          <h2>{isStaff ? "Review Form" : "IRO Review Form"}</h2>
          <p className="review-form-status">
            Status: {reviewFormStatus.replaceAll("_", " ")}
          </p>

          {!isStaff && <div className="card-block">
            <h3>Completeness Check</h3>
            <Checklist
              items={checklistItems}
              values={checklist}
              onChange={toggleChecklist}
              disabled={isSubmitting || reviewFormLocked}
            />
          </div>}

          <div className="card-block">
            <h3>Staff Remarks</h3>
            <StaffRemarks
              value={staffRemarks}
              onChange={setStaffRemarks}
              disabled={isSubmitting || reviewFormLocked}
            />
          </div>

          <ReviewActions
            disabled={isSubmitting || reviewFormLocked}
            submitting={isSubmitting}
            onSaveDraft={handleSaveDraft}
            onSubmit={handleSubmitToAdmin}
            submitLabel={isStaff ? "Submit to IRO Admin" : "Submit for Validation"}
          />

          {statusMessage && (
            <p className="review-status">
              {statusMessage}
            </p>
          )}
        </aside>)}
      </div>
    </section>
  );
}

export default LogReviewPage;
