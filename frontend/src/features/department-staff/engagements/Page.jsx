import React from "react";
import { Handshake } from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import "./Page.css";

export default function Page() {
  return (
    <section className="department-page-grid">
      <PageTitle
        title="Engagements"
        subtitle="Partner engagement records will appear here once a department engagements endpoint is available."
      >
        <Button icon={Handshake} disabled>
          Engagement Creation Unavailable
        </Button>
      </PageTitle>

      <Panel title="Partner Engagements">
        <DataTable
          headers={["Partner Organization", "Agreement", "Duration", "Documents", "Status"]}
          rows={[]}
          emptyMessage="Engagement records require a backend endpoint."
        />
      </Panel>
    </section>
  );
}
