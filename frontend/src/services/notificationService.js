import { apiRequest } from "./documentService";

let unreadCountRequest = null;
let unreadCountRequestedAt = 0;

export async function getNotifications(page = 1) {
  return apiRequest(`/notifications?page=${page}`);
}

export async function getUnreadNotificationCount() {
  const now = Date.now();
  if (unreadCountRequest && now - unreadCountRequestedAt < 5000) {
    return unreadCountRequest;
  }
  unreadCountRequestedAt = now;
  unreadCountRequest = apiRequest("/notifications/unread-count")
    .then((result) => result.data?.count ?? 0)
    .finally(() => {
      window.setTimeout(() => {
        unreadCountRequest = null;
      }, 5000);
    });
  return unreadCountRequest;
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) {
    throw new Error("Notification ID is required.");
  }

  return apiRequest(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead() {
  return apiRequest("/notifications/read-all", {
    method: "PATCH",
  });
}
