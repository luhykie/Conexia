import React from "react";
import {
  Lock,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import "./Page.css";

const roleRows = [
  ["Super Admin", "Governance only", "No document workflow access", "Protected"],
  ["IRO Admin", "IRO administration", "Workflow summaries and directories", "Managed"],
  ["IRO Staff", "Operational routing", "Incoming and status queues", "Managed"],
  ["Legal Counsel", "Legal review", "Assigned legal queues only", "Managed"],
  ["Department Staff", "Department workspace", "Own department records only", "Managed"],
];

export default function Page() {
  return (
    <section className="super-admin-page">
      <PageTitle
        title="Role Management"
        subtitle="Review the RBAC boundaries enforced by Laravel middleware and frontend route guards."
      >
        <Button icon={Shield} disabled>
          Edit Roles - Backend Required
        </Button>
      </PageTitle>

      <section className="super-admin-stats">
        <article>
          <ShieldCheck size={22} />
          <strong>05</strong>
          <span>Configured Roles</span>
        </article>
        <article>
          <Lock size={22} />
          <strong>01</strong>
          <span>Governance Only</span>
        </article>
        <article>
          <Users size={22} />
          <strong>04</strong>
          <span>Operational Roles</span>
        </article>
      </section>

      <Panel title="Role Boundary Matrix">
        <DataTable
          headers={["Role", "Scope", "Access Boundary", "Status"]}
          rows={roleRows}
        />
      </Panel>
    </section>
  );
}
