import { apiGet, apiPost } from "../api/apiClient";

// Loads the conversation attached to a document visible to the current user.
export function getDocumentMessages(documentId) {
  return apiGet(`/documents/${documentId}/messages`);
}

// Sends a document message with an optional reply reference.
export function sendDocumentMessage(documentId, message, replyToMessageId = null) {
  return apiPost(`/documents/${documentId}/messages`, {
    message,
    reply_to_message_id: replyToMessageId,
  });
}
