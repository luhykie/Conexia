import React from "react";
import { ExpiryView } from "../../../components/SharedViews";
import "./Page.css";

export default function Page() {
  return (
    <ExpiryView
      title="Expiry Overview"
      subtitle="Track department agreements that are expired, expiring soon, or ready for renewal action."
    />
  );
}
