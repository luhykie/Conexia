import {
  apiGet,
  apiPatch,
  apiPost,
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

export async function createUser(payload) {
  const response = await apiPost("/users", payload);

  return response.user ?? response.data;
}

export async function updateUserAssignment(id, payload) {
  const response = await apiPatch(
    `/users/${id}/assignment`,
    payload,
  );

  return response.user ?? response.data;
}
