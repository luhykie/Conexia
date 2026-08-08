export const ROLE_KEYS = [
  "super",
  "admin",
  "staff",
  "legal",
  "department",
];

const DEFAULT_PAGES = {
  super: "dashboard",
  admin: "dashboard",
  staff: "dashboard",
  legal: "dashboard",
  department: "dashboard",
};

const NAV_ITEMS = {
  department: [
    ["dashboard", "Dashboard"],
    ["submission", "Submission"],
    ["submissions", "My Submissions"],
    ["engagements", "Engagements"],
    ["expiry", "Expiry"],
  ],
  staff: [
    ["dashboard", "Dashboard"],
    ["incoming", "Incoming Submissions"],
    ["status", "Status Tracker"],
    ["expiry", "Expiry"],
  ],
  admin: [
    ["dashboard", "Dashboard"],
    ["log-review", "Log & Review Form"],
    ["validation", "Validation Queue"],
    ["reassign", "Reassign Submissions"],
    ["reports", "Performance Reports"],
    ["archive", "Archive"],
    ["engagements", "Engagements"],
    ["expiry", "Expiry"],
  ],
  legal: [
    ["dashboard", "Dashboard"],
    ["review", "Review Queue"],
    ["notarization", "Notarization Tracker"],
    ["expiry", "Expiry"],
    ["history", "My Action History"],
  ],
  super: [
    ["dashboard", "Dashboard"],
    ["users", "User Management"],
    ["roles", "Role Management"],
    ["departments", "Department Management"],
    ["monitoring", "System Monitoring"],
    ["audit", "Audit Logs"],
  ],
};

// Central RBAC guard used by navigation and page rendering.
export function canAccessPage(roleKey, pageId) {
  if (pageId === "settings") {
    return true;
  }

  return Boolean(
    NAV_ITEMS[roleKey]?.some(([id]) => id === pageId)
  );
}

export function getDefaultPage(roleKey) {
  return DEFAULT_PAGES[roleKey] || "dashboard";
}

export function getAllowedNavItems(roleKey) {
  return NAV_ITEMS[roleKey] || [];
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
