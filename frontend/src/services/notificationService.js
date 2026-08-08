import { apiRequest } from "./documentService";

let notificationSnapshotRequest = null;
let notificationSnapshot = null;
let notificationSnapshotAt = 0;

function clearNotificationSnapshot() {
  notificationSnapshotRequest = null;
  notificationSnapshot = null;
  notificationSnapshotAt = 0;
}

window.addEventListener("conexia:workflow-changed", clearNotificationSnapshot);

export async function getNotifications(page = 1) {
  if (page !== 1) return apiRequest(`/notifications?page=${page}`);

  if (notificationSnapshot && Date.now() - notificationSnapshotAt < 5000) {
    return notificationSnapshot;
  }
  if (notificationSnapshotRequest) return notificationSnapshotRequest;

  notificationSnapshotRequest = apiRequest(
    "/notifications?page=1&include_unread_count=1"
  ).then((result) => {
    notificationSnapshot = result;
    notificationSnapshotAt = Date.now();
    return result;
  }).finally(() => {
    notificationSnapshotRequest = null;
  });

  return notificationSnapshotRequest;
}

export async function getUnreadNotificationCount() {
  const result = await getNotifications(1);
  return result.unread_count ?? 0;
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) {
    throw new Error("Notification ID is required.");
  }

  const result = await apiRequest(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
  clearNotificationSnapshot();
  return result;
}

export async function markAllNotificationsRead() {
  const result = await apiRequest("/notifications/read-all", {
    method: "PATCH",
  });
  clearNotificationSnapshot();
  return result;
}
