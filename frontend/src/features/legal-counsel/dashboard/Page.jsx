import React from "react";

import { DashboardView } from "../../../components/SharedViews";
import "./Page.css";

export default function LegalCounselDashboardPage() {
  return (
    <DashboardView
      roleKey="legal"
      title="Legal Counsel Dashboard"
      subtitle="Prioritized legal review, approval, return, and notarization workload."
      action="Open Document"
    />
  );
}
