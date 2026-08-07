import React from "react";
import DashboardPage from "../features/super-admin/dashboard/Page";
import UsersPage from "../features/super-admin/users/Page";
import RolesPage from "../features/super-admin/roles/Page";
import DepartmentsPage from "../features/super-admin/departments/Page";
import MonitoringPage from "../features/super-admin/monitoring/Page";
import AuditPage from "../features/super-admin/audit/Page";
import SettingsPage from "../features/super-admin/settings/Page";

export function SuperAdmin({ page }) {
  if (page === "users") {
    return <UsersPage />;
  }

  if (page === "roles") {
    return <RolesPage />;
  }

  if (page === "departments") {
    return <DepartmentsPage />;
  }

  if (page === "monitoring") {
    return <MonitoringPage />;
  }

  if (page === "audit") {
    return <AuditPage />;
  }

  if (page === "settings") {
    return <SettingsPage />;
  }

  return <DashboardPage />;
}
