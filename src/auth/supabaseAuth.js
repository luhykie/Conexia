import { apiRequest } from "../services/api";
import { authenticateDevAccount } from "./devAccounts";

export async function signInWithEmail(email, password) {
  const devResult = authenticateDevAccount(email, password);
  if (devResult.ok) {
    const user = {
      id: devResult.account.email.toLowerCase(),
      email: devResult.account.email.toLowerCase(),
      fullName: devResult.account.fullName,
      role: devResult.account.role,
      roleKey: devResult.account.roleKey,
      office: devResult.account.office,
      department: devResult.account.department,
      status: devResult.account.status || "Active",
    };

    const token = `dev:${user.email}`;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    return { ok: true, account: user, token };
  }

  if (import.meta.env.DEV) {
    return { ok: false, message: "Use one of the seeded Conexia development accounts." };
  }

  const response = await apiRequest("/api/login", {
    method: "POST",
    body: { email, password },
  });

  const token = response?.token;
  const user = response?.user;

  if (!token || !user) {
    return { ok: false, message: "Login failed." };
  }

  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));

  return { ok: true, account: user, token };
}

export async function fetchProfile() {
  if (import.meta.env.DEV) {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  }

  const response = await apiRequest("/api/me");
  return response?.user || null;
}

export async function signOut() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
