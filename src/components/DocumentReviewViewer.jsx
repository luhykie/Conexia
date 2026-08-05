import React from "react";
import { DocumentViewer } from "./DocumentViewer";
import { ReviewCommentsPanel } from "./ReviewCommentsPanel";
import { useDocumentReview } from "../hooks/useDocumentReview";

export function DocumentReviewViewer({
  submission,
  account,
  viewerTitle = "Document Review",
  showCommentsPanel = false,
  review: externalReview,
}) {
  const internalReview = useDocumentReview(submission, account);
  const review = externalReview || internalReview;

  return (
    <div className="document-review-shell">
      <DocumentViewer
        submission={submission}
        account={account}
        overlayItems={review.overlayItems}
        canSelect={review.canAnnotate}
        activeOverlayId={review.activeCommentId}
        onOverlayActivate={(overlayId) => review.setActiveCommentId(overlayId)}
        onHighlight={review.saveHighlight}
        onComment={review.beginComment}
        pendingComment={review.pendingComment}
        onSubmitPendingComment={review.submitPendingComment}
        onCancelPendingComment={() => review.setPendingComment(null)}
        busy={review.busy}
      />
      {showCommentsPanel ? (
        <ReviewCommentsPanel
          review={review}
          title={viewerTitle}
        />
      ) : null}
    </div>
  );
}

export { ReviewCommentsPanel, useDocumentReview };
