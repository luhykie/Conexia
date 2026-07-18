import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArchiveRestore,
  Building2,
  CalendarClock,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  FileText,
  HardDrive,
  KeyRound,
  Lock,
  Mail,
  MonitorCog,
  Paintbrush,
  Power,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import {
  ExportButton,
  FilterBar,
} from "../components/SharedViews";

import { departments } from "../data/departments";
import { seedUsers } from "../data/seedUsers";

/* ==========================================================================
   Super Admin Page Router
   ========================================================================== */

export function SuperAdmin({ page }) {
  if (page === "users") {
    return <UserManagement />;
  }

  if (page === "roles") {
    return <RoleManagement />;
  }

  if (page === "departments") {
    return <DepartmentManagement />;
  }

  if (page === "monitoring") {
    return <SystemMonitoring />;
  }

  if (page === "audit") {
    return <AuditLogs />;
  }

  if (page === "settings") {
    return <SystemSettings />;
  }

  return <SuperAdminDashboard />;
}

/* ==========================================================================
   Dashboard Data
   ========================================================================== */

const dashboardMetrics = {
  totalUsers: {
    label: "Total Users",
    icon: Users,
    color: "#007a52",
  },

  activeUsers: {
    label: "Active Users",
    icon: UserCheck,
    color: "#12b886",
  },

  activeDepartments: {
    label: "Active Departments",
    icon: Building2,
    color: "#df8b00",
  },

  activeSessions: {
    label: "Active Sessions",
    icon: Activity,
    color: "#4b56e8",
  },
};

const dashboardTrendData = {
  daily: [
    {
      period: "Mon",
      totalUsers: 110,
      activeUsers: 72,
      activeDepartments: 6,
      activeSessions: 24,
    },
    {
      period: "Tue",
      totalUsers: 112,
      activeUsers: 78,
      activeDepartments: 7,
      activeSessions: 31,
    },
    {
      period: "Wed",
      totalUsers: 114,
      activeUsers: 81,
      activeDepartments: 7,
      activeSessions: 29,
    },
    {
      period: "Thu",
      totalUsers: 116,
      activeUsers: 87,
      activeDepartments: 8,
      activeSessions: 35,
    },
    {
      period: "Fri",
      totalUsers: 119,
      activeUsers: 92,
      activeDepartments: 8,
      activeSessions: 42,
    },
    {
      period: "Sat",
      totalUsers: 120,
      activeUsers: 74,
      activeDepartments: 8,
      activeSessions: 27,
    },
    {
      period: "Sun",
      totalUsers: 121,
      activeUsers: 79,
      activeDepartments: 8,
      activeSessions: 30,
    },
  ],

  weekly: [
    {
      period: "Week 1",
      totalUsers: 94,
      activeUsers: 61,
      activeDepartments: 6,
      activeSessions: 19,
    },
    {
      period: "Week 2",
      totalUsers: 101,
      activeUsers: 67,
      activeDepartments: 6,
      activeSessions: 23,
    },
    {
      period: "Week 3",
      totalUsers: 108,
      activeUsers: 73,
      activeDepartments: 7,
      activeSessions: 26,
    },
    {
      period: "Week 4",
      totalUsers: 115,
      activeUsers: 82,
      activeDepartments: 8,
      activeSessions: 34,
    },
    {
      period: "Current",
      totalUsers: 121,
      activeUsers: 79,
      activeDepartments: 8,
      activeSessions: 30,
    },
  ],

  monthly: [
    {
      period: "Jan",
      totalUsers: 63,
      activeUsers: 41,
      activeDepartments: 5,
      activeSessions: 14,
    },
    {
      period: "Feb",
      totalUsers: 72,
      activeUsers: 48,
      activeDepartments: 5,
      activeSessions: 17,
    },
    {
      period: "Mar",
      totalUsers: 84,
      activeUsers: 56,
      activeDepartments: 6,
      activeSessions: 20,
    },
    {
      period: "Apr",
      totalUsers: 95,
      activeUsers: 65,
      activeDepartments: 6,
      activeSessions: 23,
    },
    {
      period: "May",
      totalUsers: 106,
      activeUsers: 71,
      activeDepartments: 7,
      activeSessions: 27,
    },
    {
      period: "Jun",
      totalUsers: 115,
      activeUsers: 82,
      activeDepartments: 8,
      activeSessions: 34,
    },
    {
      period: "Jul",
      totalUsers: 121,
      activeUsers: 79,
      activeDepartments: 8,
      activeSessions: 30,
    },
  ],
};

/* ==========================================================================
   Super Admin Dashboard
   ========================================================================== */

