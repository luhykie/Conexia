import React from "react";

import { ExpiryView } from "../../../components/SharedViews";
import "./Page.css";

export default function IroStaffExpiryPage() {
  return (
    <ExpiryView
      title="Global Expiry List"
      action="Bulk Notify Offices"
    />
  );
}
