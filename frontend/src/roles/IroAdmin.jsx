import React from "react";

import { canAccessPage } from "../auth/rbac";
import ArchivePage from "../features/iro-admin/archive/Page";
import DashboardPage from "../features/iro-admin/dashboard/Page";
import EngagementsPage from "../features/iro-admin/engagements/Page";
import ExpiryPage from "../features/iro-admin/expiry/Page";
import LogReviewPage from "../features/iro-admin/log-review/Page";
import ReassignPage from "../features/iro-admin/reassign/Page";
import ReportsPage from "../features/iro-admin/reports/Page";
import SettingsPage from "../features/iro-admin/settings/Page";

const pages = {
  dashboard: DashboardPage,
  "log-review": LogReviewPage,
  reassign: ReassignPage,
  reports: ReportsPage,
  archive: ArchivePage,
  engagements: EngagementsPage,
  expiry: ExpiryPage,
  settings: SettingsPage,
};

export function IroAdmin({ page = "dashboard", account, documentId }) {
  const requestedPage = canAccessPage("admin", page) ? page : "dashboard";
  const Page = pages[requestedPage] || DashboardPage;

  return <Page account={account} documentId={documentId} />;
}
