import React from "react";
import { LogReviewHeader } from "./LogReviewHeader";
import { DashboardStats } from "./DashboardStats";
import DocumentPreview from "./DocumentPreview";
import Checklist from "./Checklist";
import RouteDropdown from "./RouteDropdown";
import StaffRemarks from "./StaffRemarks";
import ReviewActions from "./ReviewActions";

export function LogReviewPage() {
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
