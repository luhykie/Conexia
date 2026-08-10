import React from "react";

import { DashboardView } from "../../../components/SharedViews";
import { IroNewEngagementModal } from "../engagements/NewEngagementModal";
import "./Page.css";

export default function IroAdminDashboardPage() {
  const [showModal, setShowModal] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  function handleEngagementCreated() {
    setRefreshKey((current) => current + 1);
  }

  return (
    <>
      <DashboardView
        roleKey="admin"
        title="Office Overview"
        subtitle="Real-time status of institutional document submissions and office throughput."
        action="New Engagement"
        onAction={() => setShowModal(true)}
        refreshKey={refreshKey}
      />
      <IroNewEngagementModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={handleEngagementCreated}
      />
    </>
  );
}
