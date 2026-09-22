// [FEATURE: Shared/Utility] - provides shared application infrastructure and reusable interface behavior.
import {
  apiGet,
  apiGetBlob,
  apiPatch,
  withQuery,
} from "../api/apiClient";

// Retrieves role settings within the shared application infrastructure and reusable interface behavior workflow.
export async function getRoleSettings() {
  const response = await apiGet("/super-admin/roles");

  return response.data ?? [];
}

// Saves role settings within the shared application infrastructure and reusable interface behavior workflow.
export async function saveRoleSettings(permissions) {
  const response = await apiPatch("/super-admin/roles", {
    permissions,
  });

  return response.data ?? [];
}

// Retrieves audit logs within the shared application infrastructure and reusable interface behavior workflow.
export async function getAuditLogs(params = {}) {
  return apiGet(withQuery("/super-admin/audit-logs", params));
}

// Coordinates audit logs within the shared application infrastructure and reusable interface behavior workflow.
export async function exportAuditLogs(params = {}) {
  const { blob, response } = await apiGetBlob(
    withQuery("/super-admin/audit-logs/export", params),
  );

  const disposition =
    response.headers.get("content-disposition") || "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);

  return {
    blob,
    filename: filenameMatch?.[1] || "CONEXIA-Audit-Logs.csv",
  };
}
