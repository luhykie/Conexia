// [FEATURE: User Management] - manages user profiles, accounts, and directory access.
import {
  apiGet,
  apiPatch,
  apiPost,
  withQuery,
} from "../api/apiClient";

// Retrieves users within the user profile, account, and directory management workflow.
export async function getUsers(params = {}) {
  const response = await apiGet(
    withQuery("/users", params),
  );

  return response;
}

// Toggles user status within the user profile, account, and directory management workflow.
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

// Creates user within the user profile, account, and directory management workflow.
export async function createUser(payload) {
  const response = await apiPost("/users", payload);

  return response.user ?? response.data;
}

// Updates user assignment within the user profile, account, and directory management workflow.
export async function updateUserAssignment(id, payload) {
  const response = await apiPatch(
    `/users/${id}/assignment`,
    payload,
  );

  return response.user ?? response.data;
}
