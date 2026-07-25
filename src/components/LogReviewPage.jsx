import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  getDocumentById,
  logDocument,
} from "../services/documentService";

import { LogReviewHeader } from "./LogReviewHeader";
import { DashboardStats } from "./DashboardStats";
import DocumentPreview from "./DocumentPreview";
import Checklist from "./Checklist";
import RouteDropdown from "./RouteDropdown";
import StaffRemarks from "./StaffRemarks";
import ReviewActions from "./ReviewActions";

export function LogReviewPage({ account }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const documentId = location.state?.documentId;
  const filterStatus = location.state?.filterStatus || null;

  const checklistItems = [
    "Signatures Present",
    "Terms Defined",
    "Attachments Included",
    "GDPR Compliance",
  ];

  const stats = {
    incoming: 12,
    loggedToday: 9,
    awaitingCheck: 3,
    routedToLegal: 24,
  };

  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
  }, [documentId]);

  async function loadDocument() {
    try {
      const data = await getDocumentById(documentId);
      setDocument(data);
    } catch (error) {
      console.error("Unable to load selected document:", error);
      setStatusMessage("Unable to load the selected document.");
    }
  }

  function handleCardClick(label) {
    switch (label) {
      case "Unlogged":
        navigate("/app/incoming");
        break;

      case "Logged Today":
        navigate("/app/log-review");
        break;

      case "Awaiting Check":
        navigate("/app/log-review", {
          state: { filterStatus: "awaiting" },
        });
        break;

      case "Routed to Legal":
        navigate("/app/status", {
          state: { filterStatus: "routed" },
        });
        break;

      default:
        break;
    }
  }

  function handleSaveDraft() {
    if (!documentId) {
      setStatusMessage(
        "Open an incoming submission before saving the review form."
      );
      return;
    }

    setStatusMessage("Review draft kept on this screen.");
  }

async function handleSubmitToAdmin() {
  console.log("Submit to IRO Admin clicked");
  console.log("Document ID:", documentId);
  console.log("IRO Staff account:", account);

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
  setStatusMessage("Submitting document to IRO Admin...");

  try {
    const loggedDocument = await logDocument(
      documentId,
      account.id
    );

    console.log("Updated document:", loggedDocument);

    setDocument(loggedDocument);

    setStatusMessage(
      "Document successfully submitted to IRO Admin for validation."
    );

    setTimeout(() => {
      navigate("/app/status");
    }, 1200);
  } catch (error) {
    console.error(
      "Submit to IRO Admin failed:",
      error
    );

    setStatusMessage(
      error?.message ||
        "Supabase prevented the document update."
    );
  } finally {
    setIsSubmitting(false);
  }
}

  return (
    <section className="page iro-staff-page log-review-page">
      <LogReviewHeader />

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

      <div className="two-col">
        <div>
          <DocumentPreview document={document} />
        </div>

        <aside className="review-sidebar dark-card admin-review">
          <h2>Administrative Review</h2>

          <div className="card-block">
            <h3>Completeness Check</h3>
            <Checklist items={checklistItems} />
          </div>

          <div className="card-block">
            <h3>Route To</h3>
            <RouteDropdown />
          </div>

          <div className="card-block">
            <h3>Staff Remarks</h3>
            <StaffRemarks />
          </div>

          <ReviewActions
            disabled={isSubmitting}
            submitting={isSubmitting}
            onSaveDraft={handleSaveDraft}
            onSubmit={handleSubmitToAdmin}
          />

          {statusMessage && (
            <p className="review-status">
              {statusMessage}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

export default LogReviewPage;