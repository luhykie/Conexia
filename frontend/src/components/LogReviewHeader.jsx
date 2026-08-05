import React from "react";

export function LogReviewHeader({ staffOnly = false, stage = "log" }) {
  const staffHeading = stage === "review"
    ? "COMPLETE REVIEW FORM"
    : stage === "review-revision"
      ? "REVIEW RESUBMITTED DOCUMENT"
    : stage === "forward-revision"
      ? "FORWARD REVISION REQUEST"
    : stage === "revise"
      ? "UPDATE REVIEW FORM"
      : "LOG SUBMISSION";
  const staffSubtitle = stage === "review"
    ? "Add administrative remarks and route the logged submission to IRO Admin. Document contents remain restricted."
    : stage === "review-revision"
      ? "Verify the revised submission record and send it to IRO Admin for validation. Document contents remain restricted."
    : stage === "forward-revision"
      ? "Review the Legal Counsel’s comments and forward the revision request to the designated department."
    : stage === "revise"
      ? "Address the IRO Admin feedback and resubmit the Review Form for validation. Document contents remain restricted."
      : "Register the incoming agreement using its submission details. Document contents remain restricted.";

  return (
    <header className="incoming-header log-review-header">
      <div className="title-block">
        <h1>{staffOnly ? staffHeading : "LOG & REVIEW FORM"}</h1>
        <p className="subtitle">
          {staffOnly
            ? staffSubtitle
            : "Register institutional agreements and perform initial administrative reviews. Ensure all mandatory data fields are populated before routing to relevant departments."}
        </p>
      </div>
    </header>
  );
}

export default LogReviewHeader;
