import React from "react";

export function ReviewCommentsPanel({ review, title = "Comments" }) {
  const {
    comments,
    inlineComments = [],
    generalNotes = [],
    reviewLoading,
    reviewError,
    message,
    busy,
    canAnnotate,
    activeCommentId,
    setActiveCommentId,
    focusComment,
    resolveComment,
    removeComment,
    beginGeneralNote,
  } = review;

  return (
    <aside className="review-comments-panel">
      <div className="review-comments-panel__header">
        <h4>{title}</h4>
        {!canAnnotate ? <small>View only</small> : null}
      </div>

      {message ? <p className="review-viewer-message">{message}</p> : null}

      {reviewLoading ? (
        <p className="review-comments-panel__empty">Loading comments...</p>
      ) : reviewError ? (
        <p className="review-comments-panel__empty">{reviewError}</p>
      ) : (
        <div className="review-comments-panel__list">
          {canAnnotate ? (
            <button type="button" className="outline review-comment-card review-comment-card--action" onClick={beginGeneralNote}>
              Add General Note
            </button>
          ) : null}

          <div className="review-comments-panel__section">
            <strong>Inline Comments</strong>
            {inlineComments.length ? inlineComments.map((comment) => {
              const overlayId = `comment-${comment.id}`;
              const isActive = activeCommentId === overlayId;
              return (
                <button
                  key={comment.id}
                  type="button"
                  className={`review-comment-card ${comment.resolved ? "resolved" : ""} ${isActive ? "active" : ""}`.trim()}
                  onClick={() => (isActive ? setActiveCommentId(null) : focusComment?.(comment))}
                >
                  <div className="review-comment-card__meta">
                    <b>{comment.created_by_name || comment.role || "Reviewer"}</b>
                    <span>Page {comment.page_number || 1}</span>
                  </div>
                  {comment.selected_text ? (
                    <p className="review-comment-card__quote" style={{ borderLeftColor: comment.highlight_color || "#5f9cff" }}>
                      "{comment.selected_text}"
                    </p>
                  ) : null}
                  <p>{comment.comment}</p>
                  <small>{comment.created_at ? new Date(comment.created_at).toLocaleString() : ""}</small>
                  {canAnnotate ? (
                    <div className="review-comment-card__actions">
                      <button
                        type="button"
                        className="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          resolveComment(comment.id);
                        }}
                      >
                        {comment.resolved ? "Reopen" : "Resolve"}
                      </button>
                      <button
                        type="button"
                        className="outline danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeComment(comment.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </button>
              );
            }) : <p className="review-comments-panel__empty">No inline comments yet.</p>}
          </div>

          <div className="review-comments-panel__section">
            <strong>General Notes</strong>
            {generalNotes.length ? generalNotes.map((comment) => (
              <button
                key={comment.id}
                type="button"
                className={`review-comment-card ${comment.resolved ? "resolved" : ""}`.trim()}
                onClick={() => setActiveCommentId(null)}
              >
                <div className="review-comment-card__meta">
                  <b>{comment.created_by_name || comment.role || "Reviewer"}</b>
                  <span>General Note</span>
                </div>
                <p>{comment.comment}</p>
                <small>{comment.created_at ? new Date(comment.created_at).toLocaleString() : ""}</small>
              </button>
            )) : <p className="review-comments-panel__empty">No general notes yet.</p>}
          </div>
        </div>
      )}

      {busy ? <p className="review-comments-panel__empty">Saving...</p> : null}
    </aside>
  );
}
