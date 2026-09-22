// Dashboard page: ipakita ang high-level system ug role summary para sa admin.
import React, { useEffect, useState } from "react";
import {
  Building2,
  Database,
  HardDrive,
  ShieldAlert,
  ShieldCheck,
  Server,
  UserCheck,
  Users,
  Lock,
} from "lucide-react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { getSuperAdminDashboard } from "../../../services/dashboardService";
import { getRoleSettings } from "../../../services/superAdminService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

// I-render ang super-admin dashboard ug i-sync ang summary cards.
export default function Page() {
  const [dashboard, setDashboard] = useState(createEmptyDashboard());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    // I-load gikan sa backend ang dashboard metrics ug role summary.
    async function loadDashboard() {
      setLoading(true);
      setErrorMessage("");

      try {
        const [response, roles] = await Promise.all([
          getSuperAdminDashboard(),
          getRoleSettings(),
        ]);
        const data =
          response.dashboard ??
          response.data?.dashboard ??
          response.data ??
          {};

        if (active) {
          setDashboard({
            stats: data.stats ?? {},
            offices: data.offices ?? data.departments ?? [],
            system: data.system ?? {},
            roles: Array.isArray(roles) ? roles : [],
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

  const currentStats = dashboard.stats;

  return (
    <section className="super-page">
      <PageTitle
        title="Super Admin Dashboard"
        subtitle="Monitor users, departments, roles, and system health."
      />

      {errorMessage && (
        <div className="super-alert">
          <ShieldAlert size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section className="super-overview">
        <div className="super-overview__main">
          <section className="super-stat-grid">
            {[
              ["Total Users", currentStats.totalUsers, Users],
              ["Active Users", currentStats.activeUsers, UserCheck],
              ["Active Departments", currentStats.activeDepartments, Building2],
            ].map(([label, value, Icon]) => (
              <article className="super-stat" key={label}>
                <Icon size={22} />
                <strong>{loading ? "-" : formatCount(value)}</strong>
                <p>{label}</p>
              </article>
            ))}
          </section>
          <section className="super-role-summary">
            <h2>Role Configuration</h2>
            <div className="super-role-summary__stats">
              <article>
                <ShieldCheck size={20} />
                <strong>{loading ? "-" : formatCount(dashboard.roles.length)}</strong>
                <span>Configured Roles</span>
              </article>
              <article>
                <Lock size={20} />
                <strong>
                  {loading
                    ? "-"
                    : dashboard.roles.filter((role) => role.access_level === "Protected").length}
                </strong>
                <span>Protected Roles</span>
              </article>
              <article>
                <Users size={20} />
                <strong>
                  {loading
                    ? "-"
                    : dashboard.roles.filter((role) => role.access_level === "Managed").length}
                </strong>
                <span>Managed Roles</span>
              </article>
            </div>
          </section>
        </div>
        <Panel title="System Overview" className="super-system-card">
          <div className="super-list">
            {[
              ["Platform Status", dashboard.system.platform_status ?? "Unknown", Server],
              ["Database Status", dashboard.system.database_status ?? "Unknown", Database],
              ["Storage Usage", dashboard.system.storage_usage ?? "Not tracked", HardDrive],
              ["Security Alerts", dashboard.system.security_alerts ?? "0 warnings", ShieldCheck],
            ].map(([label, value, Icon]) => (
              <div className="super-list__item" key={label}>
                <Icon size={20} />
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
          <article className="super-activity super-department" key={`${office.code}-${office.name}`}>
            <Building2 size={20} />
            <div className="super-department__details">
              <strong>{office.code || "N/A"} - {office.name || "Unassigned"}</strong>
              <small>{formatCount(office.activeUsers)} active users</small>
            </div>
          </article>
        ))}
      </Panel>
    </section>
  );
}

// Himoa ang default empty dashboard state para limpyo ang first load.
function createEmptyDashboard() {
  return {
    stats: {},
    offices: [],
    system: {},
    roles: [],
  };
}

// I-format ang count value para limpyo tan-awon sa summary cards.
function formatCount(value) {
  return String(Number.isFinite(Number(value)) ? Number(value) : 0).padStart(2, "0");
}
