import { apiRequest } from "./documentService";

export async function getNotifications(page = 1) {
  return apiRequest(`/notifications?page=${page}`);
}

export async function getUnreadNotificationCount() {
  const result = await apiRequest("/notifications/unread-count");
  return result.data?.count ?? 0;
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
