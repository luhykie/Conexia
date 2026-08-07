import React from "react";

import { DashboardView } from "../../../components/SharedViews";
import "./Page.css";

export default function IroAdminDashboardPage() {
  return (
    <DashboardView
      roleKey="admin"
      title="Office Overview"
      subtitle="Real-time status of institutional document submissions and office throughput."
      action="New Submission"
    />
  );
}
