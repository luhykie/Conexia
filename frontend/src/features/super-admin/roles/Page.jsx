import React, {
  useEffect,
  useState,
} from "react";
import {
  Lock,
  Save,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import {
  getRoleSettings,
  saveRoleSettings,
} from "../../../services/superAdminService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

const permissionCopy = {
  governance: ["Governance", "Access system governance areas."],
  document_contents: ["Documents", "Read supported document records."],
  files: ["Files", "Access supported document file operations."],
  workflow: ["Workflow", "Perform supported workflow actions."],
  assign_legal: ["Assign Legal", "Assign Legal Counsel where allowed."],
  user_management: ["User Management", "Manage supported user operations."],
  department_management: ["Department Management", "Manage department directory entries."],
  audit_logs: ["Audit Logs", "View and export administrative audit logs."],
  system_monitoring: ["System Monitoring", "View system monitoring information."],
};

export default function Page() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [draftPermissions, setDraftPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadRoles() {
    setLoading(true);
    setError("");

    try {
      setRoles(await getRoleSettings());
    } catch (requestError) {
      reportClientError("Unable to load role settings:", requestError);
      setError(requestError.message || "Unable to load role settings.");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoles();
  }, []);

  function openRole(role) {
    setSelectedRole(role);
    setDraftPermissions(role.permissions || {});
    setError("");
    setSuccess("");
  }

  function closeRole() {
    setSelectedRole(null);
    setDraftPermissions({});
  }

  function togglePermission(key) {
    setDraftPermissions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function saveRole() {
    if (!selectedRole) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const permissions = roles.reduce((map, role) => ({
        ...map,
        [role.role]: role.role === selectedRole.role
          ? draftPermissions
          : role.permissions,
      }), {});

      const updatedRoles = await saveRoleSettings(permissions);
      setRoles(updatedRoles);
      setSelectedRole(
        updatedRoles.find((role) => role.role === selectedRole.role) ?? null,
      );
      setSuccess("Role permissions saved.");
    } catch (requestError) {
      reportClientError("Unable to save role settings:", requestError);
      setError(requestError.message || "Unable to save role settings.");
    } finally {
      setSaving(false);
    }
  }

  const rows = roles.map((role) => [
    role.label,
    role.purpose,
    role.scope,
    <span
      key={`level-${role.role}`}
      className={`badge ${role.access_level === "Protected" ? "warn" : "active"}`}
    >
      {role.access_level}
    </span>,
    <button
      key={`manage-${role.role}`}
      type="button"
      className="table-action"
      onClick={() => openRole(role)}
    >
      Manage
    </button>,
  ]);

  return (
    <section className="super-admin-page">
      <PageTitle
        title="Role Management"
        subtitle="Manage role access levels and protected system permissions."
      />

      <section className="super-admin-stats">
        <article>
          <ShieldCheck size={22} />
          <strong>{loading ? "-" : String(roles.length).padStart(2, "0")}</strong>
          <span>Configured Roles</span>
        </article>
        <article>
          <Lock size={22} />
          <strong>{loading ? "-" : roles.filter((role) => role.access_level === "Protected").length}</strong>
          <span>Protected Roles</span>
        </article>
        <article>
          <Users size={22} />
          <strong>{loading ? "-" : roles.filter((role) => role.access_level === "Managed").length}</strong>
          <span>Managed Roles</span>
        </article>
      </section>

      <Panel title="Role Access Levels">
        {loading && <p>Loading role permissions...</p>}
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        {!loading && !error && roles.length === 0 && (
          <p>No role permissions are available.</p>
        )}
        {!loading && !error && roles.length > 0 && (
          <DataTable
            headers={["Role", "Purpose", "Scope", "Access Level", "Actions"]}
            rows={rows}
          />
        )}
      </Panel>

      {selectedRole && (
        <RoleEditor
          role={selectedRole}
          permissions={draftPermissions}
          saving={saving}
          onClose={closeRole}
          onSave={saveRole}
          onToggle={togglePermission}
        />
      )}
    </section>
  );
}

function RoleEditor({
  role,
  permissions,
  saving,
  onClose,
  onSave,
  onToggle,
}) {
  const locked = new Set(role.locked || []);

  return (
    <div className="role-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="role-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="role-editor-title">Edit Role</h2>
            <p>Protected permissions are locked by system policy.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="role-detail-grid">
          <span>Role Name<b>{role.label}</b></span>
          <span>Purpose<b>{role.purpose}</b></span>
          <span>Access Level<b>{role.access_level}</b></span>
        </div>

        <div className="permission-grid">
          {Object.entries(permissionCopy).map(([key, [label, description]]) => {
            const isLocked = locked.has(key);

            return (
              <label
                key={key}
                className={`permission-row ${isLocked ? "locked" : ""}`}
                title={isLocked ? "Protected by system policy" : undefined}
              >
                <input
                  type="checkbox"
                  checked={Boolean(permissions[key])}
                  disabled={saving || isLocked}
                  onChange={() => onToggle(key)}
                />
                <span>
                  <strong>
                    {label}
                    {isLocked && <Lock size={13} />}
                  </strong>
                  <small>
                    {isLocked ? "Protected by system policy" : description}
                  </small>
                </span>
              </label>
            );
          })}
        </div>

        <footer>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onSave} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </footer>
      </section>
    </div>
  );
}
