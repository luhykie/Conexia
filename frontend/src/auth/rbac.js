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

export function getDefaultPage(roleKey) {
  return roles[roleKey]?.defaultPage || "dashboard";
}

export function getAllowedNavItems(roleKey) {
  return navItems[roleKey] || [];
}

export function isOperationalWorkflowPage(pageId) {
  return [
    "submission",
    "log-review",
    "validation",
    "reassign",
    "review",
    "notarization",
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