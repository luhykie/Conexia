import React from "react";

export function SubmissionDetails({ document, status, children }) {
  return <aside className="department-submission-review__details">
    <h2>Submission Details</h2>
    <SubmissionDetailSection title="Submission Information"><SubmissionDetail label="Tracking Number" value={document.tracking_number} /><SubmissionDetail label="Status" value={status || document.status} /><SubmissionDetail label="Submitted Date" value={formatDocumentDate(document.submitted_at)} /></SubmissionDetailSection>
    <SubmissionDetailSection title="Requesting Office / Department"><SubmissionDetail label="Department" value={document.department?.name || document.department?.code} /></SubmissionDetailSection>
    <SubmissionDetailSection title="Agreement Details"><SubmissionDetail label="Document Type" value={document.document_type} /><SubmissionDetail label="Title of Agreement" value={document.title} /><SubmissionDetail label="Partner Organization" value={document.partner_institution} /><SubmissionDetail label="Partner Contact Email" value={document.partner_email} /></SubmissionDetailSection>
    {document.description && <SubmissionDetailSection title="Submitted Form Information"><p className="department-submission-review__description">{document.description}</p></SubmissionDetailSection>}
    {children}
  </aside>;
}

export function SubmissionDetailSection({ title, children }) { return <section className="department-submission-review__section"><h3>{title}</h3><div>{children}</div></section>; }
export function SubmissionDetail({ label, value }) { return <p><span>{label}</span><b>{value || "—"}</b></p>; }
function formatDocumentDate(value) { return value ? new Date(value).toLocaleDateString() : "—"; }
