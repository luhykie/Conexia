// [FEATURE: Department Management] - manages departments and department-scoped workflow data.
import {
  apiGet,
  apiPost,
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
