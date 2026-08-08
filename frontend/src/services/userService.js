import {
  apiGet,
  apiPatch,
  withQuery,
} from "../api/apiClient";

export async function getUsers(params = {}) {
  const response = await apiGet(
    withQuery("/users", params),
  );

  return response;
}

export async function toggleUserStatus(
  id,
  isActive,
) {
  const response = await apiPatch(
    `/users/${id}/status`,
    {
      is_active: isActive,
    },
  );

  return response.user;
}
