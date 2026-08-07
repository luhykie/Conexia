import React from "react";

import { DashboardView } from "../../../components/SharedViews";
import "./Page.css";

export default function IroStaffDashboardPage() {
  return (
    <DashboardView
      roleKey="staff"
      title="Dashboard Overview"
      subtitle="Real-time tracking of institutional relations workflow."
      action="Process Now"
    />
  );
}
