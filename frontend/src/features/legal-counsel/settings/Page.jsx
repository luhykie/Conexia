// [FEATURE: Legal Review & Notarization] - supports legal review decisions and notarization workflow data.
import React from "react";

import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import "./Page.css";

// Coordinates counsel settings page within the legal review decisions and notarization workflow.
export default function LegalCounselSettingsPage({ account }) {
  return (
    <section className="page legal-counsel-settings-page">
      <PageTitle
        title="Settings"
        subtitle="Review your Legal Counsel account details."
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
            <input
              value={account?.roleLabel || "Legal Counsel"}
              readOnly
            />
          </label>
        </div>

        <button
          type="button"
          className="primary wide-inline"
          disabled
          title="Profile updates are not available for Legal Counsel yet."
        >
          Profile updates unavailable
        </button>
      </Panel>
    </section>
  );
}
