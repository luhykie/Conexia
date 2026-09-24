// [FEATURE: Department Management] - manages departments and department-scoped workflow data.
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  withQuery,
} from "../api/apiClient";

// Retrieves departments within the department management and department-scoped workflow.
export async function getDepartments(params = {}) {
  const response =
    await apiGet(withQuery("/departments", params));

  return response;
}

// Creates department within the department management and department-scoped workflow.
export async function createDepartment(payload) {
  const response = await apiPost("/departments", payload);

  return response.data;
}

// Updates a department directory entry from the Super Admin Manage form.
export async function updateDepartment(id, payload) {
  const response = await apiPut(`/departments/${id}`, payload);

  return response.data;
}

// Permanently deletes a department after the Manage confirmation flow succeeds.
export async function deleteDepartment(id) {
  return apiDelete(`/departments/${id}`);
}
