import React from "react";
import { useNavigate } from "react-router-dom";

import { DashboardView } from "../../../components/SharedViews";
import "./Page.css";

export default function LegalCounselDashboardPage() {
  const navigate = useNavigate();

  return (
    <DashboardView
      roleKey="legal"
      title="Legal Counsel Dashboard"
      subtitle="Prioritized legal review, approval, and correction workload."
      className="legal-page legal-counsel-dashboard-page"
      hideNotifications
      onViewDocument={(document) => navigate(`/app/review/${document.id}`)}
    />
  );
}
