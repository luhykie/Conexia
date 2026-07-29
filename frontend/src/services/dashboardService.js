import { apiGet } from "../api/apiClient";

export function getDepartmentDashboard() {
  return apiGet("/department/dashboard");
}

export function getIroDashboard() {
  return apiGet("/iro/dashboard");
}

export function getLegalDashboard() {
  return apiGet("/legal/dashboard");
}

export function getSuperAdminDashboard() {
  return apiGet("/super-admin/dashboard");
}
