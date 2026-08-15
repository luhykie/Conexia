import React from "react";

import { canAccessPage } from "../auth/rbac";
import DashboardPage from "../features/iro-staff/dashboard/Page";
import ExpiryPage from "../features/iro-staff/expiry/Page";
import IncomingPage from "../features/iro-staff/incoming/Page";
import SubmissionDetailsPage from "../features/iro-staff/incoming/SubmissionDetailsPage";
import SettingsPage from "../features/iro-staff/settings/Page";
import StatusPage from "../features/iro-staff/status/Page";

const pages = {
  dashboard: DashboardPage,
  incoming: IncomingPage,
  status: StatusPage,
  expiry: ExpiryPage,
  settings: SettingsPage,
};

export function IroStaff({ page = "dashboard", account, documentId }) {
  const requestedPage = canAccessPage("staff", page) ? page : "dashboard";
  if (requestedPage === "incoming" && documentId) {
    return <SubmissionDetailsPage documentId={documentId} />;
  }

  const Page = pages[requestedPage] || DashboardPage;

  return <Page account={account} />;
}
