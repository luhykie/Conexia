// Monitoring page: ipakita ang core system health metrics para sa admin.
import React, {
  useEffect,
  useState,
} from "react";
import {
  Database,
  HardDrive,
  ListChecks,
  Server,
  ShieldAlert,
} from "lucide-react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import { getSuperAdminDashboard } from "../../../services/dashboardService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

// I-render ang system health status cards ug current telemetry summary.
export default function Page() {
  const [system, setSystem] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState("");

  // I-load ang current monitoring data ug refresh state nga responsive gihapon ang UI.
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
        <StatusCard
          icon={ListChecks}
          label="Today's Audit Activity"
          value={loading ? "-" : system.audit_activity_today ?? 0}
        />
        <StatusCard
          icon={Server}
          label="Environment / Version"
          value={loading ? "-" : system.environment ?? "Unknown"}
        />
      </section>

      <Panel title="Operational Telemetry">
        <p>
          {lastRefreshed
            ? `Data as of ${lastRefreshed}.`
            : "Loading monitoring data..."}
        </p>
      </Panel>
    </section>
  );
}

// Himoa ang compact status card sa matag monitoring metric.
function StatusCard({ icon: Icon, label, value }) {
  return (
    <article className="monitor-card">
      <Icon size={24} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
