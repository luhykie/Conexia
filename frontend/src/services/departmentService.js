import {
  apiGet,
  apiPost,
  withQuery,
} from "../api/apiClient";

export async function getDepartments(params = {}) {
  const response =
    await apiGet(withQuery("/departments", params));

  return response;
}

export async function createDepartment(payload) {
  const response = await apiPost("/departments", payload);

  return response.data;
}
