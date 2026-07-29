import { createNotificationRequest } from "../services/notificationService";
import { reportClientError } from "./reportClientError";

export async function createNotification({
  userId,
  documentId = null,
  title,
  message,
  type = "document_update",
}) {
  if (!userId) {
    reportClientError("Notification recipient is required.");
    return {
      success: false,
      error: "Notification recipient is required.",
    };
  }

  try {
    const response = await createNotificationRequest({
      user_id: userId,
      document_id: documentId,
      title,
      message,
      notification_type: type,
    });

    return {
      success: true,
      data: response.notification ?? response.data,
    };
  } catch (error) {
    reportClientError("Unable to create notification:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}
