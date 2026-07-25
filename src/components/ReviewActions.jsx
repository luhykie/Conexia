import React from "react";

export function ReviewActions({
  disabled = false,
  submitting = false,
  onSaveDraft,
  onSubmit,
}) {
  return (
    <div className="review-actions">
      <button
        className="btn primary large"
        disabled={disabled || submitting}
        onClick={onSubmit}
        type="button"
      >
        {submitting
          ? "Submitting..."
          : "Submit to IRO Admin"}
      </button>

      <button
        className="btn outline"
        disabled={disabled || submitting}
        onClick={onSaveDraft}
        type="button"
      >
        Save Draft
      </button>
    </div>
  );
}

export default ReviewActions;