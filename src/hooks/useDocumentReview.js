import React from "react";
import {
  createReviewAnnotation,
  createReviewComment,
  deleteReviewComment,
  getSubmissionReviewData,
  updateReviewComment,
} from "../services/submissions";
import { canAnnotateDocument } from "../utils/pdfAnnotations";

export function useDocumentReview(submission, account) {
  const [comments, setComments] = React.useState([]);
  const [annotations, setAnnotations] = React.useState([]);
  const [reviewLoading, setReviewLoading] = React.useState(true);
  const [reviewError, setReviewError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [activeCommentId, setActiveCommentId] = React.useState(null);
  const [pendingComment, setPendingComment] = React.useState(null);

  const canAnnotate = canAnnotateDocument(account?.roleKey);
  const inlineComments = React.useMemo(
    () => comments.filter((comment) => String(comment.comment_type || "inline") !== "general" && Number(comment.page_number || 1) > 0),
    [comments],
  );
  const generalNotes = React.useMemo(
    () => comments.filter((comment) => String(comment.comment_type) === "general" || Number(comment.page_number || 0) === 0),
    [comments],
  );

  React.useEffect(() => {
    let cancelled = false;

    async function loadReviewData() {
      if (!submission?.id || !account) {
        setComments([]);
        setAnnotations([]);
        setReviewError("");
        setReviewLoading(false);
        return;
      }

      setReviewLoading(true);
      setReviewError("");
      setMessage("");

      try {
        const reviewResponse = await getSubmissionReviewData(account, submission.id);
        if (cancelled) return;
        const reviewData = reviewResponse?.data || {};
        setComments(Array.isArray(reviewData.comments) ? reviewData.comments : []);
        setAnnotations(Array.isArray(reviewData.annotations) ? reviewData.annotations : []);
      } catch (error) {
        if (cancelled) return;
        setComments([]);
        setAnnotations([]);
        setReviewError(error.message || "Unable to load review comments.");
      } finally {
        if (!cancelled) setReviewLoading(false);
      }
    }

    loadReviewData();
    return () => {
      cancelled = true;
    };
  }, [account, submission?.id]);

  const overlayItems = React.useMemo(() => {
    const commentItems = inlineComments.map((comment) => ({
      id: `comment-${comment.id}`,
      sourceId: comment.id,
      type: "comment",
      page_number: comment.page_number || 1,
      highlight_coordinates: comment.highlight_coordinates,
      selected_text: comment.selected_text,
      highlight_color: comment.highlight_color || "#5f9cff",
      color: comment.highlight_color || "#5f9cff",
    }));

    const annotationItems = annotations.map((annotation) => ({
      id: `annotation-${annotation.id}`,
      sourceId: annotation.id,
      type: "annotation",
      page_number: annotation.page_number || 1,
      highlight_coordinates: annotation.highlight_coordinates,
      selected_text: annotation.highlight_coordinates?.selected_text || "",
      color: annotation.color || "#f5c542",
    }));

    return [...annotationItems, ...commentItems];
  }, [annotations, inlineComments]);

  async function saveHighlight(selectionPayload) {
    if (!submission?.id || !canAnnotate) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await createReviewAnnotation(account, submission.id, {
        page_number: selectionPayload.pageNumber,
        highlight_coordinates: {
          ...selectionPayload.coordinates,
          selected_text: selectionPayload.selectedText,
        },
        color: selectionPayload.color || "#f6c24b",
      });
      const created = response?.data;
      if (created) {
        setAnnotations((current) => [...current, created]);
        setMessage("Highlight saved.");
      }
    } catch (error) {
      setMessage(error.message || "Unable to save highlight.");
    } finally {
      setBusy(false);
    }
  }

  function beginComment(selectionPayload) {
    if (!canAnnotate) return;
    setPendingComment({
      ...selectionPayload,
      commentType: selectionPayload?.pageNumber ? "inline" : "general",
    });
    setMessage("");
  }

  function beginGeneralNote() {
    if (!canAnnotate) return;
    setPendingComment({
      pageNumber: 0,
      selectedText: "",
      coordinates: null,
      color: "#5f9cff",
      commentType: "general",
      toolbar: { left: 20, top: 20 },
    });
    setMessage("");
  }

  async function submitPendingComment(commentText) {
    if (!submission?.id || !pendingComment) return;
    const trimmed = String(commentText || "").trim();
    if (!trimmed) {
      setMessage("Enter a comment before saving.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await createReviewComment(account, submission.id, {
        page_number: pendingComment.pageNumber || 0,
        selected_text: pendingComment.selectedText || "",
        highlight_coordinates: pendingComment.coordinates || null,
        comment: trimmed,
        highlight_color: pendingComment.color || null,
        comment_type: pendingComment.commentType || (pendingComment.pageNumber ? "inline" : "general"),
      });
      const created = response?.data;
      if (created) {
        setComments((current) => [...current, created]);
        setPendingComment(null);
        setMessage("Comment saved.");
      }
    } catch (error) {
      setMessage(error.message || "Unable to save comment.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveComment(commentId) {
    const comment = comments.find((item) => item.id === commentId);
    if (!comment) return;
    try {
      const response = await updateReviewComment(account, submission.id, commentId, {
        resolved: !comment.resolved,
      });
      const updated = response?.data;
      if (updated) {
        setComments((current) => current.map((item) => (item.id === commentId ? updated : item)));
      }
    } catch (error) {
      setMessage(error.message || "Unable to update comment.");
    }
  }

  async function removeComment(commentId) {
    try {
      await deleteReviewComment(account, submission.id, commentId);
      setComments((current) => current.filter((item) => item.id !== commentId));
    } catch (error) {
      setMessage(error.message || "Unable to delete comment.");
    }
  }

  return {
    comments,
    inlineComments,
    generalNotes,
    annotations,
    overlayItems,
    reviewLoading,
    reviewError,
    message,
    busy,
    canAnnotate,
    activeCommentId,
    setActiveCommentId,
    pendingComment,
    setPendingComment,
    saveHighlight,
    beginComment,
    beginGeneralNote,
    submitPendingComment,
    resolveComment,
    removeComment,
    setMessage,
  };
}
