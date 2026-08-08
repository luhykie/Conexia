import React, {
  useEffect,
  useState,
} from "react";
import {
  Database,
  HardDrive,
  Server,
  ShieldAlert,
} from "lucide-react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import { getSuperAdminDashboard } from "../../../services/dashboardService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function Page() {
  const [system, setSystem] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState("");

  async function loadSystem(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await getSuperAdminDashboard();
      const dashboard =
        response.dashboard ??
        response.data?.dashboard ??
        response.data ??
        {};

      setSystem(dashboard.system ?? {});
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (requestError) {
      reportClientError("Unable to load system monitoring:", requestError);
      setError(requestError.message || "Unable to load system monitoring.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSystem();
  }, []);

  return (
    <section className="super-admin-page">
      <PageTitle
        title="System Monitoring"
        subtitle="Monitor application availability, database connectivity, storage status, and security alerts."
      >
        <Button icon={Server} onClick={() => loadSystem(true)} disabled={loading || refreshing}>
          {refreshing ? "Refreshing..." : "Refresh Now"}
        </Button>
      </PageTitle>

      {error && <p className="auth-error">{error}</p>}

      <section className="monitor-grid">
        <StatusCard
          icon={Server}
          label="Platform Status"
          value={loading ? "-" : system.platform_status ?? "Unknown"}
        />
        <StatusCard
          icon={Database}
          label="Database Status"
          value={loading ? "-" : system.database_status ?? "Unknown"}
        />
        <StatusCard
          icon={HardDrive}
          label="Storage Usage"
          value={loading ? "-" : system.storage_usage ?? "Not tracked"}
        />
        <StatusCard
          icon={ShieldAlert}
          label="Security Alerts"
          value={loading ? "-" : system.security_alerts ?? "0 warnings"}
        />
      </section>

      <Panel title="Operational Telemetry">
        <p>
          {lastRefreshed
            ? `Last refreshed at ${lastRefreshed}.`
            : "Monitoring data loads when this page opens."}
        </p>
      </Panel>
    </section>
  );
}

function StatusCard({ icon: Icon, label, value }) {
  return (
    <article className="monitor-card">
      <Icon size={24} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
