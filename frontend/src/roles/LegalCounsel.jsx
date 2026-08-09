import React from "react";

import { canAccessPage } from "../auth/rbac";
import DashboardPage from "../features/legal-counsel/dashboard/Page";
import ExpiryPage from "../features/legal-counsel/expiry/Page";
import HistoryPage from "../features/legal-counsel/history/Page";
import NotarizationPage from "../features/legal-counsel/notarization/Page";
import ReviewPage from "../features/legal-counsel/review/Page";
import SettingsPage from "../features/legal-counsel/settings/Page";

const pages = {
  dashboard: DashboardPage,
  review: ReviewPage,
  notarization: NotarizationPage,
  expiry: ExpiryPage,
  history: HistoryPage,
  settings: SettingsPage,
};

export function LegalCounsel({ page = "dashboard", account }) {
  const requestedPage = canAccessPage("legal", page) ? page : "dashboard";
  const Page = pages[requestedPage] || DashboardPage;

  return <Page account={account} />;
}
