import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  Building2,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { getSuperAdminDashboard } from "../../../services/dashboardService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function Page() {
  const [dashboard, setDashboard] = useState(createEmptyDashboard());
  const [period, setPeriod] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await getSuperAdminDashboard();
        const data =
          response.dashboard ??
          response.data?.dashboard ??
          response.data ??
          {};

        if (active) {
          setDashboard({
            stats: data.stats ?? {},
            trend: normalizeTrend(data.trend),
            offices: data.offices ?? data.departments ?? [],
            recentActivity: data.recent_activity ?? [],
            system: data.system ?? {},
          });
        }
      } catch (error) {
        reportClientError("Unable to load Super Admin dashboard:", error);

        if (active) {
          setErrorMessage(error.message || "Unable to load dashboard data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const trendData = useMemo(() => {
    const selected = dashboard.trend?.[period];

    return Array.isArray(selected) && selected.length
      ? selected
      : createFallbackTrend();
  }, [dashboard.trend, period]);

  const currentStats = Object.keys(dashboard.stats).length
    ? dashboard.stats
    : trendData[trendData.length - 1] ?? {};

  return (
    <section className="super-page">
      <PageTitle
        title="Super Admin Dashboard"
        subtitle="Monitor users, departments, sessions, administrative activity, and system health."
      />

      {errorMessage && (
        <div className="super-alert">
          <ShieldAlert size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section className="super-stat-grid">
        {[
          ["Total Users", currentStats.totalUsers, Users],
          ["Active Users", currentStats.activeUsers, UserCheck],
          ["Active Departments", currentStats.activeDepartments, Building2],
          ["Active Sessions", currentStats.activeSessions, Activity],
        ].map(([label, value, Icon]) => (
          <article className="super-stat" key={label}>
            <Icon size={22} />
            <strong>{loading ? "-" : formatCount(value)}</strong>
            <p>{label}</p>
          </article>
        ))}
      </section>

      <section className="super-grid">
        <Panel
          title="User Activity Trend"
          tools={
            <div className="super-segments">
              {["daily", "weekly", "monthly"].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={period === value ? "active" : ""}
                  onClick={() => setPeriod(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          }
        >
          <TrendChart data={trendData} />
        </Panel>

        <Panel title="System Overview">
          <div className="super-list">
            {[
              ["Platform Status", dashboard.system.platform_status ?? "Unknown"],
              ["Database Status", dashboard.system.database_status ?? "Unknown"],
              ["Storage Usage", dashboard.system.storage_usage ?? "Not tracked"],
              ["Security Alerts", dashboard.system.security_alerts ?? "0 warnings"],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Departments at a Glance">
        {loading && <p>Loading departments...</p>}
        {!loading && !errorMessage && dashboard.offices.length === 0 && (
          <p>No department activity is available.</p>
        )}
        {!loading && dashboard.offices.map((office) => (
          <article className="super-activity" key={`${office.code}-${office.name}`}>
            <strong>{office.code || "N/A"} - {office.name || "Unassigned"}</strong>
            <p>
              {formatCount(office.totalDocuments)} documents -{" "}
              {formatCount(office.active)} active -{" "}
              {formatCount(office.pending)} pending
            </p>
            <small>{formatCount(office.activeUsers)} active users</small>
          </article>
        ))}
      </Panel>

      <Panel title="Recent Administrative Activity">
        {loading && <p>Loading activity...</p>}
        {!loading && !errorMessage && dashboard.recentActivity.length === 0 && (
          <p>No recent administrative activity is available.</p>
        )}
        {!loading && dashboard.recentActivity.map((item, index) => (
          <article
            className="super-activity"
            key={`${item.tracking_number ?? item.title}-${index}`}
          >
            <strong>
              {item.tracking_number || item.title || "Administrative activity"}
            </strong>
            <p>
              {item.status || item.description || item.detail || ""}
              {item.department?.code ? ` - ${item.department.code}` : ""}
            </p>
            <small>{formatDateTime(item.timestamp) || item.time || "-"}</small>
          </article>
        ))}
      </Panel>
    </section>
  );
}

function TrendChart({ data }) {
  const values = data.map((item) => Number(item.activeUsers ?? 0));
  const max = Math.max(...values, 1);
  const chartLeft = 44;
  const chartRight = 276;
  const chartTop = 40;
  const chartBottom = 148;
  const chartHeight = chartBottom - chartTop;
  const axisTicks = Array.from({ length: 5 }, (_, index) => {
    const value = Math.round((max / 4) * (4 - index));
    const y = chartTop + index * (chartHeight / 4);

    return { value, y };
  });
  const points = values
    .map((value, index) => {
      const x =
        chartLeft +
        index * ((chartRight - chartLeft) / Math.max(values.length - 1, 1));
      const y = chartBottom - (value / max) * chartHeight;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="super-chart">
      <svg viewBox="0 0 300 170" role="img" aria-label="Active user trend">
        {axisTicks.map((tick) => (
          <g className="super-chart-tick" key={`${tick.value}-${tick.y}`}>
            <line x1={chartLeft} x2={chartRight} y1={tick.y} y2={tick.y} />
            <text x={34} y={tick.y} textAnchor="end">
              {formatCount(tick.value)}
            </text>
          </g>
        ))}
        <line
          className="super-chart-axis"
          x1={chartLeft}
          x2={chartLeft}
          y1={chartTop}
          y2={chartBottom}
        />
        <polyline points={points} />
        {points.split(" ").map((point, index) => {
          const [cx, cy] = point.split(",");

          return <circle key={index} cx={cx} cy={cy} r="4" />;
        })}
      </svg>
      <div>
        {data.map((item, index) => (
          <span key={`${item.period}-${index}`}>{item.period}</span>
        ))}
      </div>
    </div>
  );
}

function createEmptyDashboard() {
  return {
    stats: {},
    trend: normalizeTrend(),
    offices: [],
    recentActivity: [],
    system: {},
  };
}

function normalizeTrend(trend = {}) {
  return {
    daily: Array.isArray(trend.daily) && trend.daily.length
      ? trend.daily
      : createFallbackTrend(),
    weekly: Array.isArray(trend.weekly) && trend.weekly.length
      ? trend.weekly
      : createFallbackTrend(),
    monthly: Array.isArray(trend.monthly) && trend.monthly.length
      ? trend.monthly
      : createFallbackTrend(),
  };
}

function createFallbackTrend() {
  return [
    createTrendPoint("Previous"),
    createTrendPoint("Current"),
  ];
}

function createTrendPoint(period) {
  return {
    period,
    totalUsers: 0,
    activeUsers: 0,
    activeDepartments: 0,
    activeSessions: 0,
  };
}

function formatCount(value) {
  return String(Number.isFinite(Number(value)) ? Number(value) : 0).padStart(2, "0");
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}
