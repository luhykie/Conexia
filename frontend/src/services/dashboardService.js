import { apiGet } from "../api/apiClient";

// Loads the Department Staff dashboard summary.
export function getDepartmentDashboard() {
  return apiGet("/department/dashboard");
}

// Loads the IRO Admin dashboard summary.
export function getIroDashboard() {
  return apiGet("/iro/dashboard");
}

// Loads the Legal Counsel dashboard summary.
export function getLegalDashboard() {
  return apiGet("/legal/dashboard");
}

// Loads the Super Admin dashboard summary.
export function getSuperAdminDashboard() {
  return apiGet("/super-admin/dashboard");
}
