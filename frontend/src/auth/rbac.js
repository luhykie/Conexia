// [FEATURE: Auth & RBAC] - authenticates accounts and enforces role-based access across the application.
import { navItems, roles } from "../data/roles";

export const ROLE_KEYS = Object.keys(roles);

// Central RBAC guard used by navigation and page rendering.
export function canAccessPage(roleKey, pageId) {
  if (pageId === "settings") {
    return true;
  }

  return Boolean(
    navItems[roleKey]?.some(([id]) => id === pageId)
  );
}

// Retrieves default page within the authentication and role-based access workflow.
export function getDefaultPage(roleKey) {
  return roles[roleKey]?.defaultPage || "dashboard";
}

// Retrieves allowed nav items within the authentication and role-based access workflow.
export function getAllowedNavItems(roleKey) {
  return navItems[roleKey] || [];
}

// Coordinates operational workflow page within the authentication and role-based access workflow.
export function isOperationalWorkflowPage(pageId) {
  return [
    "submission",
    "log-review",
    "review",
  ].includes(pageId);
}

// Super Admin can monitor and administer but cannot perform operational workflow actions.
export function canPerformWorkflowAction(roleKey, pageId) {
  if (
    roleKey === "super" &&
    isOperationalWorkflowPage(pageId)
  ) {
    return false;
  }

  return canAccessPage(roleKey, pageId);
}
