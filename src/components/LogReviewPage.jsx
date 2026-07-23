import React from "react";
import { useLocation } from "react-router-dom";
import { LogReviewHeader } from "./LogReviewHeader";
import { DashboardStats } from "./DashboardStats";
import DocumentPreview from "./DocumentPreview";
import Checklist from "./Checklist";
import RouteDropdown from "./RouteDropdown";
import StaffRemarks from "./StaffRemarks";
import ReviewActions from "./ReviewActions";

export function LogReviewPage() {
  const location = useLocation();
  const filterStatus = location?.state?.filterStatus || null;
  const checklistItems = [
    "Signatures Present",
    "Terms Defined",
    "Attachments Included",
    "GDPR Compliance",
  ];

  return (
    <section className="page iro-staff-page log-review-page">
      <LogReviewHeader />

      <DashboardStats />

      {filterStatus === 'awaiting' && (
        <div className="notice" style={{ marginTop: 12 }}>
          <b>Showing:</b> Submissions awaiting completeness check are highlighted for review.
        </div>
      )}

      <div className="two-col">
        <div>
          <DocumentPreview />
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

          <ReviewActions />
        </aside>
      </div>
    </section>
  );
}

export default LogReviewPage;
