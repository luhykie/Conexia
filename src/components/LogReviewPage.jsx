import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import {
  getDocumentById,
  getReviewForm,
  getIroStaffDashboard,
  logDocument,
  saveReviewForm,
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
    { key: "gdpr", label: "GDPR Compliance" },
  ];
  const [checklist, setChecklist] = useState({
    signatures: false,
    terms: false,
    attachments: false,
    gdpr: false,
  });
  const [staffRemarks, setStaffRemarks] = useState("");
  const [reviewFormStatus, setReviewFormStatus] = useState("draft");

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
  const showReviewForm = !isStaff || canEditReviewForm;
  const reviewFormLocked = ["submitted", "validated"].includes(reviewFormStatus)
    || (isStaff && !canEditReviewForm);
  const staffStage = document?.status === "Review Form Sent Back"
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

        {showReviewForm && <aside className="review-sidebar dark-card admin-review">
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
        </aside>}
      </div>
    </section>
  );
}

export default LogReviewPage;