function SuperAdminDashboard() {
  const [selectedPeriod, setSelectedPeriod] =
    useState("daily");

  const [selectedMetrics, setSelectedMetrics] = useState([
    "activeUsers",
  ]);

  const currentData =
    dashboardTrendData[selectedPeriod];

  const latestEntry =
    currentData[currentData.length - 1];

  const previousEntry =
    currentData[currentData.length - 2];

  const comparisonLabels = {
    daily: "from yesterday",
    weekly: "from previous week",
    monthly: "from previous month",
  };

  function toggleMetric(metricKey) {
    setSelectedMetrics((currentMetrics) => {
      const isSelected =
        currentMetrics.includes(metricKey);
        
      if (isSelected && currentMetrics.length === 1) {
        return currentMetrics;
      }

      if (isSelected) {
        return currentMetrics.filter(
          (key) => key !== metricKey,
        );
      }

      return [...currentMetrics, metricKey];
    });
  }

  return (
    <section className="page super-admin-page">
      <PageTitle
        title="Super Admin Dashboard"
        subtitle="Monitor user accounts, departments, active sessions, system activity, and platform health."
      />

      <div className="super-dashboard-stats">
        {Object.entries(dashboardMetrics).map(
          ([metricKey, metric]) => {
            const Icon = metric.icon;

            const isSelected =
              selectedMetrics.includes(metricKey);

            const currentValue =
              latestEntry[metricKey];

            const previousValue =
              previousEntry[metricKey];

            const difference =
              currentValue - previousValue;

            return (
              <article
                key={metricKey}
                className={`super-stat-card ${
                  isSelected ? "selected" : "not-selected"
                }`}
                style={{
                  "--metric-color": metric.color,
                }}
              >
                <div className="super-stat-card-header">
                  <span className="super-stat-icon">
                    <Icon size={22} />
                  </span>
                </div>

                <span className="super-stat-label">
                  {metric.label}
                </span>

                <strong>{currentValue}</strong>

                <span
                  className={`super-stat-change ${
                    difference > 0
                      ? "increase"
                      : difference < 0
                        ? "decrease"
                        : "unchanged"
                  }`}
                >
                  {difference > 0 ? "+" : ""}
                  {difference}{" "}
                  {comparisonLabels[selectedPeriod]}
                </span>
              </article>
            );
          },
        )}
      </div>

      <Panel title="User Activity Overview">
        <div className="trend-toolbar">
          <div className="trend-period-filter">
            {["daily", "weekly", "monthly"].map(
              (period) => (
                <button
                  type="button"
                  key={period}
                  className={
                    selectedPeriod === period
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setSelectedPeriod(period)
                  }
                >
                  {period}
                </button>
              ),
            )}
          </div>

          <div className="trend-metric-filters">
            {Object.entries(dashboardMetrics).map(
              ([metricKey, metric]) => (
                <label key={metricKey}>
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(
                      metricKey,
                    )}
                    onChange={() =>
                      toggleMetric(metricKey)
                    }
                  />

                  <span
                    className="metric-color-dot"
                    style={{
                      backgroundColor: metric.color,
                    }}
                  />

                  {metric.label}
                </label>
              ),
            )}
          </div>
        </div>

        <AdminTrendChart
          data={currentData}
          selectedMetrics={selectedMetrics}
        />
      </Panel>

      <div className="dashboard-bottom-grid">
        <Panel title="Recent Administrative Activity">
          <div className="activity-list">
            <ActivityItem
              icon={UserPlus}
              title="New user account created"
              description="A Department Staff account was created by the Super Admin."
              time="10 minutes ago"
            />

            <ActivityItem
              icon={UserCog}
              title="Role permissions updated"
              description="The access permissions for the IRO Staff role were changed."
              time="45 minutes ago"
            />

            <ActivityItem
              icon={Building2}
              title="Department information updated"
              description="The School of Computer Studies department information was modified."
              time="2 hours ago"
            />
          </div>
        </Panel>

        <Panel title="System Overview">
          <div className="system-overview-list">
            <div>
              <span>Platform Status</span>
              <strong className="status-success">
                Operational
              </strong>
            </div>

            <div>
              <span>Database Status</span>
              <strong className="status-success">
                Connected
              </strong>
            </div>

            <div>
              <span>Storage Usage</span>
              <strong>42%</strong>
            </div>

            <div>
              <span>Security Alerts</span>
              <strong className="status-warning">
                2 warnings
              </strong>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function ActivityItem({
  icon: Icon,
  title,
  description,
  time,
}) {
  return (
    <div className="activity-item">
      <span className="activity-icon">
        <Icon size={18} />
      </span>

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <small>{time}</small>
    </div>
  );
}

/* ==========================================================================
   SVG Trend Chart
   ========================================================================== */

function AdminTrendChart({
  data,
  selectedMetrics,
}) {
  const chartWidth = 900;
  const chartHeight = 330;

  const padding = {
    top: 25,
    right: 30,
    bottom: 55,
    left: 55,
  };

  const drawableWidth =
    chartWidth - padding.left - padding.right;

  const drawableHeight =
    chartHeight - padding.top - padding.bottom;

  const maximumValue = useMemo(() => {
    const values = data.flatMap((entry) =>
      selectedMetrics.map(
        (metricKey) => entry[metricKey],
      ),
    );

    const highestValue = Math.max(...values, 1);

    return (
      Math.ceil((highestValue * 1.15) / 10) * 10
    );
  }, [data, selectedMetrics]);

  const horizontalGridLines = 5;

  function getX(index) {
    if (data.length === 1) {
      return padding.left + drawableWidth / 2;
    }

    return (
      padding.left +
      (index / (data.length - 1)) *
        drawableWidth
    );
  }

  function getY(value) {
    return (
      padding.top +
      drawableHeight -
      (value / maximumValue) * drawableHeight
    );
  }

  function createLinePoints(metricKey) {
    return data
      .map(
        (entry, index) =>
          `${getX(index)},${getY(
            entry[metricKey],
          )}`,
      )
      .join(" ");
  }

  return (
    <div className="admin-trend-chart">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Super Admin activity trend chart"
      >
        {Array.from(
          {
            length: horizontalGridLines + 1,
          },
          (_, index) => {
            const value =
              maximumValue -
              (maximumValue /
                horizontalGridLines) *
                index;

            const y =
              padding.top +
              (drawableHeight /
                horizontalGridLines) *
                index;

            return (
              <g key={`grid-${index}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={
                    chartWidth - padding.right
                  }
                  y2={y}
                  className="trend-grid-line"
                />

                <text
                  x={padding.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="trend-axis-label"
                >
                  {Math.round(value)}
                </text>
              </g>
            );
          },
        )}

        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          className="trend-axis-line"
        />

        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          className="trend-axis-line"
        />

        {data.map((entry, index) => (
          <text
            key={entry.period}
            x={getX(index)}
            y={
              chartHeight -
              padding.bottom +
              28
            }
            textAnchor="middle"
            className="trend-axis-label"
          >
            {entry.period}
          </text>
        ))}

        {selectedMetrics.map((metricKey) => {
          const metric =
            dashboardMetrics[metricKey];

          return (
            <g key={metricKey}>
              <polyline
                points={createLinePoints(metricKey)}
                fill="none"
                stroke={metric.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {data.map((entry, index) => (
                <circle
                  key={`${metricKey}-${entry.period}`}
                  cx={getX(index)}
                  cy={getY(entry[metricKey])}
                  r="5"
                  fill={metric.color}
                  className="trend-chart-point"
                >
                  <title>
                    {entry.period}: {metric.label} -{" "}
                    {entry[metricKey]}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="trend-chart-legend">
        {selectedMetrics.map((metricKey) => {
          const metric =
            dashboardMetrics[metricKey];

          return (
            <span key={metricKey}>
              <i
                style={{
                  backgroundColor: metric.color,
                }}
              />

              {metric.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   User Management
   ========================================================================== */

function UserManagement() {
  const [users, setUsers] = useState(
    seedUsers.map((user, index) => ({
      id: index + 1,
      ...user,
      status: "Active",
      lastLogin:
        index % 3 === 0
          ? "Today, 9:30 AM"
          : index % 3 === 1
            ? "Yesterday, 4:15 PM"
            : "July 17, 2026",
    })),
  );

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "Department Staff",
    department: departments[0]?.code || "",
  });

  const [openUserMenu, setOpenUserMenu] = useState(null);
  
  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function createUser() {
    if (!form.fullName.trim() || !form.email.trim()) {
      window.alert(
        "Please enter the user's full name and email address.",
      );

      return;
    }

    setUsers((current) => [
      ...current,
      {
        id: Date.now(),
        fullName: form.fullName,
        email: form.email.toLowerCase(),
        role: form.role,
        office:
          departments.find(
            (department) =>
              department.code === form.department,
          )?.name || form.department,
        department: form.department,
        status: "Active",
        lastLogin: "Never",
      },
    ]);

    setForm({
      fullName: "",
      email: "",
      role: "Department Staff",
      department: departments[0]?.code || "",
    });
  }

  function toggleUserStatus(userId) {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? {
              ...user,
              status:
                user.status === "Active"
                  ? "Inactive"
                  : "Active",
            }
          : user,
      ),
    );
  }

  const userRows = users.map((user) => [
    user.fullName,
    user.email.toLowerCase(),
    user.role,
    user.department || "-",
    user.status,
    user.lastLogin,
    <div
      className="user-table-actions"
      key={`actions-${user.id}`}
    >
      <button
        type="button"
        className="table-action"
      >
        <Edit3 size={15} />
        Edit
      </button>

      <button
        type="button"
        className="table-action"
        onClick={() =>
          toggleUserStatus(user.id)
        }
      >
        {user.status === "Active" ? (
          <UserMinus size={15} />
        ) : (
          <UserCheck size={15} />
        )}

        {user.status === "Active"
          ? "Deactivate"
          : "Activate"}
      </button>

      <button
        type="button"
        className="table-action"
      >
        <KeyRound size={15} />
        Reset
      </button>
    </div>,
  ]);

  return (
    <section className="page super-admin-page">
      <PageTitle
        title="User Management"
        subtitle="Create accounts, update user information, assign roles and departments, and control account access."
      />

      <div className="security-note">
        <Lock size={20} />

        Public registration is disabled. User accounts
        are created and managed by the Super Admin.
      </div>

      <Panel title="Create User">
        <div className="form-grid admin-form">
          <label>
            Full Name
            <input
              name="fullName"
              value={form.fullName}
              onChange={updateForm}
              placeholder="Enter full name"
            />
          </label>

          <label>
            Email Address
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={updateForm}
              placeholder="user@conexia.edu"
            />
          </label>

          <label>
            Role
            <select
              name="role"
              value={form.role}
              onChange={updateForm}
            >
              <option>Department Staff</option>
              <option>IRO Staff</option>
              <option>IRO Admin</option>
              <option>Legal Counsel</option>
              <option>Super Admin</option>
            </select>
          </label>

          <label>
            Department
            <select
              name="department"
              value={form.department}
              onChange={updateForm}
            >
              {departments.map((department) => (
                <option
                  key={department.code}
                  value={department.code}
                >
                  {department.code} -{" "}
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Temporary Password
            <input
              value="conexia123"
              readOnly
            />
          </label>
        </div>

        <div className="action-strip">
          <button
            type="button"
            className="primary"
            onClick={createUser}
          >
            <UserPlus size={18} />
            Create User
          </button>

          <span>
            The email address is automatically saved in
            lowercase.
          </span>
        </div>
      </Panel>

      <div className="user-management-table">
        <Panel title={`${users.length} User Accounts`}>
          <DataTable
            headers={[
              "Name",
              "Email Address",
              "Role",
              "Department",
              "Account Status",
              "Last Login",
              "Actions",
            ]}
            rows={userRows}
          />
        </Panel>
      </div>
    </section>
  );
}

/* ==========================================================================
   Role Management
   ========================================================================== */

const systemRoles = [
  {
    name: "Super Admin",
    description:
      "Manages users, roles, departments, settings, security, and platform maintenance.",
    accessLevel: "Full administration",
    users: 1,
    status: "Active",
  },
  {
    name: "IRO Admin",
    description:
      "Manages IRO operations, staff assignments, validations, and reports.",
    accessLevel: "Administrative operations",
    users: 2,
    status: "Active",
  },
  {
    name: "IRO Staff",
    description:
      "Handles incoming submissions and initial administrative processing.",
    accessLevel: "Operational access",
    users: 4,
    status: "Active",
  },
  {
    name: "Legal Counsel",
    description:
      "Performs legal review and records legal recommendations.",
    accessLevel: "Legal review access",
    users: 3,
    status: "Active",
  },
  {
    name: "Department Staff",
    description:
      "Represents a university department and manages its own submissions.",
    accessLevel: "Department access",
    users: 8,
    status: "Active",
  },
];

const permissionRows = [
  [
    "Manage Users",
    "Allowed",
    "Not Allowed",
    "Not Allowed",
    "Not Allowed",
    "Not Allowed",
  ],
  [
    "Manage Roles",
    "Allowed",
    "Not Allowed",
    "Not Allowed",
    "Not Allowed",
    "Not Allowed",
  ],
  [
    "Manage Departments",
    "Allowed",
    "View",
    "View",
    "View",
    "View Own",
  ],
  [
    "Configure System Settings",
    "Allowed",
    "Not Allowed",
    "Not Allowed",
    "Not Allowed",
    "Not Allowed",
  ],
  [
    "View Audit Logs",
    "Allowed",
    "Limited",
    "Not Allowed",
    "Limited",
    "Not Allowed",
  ],
  [
    "Access Partnership Documents",
    "Not Allowed",
    "Allowed",
    "Allowed",
    "Allowed",
    "Own Department",
  ],
];

function RoleManagement() {
  const [selectedRole, setSelectedRole] =
    useState(systemRoles[0]);

  return (
    <section className="page super-admin-page">
      <PageTitle
        title="Role Management"
        subtitle="View system roles, review the permission matrix, and manage role access levels."
        action="Add Custom Role"
      />

      <div className="role-management-grid">
        <Panel title="System Roles">
          <div className="role-management-list">
            {systemRoles.map((role) => (
              <button
                type="button"
                key={role.name}
                className={`role-management-item ${
                  selectedRole.name === role.name
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setSelectedRole(role)
                }
              >
                <span className="role-management-icon">
                  <Shield size={21} />
                </span>

                <span>
                  <strong>{role.name}</strong>
                  <small>{role.description}</small>
                </span>

                <span className="badge">
                  {role.status}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Selected Role">
          <div className="selected-role-details">
            <span className="selected-role-icon">
              <UserCog size={34} />
            </span>

            <h3>{selectedRole.name}</h3>

            <p>{selectedRole.description}</p>

            <div>
              <span>Access Level</span>
              <strong>
                {selectedRole.accessLevel}
              </strong>
            </div>

            <div>
              <span>Assigned Users</span>
              <strong>
                {selectedRole.users}
              </strong>
            </div>

            <button
              type="button"
              className="primary"
            >
              <Edit3 size={18} />
              Edit Role Permissions
            </button>
          </div>
        </Panel>
      </div>

      <Panel
        title="Permission Matrix"
        tools={
          <button
            type="button"
            className="outline"
          >
            <Save size={17} />
            Save Permissions
          </button>
        }
      >
        <DataTable
          headers={[
            "Permission",
            "Super Admin",
            "IRO Admin",
            "IRO Staff",
            "Legal Counsel",
            "Department Staff",
          ]}
          rows={permissionRows}
        />
      </Panel>

      <div className="permission-notice">
        <ShieldCheck size={22} />

        <div>
          <strong>
            Super Admin document restriction
          </strong>

          <p>
            The Super Admin can configure system roles
            and permissions but cannot access
            partnership documents or participate in
            document workflows.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   Department Management
   ========================================================================== */

function DepartmentManagement() {
  const [departmentList, setDepartmentList] =
    useState(
      departments.map((department, index) => ({
        ...department,
        office:
          index === 0
            ? "Business and Management Office"
            : department.name,
        staffCount: index + 2,
        status: "Active",
      })),
    );

  const [newDepartment, setNewDepartment] =
    useState({
      code: "",
      name: "",
      email: "",
      office: "",
    });

  function updateDepartmentForm(event) {
    const { name, value } = event.target;

    setNewDepartment((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function addDepartment() {
    if (
      !newDepartment.code.trim() ||
      !newDepartment.name.trim()
    ) {
      window.alert(
        "Please enter the department code and department name.",
      );

      return;
    }

    setDepartmentList((current) => [
      ...current,
      {
        ...newDepartment,
        code: newDepartment.code.toUpperCase(),
        email: newDepartment.email.toLowerCase(),
        staffCount: 0,
        status: "Active",
      },
    ]);

    setNewDepartment({
      code: "",
      name: "",
      email: "",
      office: "",
    });
  }

  function toggleDepartmentStatus(code) {
    setDepartmentList((current) =>
      current.map((department) =>
        department.code === code
          ? {
              ...department,
              status:
                department.status === "Active"
                  ? "Inactive"
                  : "Active",
            }
          : department,
      ),
    );
  }

  const rows = departmentList.map(
    (department) => [
      department.code,
      department.name,
      department.office || "-",
      department.email.toLowerCase(),
      department.staffCount,
      department.status,
      <div
        className="user-table-actions"
        key={`department-${department.code}`}
      >
        <button
          type="button"
          className="table-action"
        >
          <Edit3 size={15} />
          Edit
        </button>

        <button
          type="button"
          className="table-action"
        >
          <UserPlus size={15} />
          Assign Users
        </button>

        <button
          type="button"
          className="table-action"
          onClick={() =>
            toggleDepartmentStatus(
              department.code,
            )
          }
        >
          <Power size={15} />

          {department.status === "Active"
            ? "Deactivate"
            : "Activate"}
        </button>
      </div>,
    ],
  );

  return (
    <section className="page super-admin-page">
      <PageTitle
        title="Department Management"
        subtitle="Manage university departments, office assignments, staff membership, and account availability."
      />

      <div className="department-summary-grid">
        <article className="department-summary-card">
          <span className="department-summary-icon">
            <Building2 size={22} />
          </span>

          <span className="department-summary-label">
            Total Departments
          </span>

          <strong>{departmentList.length}</strong>

          <p>Total registered departments.</p>
        </article>

        <article className="department-summary-card">
          <span className="department-summary-icon">
            <CheckCircle2 size={22} />
          </span>

          <span className="department-summary-label">
            Active Departments
          </span>

          <strong>
            {
              departmentList.filter(
                (department) =>
                  department.status === "Active",
              ).length
            }
          </strong>

          <p>Departments currently available.</p>
        </article>

        <article className="department-summary-card">
          <span className="department-summary-icon">
            <Users size={22} />
          </span>

          <span className="department-summary-label">
            Assigned Staff
          </span>

          <strong>
            {departmentList.reduce(
              (total, department) =>
                total + Number(department.staffCount || 0),
              0,
            )}
          </strong>

          <p>Users assigned to departments.</p>
        </article>
      </div>

      <Panel title="Add Department">
        <div className="form-grid admin-form">
          <label>
            Department Code
            <input
              name="code"
              value={newDepartment.code}
              onChange={updateDepartmentForm}
              placeholder="Example: SCS"
            />
          </label>

          <label>
            Department Name
            <input
              name="name"
              value={newDepartment.name}
              onChange={updateDepartmentForm}
              placeholder="Enter department name"
            />
          </label>

          <label>
            Office Assignment
            <input
              name="office"
              value={newDepartment.office}
              onChange={updateDepartmentForm}
              placeholder="Enter office name"
            />
          </label>

          <label>
            Department Email
            <input
              name="email"
              type="email"
              value={newDepartment.email}
              onChange={updateDepartmentForm}
              placeholder="department@conexia.edu"
            />
          </label>
        </div>

        <div className="action-strip">
          <button
            type="button"
            className="primary"
            onClick={addDepartment}
          >
            <Building2 size={18} />
            Add Department
          </button>
        </div>
      </Panel>

      <Panel title="Department List">
        <DataTable
          headers={[
            "Code",
            "Department Name",
            "Office Assignment",
            "Email Address",
            "Staff Count",
            "Status",
            "Actions",
          ]}
          rows={rows}
        />
      </Panel>
    </section>
  );
}

/* ==========================================================================
   System Monitoring
   ========================================================================== */

function SystemMonitoring() {
  return (
    <section className="page super-admin-page">
      <PageTitle
        title="System Monitoring"
        subtitle="Monitor active sessions, authentication failures, database connectivity, storage usage, and security alerts."
        action="Refresh Status"
      />

      <div className="monitoring-status-grid">
        <article className="monitoring-status-card">
          <Server size={24} />
          <span>System Status</span>
          <strong>Operational</strong>
          <small>
            All application services are running.
          </small>
        </article>

        <article className="monitoring-status-card">
          <Database size={24} />
          <span>Database Status</span>
          <strong>Connected</strong>
          <small>
            Supabase PostgreSQL is responding normally.
          </small>
        </article>

        <article className="monitoring-status-card">
          <HardDrive size={24} />
          <span>Storage Usage</span>
          <strong>42%</strong>
          <small>
            8.4 GB used from 20 GB available.
          </small>
        </article>

        <article className="monitoring-status-card warning">
          <AlertTriangle size={24} />
          <span>Security Alerts</span>
          <strong>2</strong>
          <small>
            Two alerts require administrative review.
          </small>
        </article>
      </div>

      <Panel title="Active User Sessions">
        <DataTable
          headers={[
            "User",
            "Role",
            "IP Address",
            "Device",
            "Login Time",
            "Last Activity",
            "Status",
          ]}
          rows={[
            [
              "System Administrator",
              "Super Admin",
              "192.168.1.11",
              "Windows / Chrome",
              "Today, 8:30 AM",
              "2 minutes ago",
              "Active",
            ],
            [
              "IRO Administrator",
              "IRO Admin",
              "192.168.1.18",
              "Windows / Edge",
              "Today, 8:42 AM",
              "5 minutes ago",
              "Active",
            ],
            [
              "SCS Department Staff",
              "Department Staff",
              "192.168.1.25",
              "Android / Chrome",
              "Today, 9:05 AM",
              "1 minute ago",
              "Active",
            ],
          ]}
        />
      </Panel>

      <Panel title="Failed Login Attempts">
        <DataTable
          headers={[
            "Email Address",
            "IP Address",
            "Date and Time",
            "Failure Reason",
            "Attempts",
            "Status",
          ]}
          rows={[
            [
              "unknown@conexia.com",
              "192.168.1.41",
              "Today, 7:14 AM",
              "Invalid password",
              "5",
              "Temporarily blocked",
            ],
            [
              "staff@conexia.com",
              "192.168.1.52",
              "Yesterday, 6:32 PM",
              "Inactive account",
              "2",
              "Access denied",
            ],
          ]}
        />
      </Panel>

      <section className="dark-card">
        <ShieldCheck size={42} />

        <div>
          <h2>System Integrity Status</h2>

          <p>
            Platform uptime is 99.998%. Security checks
            passed. Last complete health check was 14
            minutes ago.
          </p>
        </div>
      </section>
    </section>
  );
}

/* ==========================================================================
   Audit Logs
   ========================================================================== */

function AuditLogs() {
  const [activityFilter, setActivityFilter] =
    useState("All Activities");

  const auditRows = [
    [
      "2026-07-19 14:22",
      "System Administrator",
      "Super Admin",
      "User Account Change",
      "Deactivated user@conexia.com",
      "192.168.1.11",
      "Verified",
    ],
    [
      "2026-07-19 13:45",
      "System Administrator",
      "Super Admin",
      "Role Change",
      "Updated IRO Staff permissions",
      "192.168.1.11",
      "Verified",
    ],
    [
      "2026-07-19 12:30",
      "System Administrator",
      "Super Admin",
      "Department Change",
      "Updated SCS department",
      "192.168.1.11",
      "Verified",
    ],
    [
      "2026-07-19 10:18",
      "Unknown User",
      "Unknown",
      "Login History",
      "Failed login attempt",
      "192.168.1.41",
      "Flagged",
    ],
    [
      "2026-07-18 16:50",
      "System Administrator",
      "Super Admin",
      "Administrative Activity",
      "Enabled maintenance notification",
      "192.168.1.11",
      "Verified",
    ],
  ];

  const filteredRows =
    activityFilter === "All Activities"
      ? auditRows
      : auditRows.filter(
          (row) => row[3] === activityFilter,
        );

  return (
    <section className="page super-admin-page">
      <PageTitle
        title="Audit Logs"
        subtitle="Review login history, account changes, role changes, department changes, and administrative activities."
        action="Refresh Logs"
      />

      <div className="stats-grid">
        <article className="stat-card">
          <CalendarClock />
          <span>Activity</span>
          <strong>14%</strong>
          <p>
            Increase in administrative activity.
          </p>
        </article>

        <article className="stat-card danger">
          <ShieldCheck />
          <span>Flagged</span>
          <strong>1</strong>
          <p>
            Suspicious authentication event detected.
          </p>
        </article>

        <article className="stat-card">
          <FileText />
          <span>Integrity</span>
          <strong>Valid</strong>
          <p>
            All displayed audit logs are verified.
          </p>
        </article>
      </div>

      <div className="audit-filter-bar">
        <label>
          User
          <select>
            <option>All Users</option>
            <option>System Administrator</option>
            <option>IRO Administrator</option>
            <option>Department Staff</option>
          </select>
        </label>

        <label>
          Role
          <select>
            <option>All Roles</option>
            <option>Super Admin</option>
            <option>IRO Admin</option>
            <option>IRO Staff</option>
            <option>Legal Counsel</option>
            <option>Department Staff</option>
          </select>
        </label>

        <label>
          Date
          <input type="date" />
        </label>

        <label>
          Activity Type
          <select
            value={activityFilter}
            onChange={(event) =>
              setActivityFilter(
                event.target.value,
              )
            }
          >
            <option>All Activities</option>
            <option>Login History</option>
            <option>User Account Change</option>
            <option>Role Change</option>
            <option>Department Change</option>
            <option>
              Administrative Activity
            </option>
          </select>
        </label>
      </div>

      <Panel
        title={`${filteredRows.length} Audit Entries`}
        tools={<ExportButton label="Export CSV" />}
      >
        <DataTable
          headers={[
            "Timestamp",
            "User",
            "Role",
            "Activity Type",
            "Activity Details",
            "IP Address",
            "Status",
          ]}
          rows={filteredRows}
        />
      </Panel>
    </section>
  );
}

/* ==========================================================================
   System Settings
   ========================================================================== */

function SystemSettings() {
  const [settings, setSettings] = useState({
    universityName:
      "University of San Jose-Recoletos",
    systemName: "CONEXIA",
    primaryColor: "#004629",
    passwordLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSymbol: false,
    sessionTimeout: 30,
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpEmail: "noreply@conexia.edu",
    maintenanceMode: false,
    twoFactorAuthentication: false,
    loginAttemptLimit: 5,
  });

  function updateSetting(event) {
    const { name, value, type, checked } =
      event.target;

    setSettings((current) => ({
      ...current,
      [name]:
        type === "checkbox" ? checked : value,
    }));
  }

  function saveSettings() {
    window.alert(
      "System settings saved successfully.",
    );
  }

  return (
    <section className="page super-admin-page">
      <PageTitle
        title="System Settings"
        subtitle="Configure university branding, passwords, sessions, email, maintenance, backups, and security."
      />

      <div className="settings-layout">
        <SettingsSection
          icon={Paintbrush}
          title="University Branding"
          description="Configure the university and platform identity."
        >
          <div className="settings-form-grid">
            <label>
              University Name
              <input
                name="universityName"
                value={settings.universityName}
                onChange={updateSetting}
              />
            </label>

            <label>
              System Name
              <input
                name="systemName"
                value={settings.systemName}
                onChange={updateSetting}
              />
            </label>

            <label>
              Primary Color
              <input
                name="primaryColor"
                type="color"
                value={settings.primaryColor}
                onChange={updateSetting}
              />
            </label>

            <label>
              University Logo
              <input type="file" />
            </label>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={KeyRound}
          title="Password Policy"
          description="Set the required password strength for user accounts."
        >
          <div className="settings-form-grid">
            <label>
              Minimum Password Length
              <input
                name="passwordLength"
                type="number"
                min="6"
                value={settings.passwordLength}
                onChange={updateSetting}
              />
            </label>

            <ToggleSetting
              name="requireUppercase"
              checked={settings.requireUppercase}
              onChange={updateSetting}
              title="Require uppercase letter"
              description="Passwords must contain at least one uppercase letter."
            />

            <ToggleSetting
              name="requireNumber"
              checked={settings.requireNumber}
              onChange={updateSetting}
              title="Require number"
              description="Passwords must contain at least one number."
            />

            <ToggleSetting
              name="requireSymbol"
              checked={settings.requireSymbol}
              onChange={updateSetting}
              title="Require special character"
              description="Passwords must contain at least one symbol."
            />
          </div>
        </SettingsSection>

        <SettingsSection
          icon={CalendarClock}
          title="Session Timeout"
          description="Control how long inactive users remain signed in."
        >
          <div className="settings-form-grid">
            <label>
              Inactivity Timeout in Minutes
              <input
                name="sessionTimeout"
                type="number"
                min="5"
                value={settings.sessionTimeout}
                onChange={updateSetting}
              />
            </label>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Mail}
          title="Email SMTP Configuration"
          description="Configure the mail server used for account and system notifications."
        >
          <div className="settings-form-grid">
            <label>
              SMTP Host
              <input
                name="smtpHost"
                value={settings.smtpHost}
                onChange={updateSetting}
              />
            </label>

            <label>
              SMTP Port
              <input
                name="smtpPort"
                value={settings.smtpPort}
                onChange={updateSetting}
              />
            </label>

            <label>
              Sender Email
              <input
                name="smtpEmail"
                type="email"
                value={settings.smtpEmail}
                onChange={updateSetting}
              />
            </label>

            <label>
              SMTP Password
              <input
                type="password"
                placeholder="Enter SMTP password"
              />
            </label>
          </div>

          <button
            type="button"
            className="outline settings-inline-button"
          >
            <Mail size={17} />
            Send Test Email
          </button>
        </SettingsSection>

        <SettingsSection
          icon={MonitorCog}
          title="Maintenance Mode"
          description="Temporarily restrict user access while system maintenance is performed."
        >
          <ToggleSetting
            name="maintenanceMode"
            checked={settings.maintenanceMode}
            onChange={updateSetting}
            title="Enable maintenance mode"
            description="Only Super Admin accounts will be able to access the platform."
          />
        </SettingsSection>

        <SettingsSection
          icon={ArchiveRestore}
          title="Backup and Recovery"
          description="Create, download, and restore system backups."
        >
          <div className="backup-actions">
            <button
              type="button"
              className="primary"
            >
              <Download size={18} />
              Create Backup
            </button>

            <button
              type="button"
              className="outline"
            >
              <ArchiveRestore size={18} />
              Restore Backup
            </button>
          </div>

          <DataTable
            headers={[
              "Backup Date",
              "Backup Type",
              "Size",
              "Created By",
              "Status",
            ]}
            rows={[
              [
                "July 19, 2026 - 2:00 AM",
                "Automatic",
                "428 MB",
                "System",
                "Completed",
              ],
              [
                "July 18, 2026 - 4:35 PM",
                "Manual",
                "421 MB",
                "System Administrator",
                "Completed",
              ],
            ]}
          />
        </SettingsSection>

        <SettingsSection
          icon={ShieldCheck}
          title="Security Settings"
          description="Configure authentication and account protection controls."
        >
          <div className="settings-form-grid">
            <ToggleSetting
              name="twoFactorAuthentication"
              checked={
                settings.twoFactorAuthentication
              }
              onChange={updateSetting}
              title="Require two-factor authentication"
              description="Require additional verification for administrative accounts."
            />

            <label>
              Failed Login Attempt Limit
              <input
                name="loginAttemptLimit"
                type="number"
                min="3"
                value={settings.loginAttemptLimit}
                onChange={updateSetting}
              />
            </label>
          </div>
        </SettingsSection>
      </div>

      <div className="settings-save-bar">
        <div>
          <strong>
            Save system configuration
          </strong>

          <p>
            Apply the updated configuration to the
            CONEXIA platform.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={saveSettings}
        >
          <Save size={18} />
          Save All Changes
        </button>
      </div>
    </section>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}) {
  return (
    <section className="settings-section">
      <header>
        <span>
          <Icon size={22} />
        </span>

        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      <div className="settings-section-content">
        {children}
      </div>
    </section>
  );
}

function ToggleSetting({
  name,
  checked,
  onChange,
  title,
  description,
}) {
  return (
    <label className="setting-toggle-row">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>

      <input
        name={name}
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
}