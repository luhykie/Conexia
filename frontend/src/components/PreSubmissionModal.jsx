import React from "react";
import { ArrowRight, X } from "lucide-react";
import "./PreSubmissionModal.css";

export function PreSubmissionModal({
  open,
  onClose,
  onConfirm,
  loading = false,
}) {
  const [selection, setSelection] = React.useState({
    agreementType: "MOA",
    submissionType: "new_partnership",
    partnerClassification: "local",
  });

  function handleConfirm() {
    onConfirm(selection);
  }

  function handleClose() {
    onClose();
  }

  if (!open) return null;

  return (
    <div className="pre-submission-overlay">
      <div className="pre-submission-modal">
        <div className="pre-submission-header">
          <h2>Start a New Agreement Submission</h2>
          <button
            type="button"
            className="close-button"
            onClick={handleClose}
            aria-label="Close"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="pre-submission-content">
          <fieldset className="pre-submission-field">
            <legend>What type of agreement are you initiating?</legend>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="agreementType"
                  value="MOA"
                  checked={selection.agreementType === "MOA"}
                  onChange={(e) =>
                    setSelection((prev) => ({
                      ...prev,
                      agreementType: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
                <span>MOA — Memorandum of Agreement</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="agreementType"
                  value="MOU"
                  checked={selection.agreementType === "MOU"}
                  onChange={(e) =>
                    setSelection((prev) => ({
                      ...prev,
                      agreementType: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
                <span>MOU — Memorandum of Understanding</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="agreementType"
                  value="MOF"
                  checked={selection.agreementType === "MOF"}
                  onChange={(e) =>
                    setSelection((prev) => ({
                      ...prev,
                      agreementType: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
                <span>MOF — Memorandum of Friendship</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="pre-submission-field">
            <legend>Is this a new partnership or a renewal?</legend>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="submissionType"
                  value="new_partnership"
                  checked={selection.submissionType === "new_partnership"}
                  onChange={(e) =>
                    setSelection((prev) => ({
                      ...prev,
                      submissionType: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
                <span>New Partnership</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="submissionType"
                  value="renewal"
                  checked={selection.submissionType === "renewal"}
                  onChange={(e) =>
                    setSelection((prev) => ({
                      ...prev,
                      submissionType: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
                <span>Renewal</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="pre-submission-field">
            <legend>Is the partner institution local or international?</legend>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="partnerClassification"
                  value="local"
                  checked={selection.partnerClassification === "local"}
                  onChange={(e) =>
                    setSelection((prev) => ({
                      ...prev,
                      partnerClassification: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
                <span>Local</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="partnerClassification"
                  value="international"
                  checked={selection.partnerClassification === "international"}
                  onChange={(e) =>
                    setSelection((prev) => ({
                      ...prev,
                      partnerClassification: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
                <span>International</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="partnerClassification"
                  value="interdepartmental"
                  checked={selection.partnerClassification === "interdepartmental"}
                  onChange={(e) =>
                    setSelection((prev) => ({
                      ...prev,
                      partnerClassification: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
                <span>Interdepartmental</span>
              </label>
            </div>
          </fieldset>
        </div>

        <div className="pre-submission-footer">
          <button
            type="button"
            className="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Loading..." : "Next"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
