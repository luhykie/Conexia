import { apiGet, apiPost } from "../api/apiClient";

export function getDocumentMessages(documentId) {
  return apiGet(`/documents/${documentId}/messages`);
}

export function sendDocumentMessage(documentId, message, replyToMessageId = null) {
  return apiPost(`/documents/${documentId}/messages`, {
    message,
    reply_to_message_id: replyToMessageId,
  });
}
