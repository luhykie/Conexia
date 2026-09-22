// [FEATURE: Dashboard & Reporting] - provides dashboard metrics, workflow summaries, and reporting views.
import { apiGet } from "../api/apiClient";

// Loads the Department Staff dashboard summary.
// Hint: kani nga data source ang Recent Activity table nag-gamit.
export function getDepartmentDashboard() {
  return apiGet("/department/dashboard");
}

// Loads the IRO Admin dashboard summary.
export function getIroDashboard() {
  return apiGet("/iro/dashboard");
}

// Loads the Legal Counsel dashboard summary.
// Hint: used by the Legal dashboard workload and Recent Activity.
export function getLegalDashboard() {
  return apiGet("/legal/dashboard");
}

// Loads the Super Admin dashboard summary.
export function getSuperAdminDashboard() {
  return apiGet("/super-admin/dashboard");
}
