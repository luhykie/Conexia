import {
  apiGet,
  withQuery,
} from "../api/apiClient";

export async function getDepartments(params = {}) {
  const response =
    await apiGet(withQuery("/departments", params));

  return response;
}
