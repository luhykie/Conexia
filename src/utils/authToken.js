export function getAuthToken() {
  return localStorage.getItem("token") || localStorage.getItem("sb-access-token");
}
