import React from "react";
import { Filter } from "lucide-react";

export function LogReviewHeader({ staffOnly = false }) {
  return (
    <header className="incoming-header log-review-header">
      <div className="title-block">
        <h1>{staffOnly ? "LOG SUBMISSION" : "LOG & REVIEW FORM"}</h1>
        <p className="subtitle">
          {staffOnly
            ? "Register the incoming agreement using its submission details. Document contents remain restricted."
            : "Register institutional agreements and perform initial administrative reviews. Ensure all mandatory data fields are populated before routing to relevant departments."}
        </p>
      </div>

      <div className="header-actions">
        <button className="outline">
          <Filter size={16} /> Advanced Filters
        </button>
      </div>
    </header>
  );
}

export default LogReviewHeader;
