import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  Building2,
  Download,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";

import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";

import { getSuperAdminDashboard } from "../../../services/dashboardService";
import { reportClientError } from "../../../utils/reportClientError";

import "./SuperAdminDashboard.css";

/**
 * Feature: Super Admin Dashboard
 * Route: /app/dashboard
 *
 * Data flow:
 * SuperAdminDashboard
 * → dashboardService.js
 * → apiClient.js
 * → GET /api/super-admin/dashboard
 *
 * Styles:
 * ./SuperAdminDashboard.css
 */
export default function SuperAdminDashboard() {
  const [dashboard, setDashboard] = useState(
    createEmptyDashboard(),
  );

  const [period, setPeriod] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response =
          await getSuperAdminDashboard();

        const data =
          response.dashboard ??
          response.data?.dashboard ??
          response.data ??
          {};

        if (!active) {
          return;
        }

        setDashboard({
          stats: data.stats ?? {},
          trend: normalizeTrend(data.trend),
          recentActivity:
            data.recent_activity ?? [],
          system: data.system ?? {},
          efficiency:
            data.efficiency_index ?? [],
          hotspots:
            data.workflow_hotspots ?? [],
        });
      } catch (error) {
        reportClientError(
          "Unable to load Super Admin dashboard:",
          error,
        );

        if (active) {
          setErrorMessage(
            error.message ||
              "Unable to load dashboard data.",
          );
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
    const selected =
      dashboard.trend?.[period];

    return Array.isArray(selected) &&
      selected.length > 0
      ? selected
      : createFallbackTrend();
  }, [dashboard.trend, period]);

  const latest =
    trendData[trendData.length - 1] ?? {};

  const currentStats =
    Object.keys(dashboard.stats ?? {}).length
      ? dashboard.stats
      : latest;

  const stats = [
    {
      label: "Total Users",
      value: formatCount(currentStats.totalUsers),
      icon: Users,
    },
    {
      label: "Active Users",
      value: formatCount(currentStats.activeUsers),
      icon: UserCheck,
    },
    {
      label: "Active Departments",
      value: formatCount(
        currentStats.activeDepartments,
      ),
      icon: Building2,
      tag: "Complete",
    },
    {
      label: "Active Sessions",
      value: formatCount(
        currentStats.activeSessions,
      ),
      icon: Activity,
      tag: "Action Required",
      tone: "warning",
    },
  ];

  return (
    <section className="super-dashboard">
      <PageTitle
        title="Super Admin Dashboard"
        subtitle="Monitor users, departments, sessions, administrative activity, and system health."
      />

      {errorMessage && (
        <div className="super-dashboard__error">
          <ShieldAlert size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section className="super-dashboard__stats">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className={[
                "super-dashboard-stat",
                stat.tone
                  ? `super-dashboard-stat--${stat.tone}`
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="super-dashboard-stat__top">
                <Icon size={22} />

                {stat.tag && (
                  <span>{stat.tag}</span>
                )}
              </div>

              <strong>
                {loading ? "—" : stat.value}
              </strong>

              <p>{stat.label}</p>
            </article>
          );
        })}
      </section>

      <section className="super-dashboard__main-grid">
        <Panel
          title="Agreement Lifecycle Trends"
          tools={
            <div className="super-dashboard__periods">
              {[
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={
                    period === value
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setPeriod(value)
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <DashboardLineChart
            data={trendData}
          />
        </Panel>

        <Panel title="Workflow Hotspots">
          <WorkflowHotspots
            items={dashboard.hotspots}
          />
        </Panel>
      </section>

      <Panel
        title="Efficiency Index per Business Unit"
        subtitle="Performance metrics per operational department."
        noPadding
        tools={
          <Button
            variant="ghost"
            size="small"
            icon={Download}
          >
            Export Full Metrics
          </Button>
        }
      >
        <EfficiencyTable
          rows={dashboard.efficiency}
          loading={loading}
        />
      </Panel>

      <section className="super-dashboard__bottom-grid">
        <Panel title="Recent Administrative Activity">
          <RecentActivity
            items={dashboard.recentActivity}
            loading={loading}
          />
        </Panel>

        <Panel title="System Overview">
          <SystemOverview
            system={dashboard.system}
          />
        </Panel>
      </section>
    </section>
  );
}

function DashboardLineChart({ data }) {
  const width = 760;
  const height = 280;
  const padding = 34;

  const values = data.map((item) =>
    Number(item.activeUsers ?? 0),
  );

  const maximum = Math.max(...values, 1);

  const points = values
    .map((value, index) => {
      const x =
        padding +
        (index /
          Math.max(data.length - 1, 1)) *
          (width - padding * 2);

      const y =
        height -
        padding -
        (value / maximum) *
          (height - padding * 2);

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="super-dashboard-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="User activity trend"
      >
        {[0, 1, 2, 3].map((line) => {
          const y =
            padding +
            line *
              ((height - padding * 2) / 3);

          return (
            <line
              key={line}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              className="super-dashboard-chart__grid"
            />
          );
        })}

        <polyline
          points={points}
          fill="none"
          className="super-dashboard-chart__line"
        />

        {data.map((item, index) => {
          const [x, y] =
            points.split(" ")[index].split(",");

          return (
            <circle
              key={`${item.period}-${index}`}
              cx={x}
              cy={y}
              r="4"
              className="super-dashboard-chart__point"
            >
              <title>
                {item.period}:{" "}
                {item.activeUsers ?? 0}
              </title>
            </circle>
          );
        })}
      </svg>

      <div className="super-dashboard-chart__labels">
        {data.map((item, index) => (
          <span key={`${item.period}-${index}`}>
            {item.period}
          </span>
        ))}
      </div>
    </div>
  );
}

function WorkflowHotspots({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="super-dashboard__empty">
        No workflow bottleneck data is available.
      </div>
    );
  }

  return (
    <div className="workflow-hotspots">
      {items.map((item, index) => {
        const percentage = Math.min(
          Math.max(
            Number(
              item.percentage ??
                item.delay_percentage ??
                0,
            ),
            0,
          ),
          100,
        );

        return (
          <div
            className="workflow-hotspot"
            key={`${item.label}-${index}`}
          >
            <div>
              <strong>
                {item.label ||
                  item.stage ||
                  "Workflow stage"}
              </strong>

              <span>{percentage}% delay</span>
            </div>

            <div className="workflow-hotspot__track">
              <span
                style={{
                  width: `${percentage}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EfficiencyTable({
  rows = [],
  loading,
}) {
  return (
    <div className="efficiency-table-wrapper">
      <table className="efficiency-table">
        <thead>
          <tr>
            <th>Office / Department</th>
            <th>Active Agreements</th>
            <th>Avg Processing Time</th>
            <th>Compliance Rate</th>
            <th>Operational Status</th>
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan="5">
                Loading efficiency data...
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan="5">
                No efficiency data is available.
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row, index) => (
              <tr key={row.id ?? index}>
                <td>
                  {row.department ??
                    row.office ??
                    "-"}
                </td>

                <td>
                  {row.active_agreements ?? 0}
                </td>

                <td>
                  {row.average_processing_time ??
                    "-"}
                </td>

                <td>
                  {row.compliance_rate ?? "-"}
                </td>

                <td>
                  <span className="efficiency-status">
                    {row.status ?? "Unknown"}
                  </span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentActivity({
  items = [],
  loading,
}) {
  if (loading) {
    return <p>Loading activity...</p>;
  }

  if (!items.length) {
    return (
      <p className="super-dashboard__empty">
        No recent administrative activity.
      </p>
    );
  }

  return (
    <div className="super-dashboard-activity">
      {items.map((item, index) => (
        <article key={`${item.title}-${index}`}>
          <span />
          <div>
            <strong>{item.title}</strong>
            <p>
              {item.description ??
                item.detail ??
                ""}
            </p>
          </div>
          <small>{item.time ?? "-"}</small>
        </article>
      ))}
    </div>
  );
}

function SystemOverview({ system = {} }) {
  const rows = [
    [
      "Platform Status",
      system.platform_status ?? "Unknown",
    ],
    [
      "Database Status",
      system.database_status ?? "Unknown",
    ],
    [
      "Storage Usage",
      system.storage_usage ?? "Not tracked",
    ],
    [
      "Security Alerts",
      system.security_alerts ?? "0",
    ],
  ];

  return (
    <div className="system-overview">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function createEmptyDashboard() {
  return {
    stats: {},
    trend: normalizeTrend(),
    recentActivity: [],
    system: {},
    efficiency: [],
    hotspots: [],
  };
}

function normalizeTrend(trend = {}) {
  return {
    daily:
      Array.isArray(trend.daily) &&
      trend.daily.length
        ? trend.daily
        : createFallbackTrend(),

    weekly:
      Array.isArray(trend.weekly) &&
      trend.weekly.length
        ? trend.weekly
        : createFallbackTrend(),

    monthly:
      Array.isArray(trend.monthly) &&
      trend.monthly.length
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
  return String(
    Number.isFinite(Number(value))
      ? Number(value)
      : 0,
  ).padStart(2, "0");
}
