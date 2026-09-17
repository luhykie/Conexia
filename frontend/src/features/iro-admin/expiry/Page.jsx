import React from "react";

import { ExpiryView } from "../../../components/SharedViews";
import "./Page.css";

// Configures the shared expiry view for the IRO Admin role.
export default function IroAdminExpiryPage() {
  return (
    <ExpiryView
      title="Agreement Expiry Tracking"
      subtitle="Review agreement expiry windows and renewal attention areas."
      documentNameHeader="Document Name / Tracking Number"
    />
  );
}
