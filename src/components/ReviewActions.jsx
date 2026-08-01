import React from "react";

export function ReviewActions({
  disabled = false,
  submitting = false,
  onSaveDraft,
  onSubmit,
  submitLabel = "Submit for Validation",
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
          : submitLabel}
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
