import React from "react";

import { DashboardView } from "../../../components/SharedViews";
import "./Page.css";

export default function IroStaffDashboardPage() {
  return (
    <DashboardView
      roleKey="staff"
      title="Dashboard Overview"
      subtitle="Reminder-level tracking for IRO Admin follow-up."
    />
  );
}
