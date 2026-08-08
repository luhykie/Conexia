import React from "react";
import {
  ClipboardCheck,
  Download,
  ShieldAlert,
} from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import "./Page.css";

export default function Page() {
  return (
    <section className="super-admin-page">
      <PageTitle
        title="Audit Logs"
        subtitle="Review administrative activity once the audit log endpoint is exposed."
      >
        <Button icon={Download} disabled>
          Export Logs - Backend Required
        </Button>
      </PageTitle>

      <section className="audit-empty">
        <ShieldAlert size={24} />
        <div>
          <strong>Audit API pending</strong>
          <p>
            No audit log endpoint is available to Super Admin yet. This page
            intentionally avoids mock log rows.
          </p>
        </div>
      </section>

      <Panel title="Administrative Audit Entries">
        <DataTable
          headers={["Timestamp", "User", "Role", "Activity", "IP Address", "Status"]}
          rows={[]}
          emptyMessage="Audit logs require a backend endpoint."
        />
      </Panel>

      <Button icon={ClipboardCheck} disabled>
        Refresh Logs - Backend Required
      </Button>
    </section>
  );
}
