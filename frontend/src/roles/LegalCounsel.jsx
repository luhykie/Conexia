// [FEATURE: Auth & RBAC] - authenticates accounts and enforces role-based access across the application.
import React from "react";

import { canAccessPage } from "../auth/rbac";
import DashboardPage from "../features/legal-counsel/dashboard/Page";
import HistoryPage from "../features/legal-counsel/history/Page";
import ReviewPage from "../features/legal-counsel/review/Page";
import SettingsPage from "../features/legal-counsel/settings/Page";

// Legal Counsel route gate ni; this wrapper only exposes the pages the legal role is allowed to access.
const pages = {
  dashboard: DashboardPage,
  review: ReviewPage,
  history: HistoryPage,
  settings: SettingsPage,
};

// Coordinates counsel within the authentication and role-based access workflow.
export function LegalCounsel({ page = "dashboard", account }) {
  const requestedPage = canAccessPage("legal", page) ? page : "dashboard";
  const Page = pages[requestedPage] || DashboardPage;

  return <Page account={account} />;
}
