import React from "react";
import { DashboardView } from "../../../components/SharedViews";
import "./Page.css";

export default function Page({ account }) {
  return (
    <DashboardView
      roleKey="department"
      title="Institutional Workspace"
      subtitle={`Welcome back, ${account?.name || account?.fullName || "Department Staff"}. Here is the real-time status for your department.`}
      action="New Submission"
    />
  );
}
