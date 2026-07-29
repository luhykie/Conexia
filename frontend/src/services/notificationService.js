import {
  apiGet,
  apiPatch,
  apiPost,
  withQuery,
} from "../api/apiClient";

export function getNotifications(params = {}) {
  return apiGet(withQuery("/notifications", params));
}

export function getUnreadNotificationCount() {
  return apiGet("/notifications/unread-count");
}

export function createNotificationRequest(payload) {
  return apiPost("/notifications", payload);
}

export function markNotificationAsRead(notificationId) {
  return apiPatch(
    `/notifications/${notificationId}/read`,
    {}
  );
}

export function markAllNotificationsAsRead() {
  return apiPatch("/notifications/read-all", {});
}
