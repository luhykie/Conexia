import React from "react";
import { Settings } from "lucide-react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import "./Page.css";

export default function Page({ account }) {
  return (
    <section className="department-page-grid">
      <PageTitle
        title="Settings"
        subtitle="Review your signed-in department profile. Profile edits require a backend account settings endpoint."
      >
        <Button icon={Settings} disabled>
          Save Settings - Backend Required
        </Button>
      </PageTitle>

      <Panel title="Account Profile">
        <div className="department-settings-grid">
          <label>
            Name
            <input value={account?.name || account?.fullName || ""} readOnly />
          </label>
          <label>
            Email
            <input value={account?.email || ""} readOnly />
          </label>
          <label>
            Role
            <input value={account?.role || "department_staff"} readOnly />
          </label>
          <label>
            Department
            <input value={account?.department || account?.departmentCode || ""} readOnly />
          </label>
        </div>
      </Panel>
    </section>
  );
}
