// Super-admin service: kuhaa ang shared backend data nga gamiton sa admin pages.
import {
  apiGet,
  apiGetBlob,
  apiPatch,
  withQuery,
} from "../api/apiClient";

// Kuhaa ang current role configuration gikan sa admin API.
export async function getRoleSettings() {
  const response = await apiGet("/super-admin/roles");

  return response.data ?? [];
}

// I-save balik sa admin API ang gi-edit nga permission map.
export async function saveRoleSettings(permissions) {
  const response = await apiPatch("/super-admin/roles", {
    permissions,
  });

  return response.data ?? [];
}

// Kuhaa ang paged audit log data para sa table view.
export async function getAuditLogs(params = {}) {
  return apiGet(withQuery("/super-admin/audit-logs", params));
}

// I-trigger ang audit CSV export ug ibalik ang generated filename.
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
