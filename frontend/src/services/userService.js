// User service: kuhaa ug i-update ang user records para sa directory pages.
import {
  apiGet,
  apiPatch,
  apiPost,
  withQuery,
} from "../api/apiClient";

// Kuhaa ang paged user list para sa directory view.
export async function getUsers(params = {}) {
  const response = await apiGet(
    withQuery("/users", params),
  );

  return response;
}

// I-flip ang active state sa napiling user pinaagi sa API.
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

// Himoa ang bag-ong user record gikan sa form payload.
export async function createUser(payload) {
  const response = await apiPost("/users", payload);

  return response.user ?? response.data;
}

// I-update ang user assignment payload sa napiling record.
export async function updateUserAssignment(id, payload) {
  const response = await apiPatch(
    `/users/${id}/assignment`,
    payload,
  );

  return response.user ?? response.data;
}
