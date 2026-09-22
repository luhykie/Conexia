// [FEATURE: Shared/Utility] - provides shared application infrastructure and reusable interface behavior.
import React from "react";

import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import "./Page.css";

// Displays the current IRO Admin account as read-only information.
export default function IroAdminSettingsPage({ account }) {
  return (
    <section className="page iro-admin-settings-page">
      <PageTitle
        title="Settings"
        subtitle="Review your IRO Admin account details."
      />

      <Panel title="Account Profile">
        <div className="settings-grid">
          <label>
            Name
            <input
              value={account?.fullName || account?.name || ""}
              readOnly
            />
          </label>

          <label>
            Email
            <input value={account?.email || ""} readOnly />
          </label>

          <label>
            Role
            <input value={account?.roleLabel || "IRO Admin"} readOnly />
          </label>
        </div>

        <button
          type="button"
          className="primary wide-inline"
          disabled
          title="Profile updates are not available for IRO Admin yet."
        >
          Profile updates unavailable
        </button>
      </Panel>
    </section>
  );
}
