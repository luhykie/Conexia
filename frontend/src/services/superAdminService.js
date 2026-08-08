import {
  apiGet,
  apiGetBlob,
  apiPatch,
  withQuery,
} from "../api/apiClient";

export async function getRoleSettings() {
  const response = await apiGet("/super-admin/roles");

  return response.data ?? [];
}

export async function saveRoleSettings(permissions) {
  const response = await apiPatch("/super-admin/roles", {
    permissions,
  });

  return response.data ?? [];
}

export async function getAuditLogs(params = {}) {
  return apiGet(withQuery("/super-admin/audit-logs", params));
}

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
