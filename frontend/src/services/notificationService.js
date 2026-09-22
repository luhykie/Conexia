// [FEATURE: Notifications] - loads, formats, and presents workflow notifications.
import {
  apiGet,
  apiPatch,
  apiPost,
  withQuery,
} from "../api/apiClient";

// Retrieves notifications within the workflow notifications workflow.
export function getNotifications(params = {}) {
  return apiGet(withQuery("/notifications", params));
}

// Retrieves unread notification count within the workflow notifications workflow.
export function getUnreadNotificationCount() {
  return apiGet("/notifications/unread-count");
}

// Creates notification request within the workflow notifications workflow.
export function createNotificationRequest(payload) {
  return apiPost("/notifications", payload);
}

// Coordinates notification as read within the workflow notifications workflow.
export function markNotificationAsRead(notificationId) {
  return apiPatch(
    `/notifications/${notificationId}/read`,
    {}
  );
}

// Coordinates all notifications as read within the workflow notifications workflow.
export function markAllNotificationsAsRead() {
  return apiPatch("/notifications/read-all", {});
}
