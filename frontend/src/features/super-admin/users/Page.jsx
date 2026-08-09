import React, {
  useEffect,
  useState,
} from "react";
import {
  RefreshCw,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import { getDepartments } from "../../../services/departmentService";
import {
  getUsers,
  createUser,
  toggleUserStatus,
} from "../../../services/userService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function Page() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    role: "department_staff",
    department_id: "",
    is_active: true,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const [userResponse, departmentResponse] = await Promise.all([
        getUsers({ page }),
        getDepartments({ per_page: 100 }),
      ]);

      setUsers(userResponse.data ?? userResponse.users ?? []);
      setDepartments(departmentResponse.data ?? []);
      setMeta(userResponse.meta ?? null);
    } catch (requestError) {
      reportClientError("Unable to load Super Admin users:", requestError);
      setError(requestError.message || "Unable to load users.");
      setUsers([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [page]);

  async function changeStatus(user) {
    if (!user?.id) return;

    setProcessingId(user.id);
    setError("");
    setSuccess("");

    try {
      const updatedUser = await toggleUserStatus(user.id, !user.is_active);

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? updatedUser
            : currentUser,
        ),
      );
      setSuccess("User status updated.");
    } catch (requestError) {
      reportClientError("Unable to update user status:", requestError);
      setError(requestError.message || "Unable to update user status.");
    } finally {
      setProcessingId(null);
    }
  }

  async function submitNewUser(event) {
    event.preventDefault();

    const payload = {
      ...newUser,
      full_name: newUser.full_name.trim(),
      email: newUser.email.trim().toLowerCase(),
      department_id:
        newUser.role === "department_staff"
          ? newUser.department_id
          : null,
    };

    if (!payload.full_name) {
      setError("Full name is required.");
      return;
    }

    if (!payload.email) {
      setError("Email is required.");
      return;
    }

    if (payload.role === "department_staff" && !payload.department_id) {
      setError("Department Staff must be assigned to a department.");
      return;
    }

    setCreating(true);
    setError("");
    setSuccess("");

    try {
      await createUser(payload);

      setNewUser({
        full_name: "",
        email: "",
        role: "department_staff",
        department_id: "",
        is_active: true,
      });
      setShowCreateForm(false);
      setSuccess("User created successfully.");
      await loadUsers();
    } catch (requestError) {
      reportClientError("Unable to create user:", requestError);
      setError(requestError.message || "Unable to create user.");
    } finally {
      setCreating(false);
    }
  }

  function updateNewUser(event) {
    const { name, value, type, checked } = event.target;

    setNewUser((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "role" && value !== "department_staff"
        ? { department_id: "" }
        : {}),
    }));
    setError("");
  }

  const departmentCount = departments.length;
  const activeCount = users.filter((user) => user.is_active).length;

  const rows = users.map((user) => [
    user.fullName || user.full_name || user.name || "-",
    user.email || "-",
    user.roleLabel || formatRole(user.role),
    user.departmentName || user.department?.name || "-",
    user.is_active ? "Active" : "Inactive",
    <button
      type="button"
      className="table-action"
      key={`status-${user.id}`}
      disabled={processingId === user.id}
      onClick={() => changeStatus(user)}
    >
      {processingId === user.id
        ? "Saving..."
        : user.is_active
          ? "Deactivate"
          : "Activate"}
    </button>,
  ]);

  return (
    <section className="super-admin-page">
      <PageTitle
        title="User Management"
        subtitle="Review CONEXIA user accounts, roles, department assignments, and account status."
      >
        <Button icon={UserPlus} onClick={() => setShowCreateForm((value) => !value)}>
          {showCreateForm ? "Close Form" : "Add User"}
        </Button>
      </PageTitle>

      <section className="super-admin-stats">
        <article>
          <Users size={22} />
          <strong>{loading ? "-" : users.length}</strong>
          <span>Total Loaded Users</span>
        </article>
        <article>
          <UserPlus size={22} />
          <strong>{loading ? "-" : activeCount}</strong>
          <span>Active Users</span>
        </article>
        <article>
          <RefreshCw size={22} />
          <strong>{loading ? "-" : departmentCount}</strong>
          <span>Departments Loaded</span>
        </article>
      </section>

      <Panel title="User Directory">
        {showCreateForm && (
          <form className="admin-inline-form" onSubmit={submitNewUser}>
            <label>
              Full Name
              <input
                name="full_name"
                value={newUser.full_name}
                onChange={updateNewUser}
                disabled={creating}
                required
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                value={newUser.email}
                onChange={updateNewUser}
                disabled={creating}
                required
              />
            </label>
            <label>
              Role
              <select
                name="role"
                value={newUser.role}
                onChange={updateNewUser}
                disabled={creating}
              >
                <option value="department_staff">Department Staff</option>
                <option value="iro_staff">IRO Staff</option>
                <option value="iro_admin">IRO Admin</option>
                <option value="legal_counsel">Legal Counsel</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </label>
            <label>
              Department
              <select
                name="department_id"
                value={newUser.department_id}
                onChange={updateNewUser}
                disabled={creating || newUser.role !== "department_staff"}
                required={newUser.role === "department_staff"}
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.code} - {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-checkbox">
              <input
                name="is_active"
                type="checkbox"
                checked={newUser.is_active}
                onChange={updateNewUser}
                disabled={creating}
              />
              Active account
            </label>
            <div className="admin-form-actions">
              <button type="button" onClick={() => setShowCreateForm(false)} disabled={creating}>
                Cancel
              </button>
              <button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        )}
        {loading && <p>Loading users...</p>}
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        {!loading && !error && rows.length === 0 && (
          <p>No users are available.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={["Name", "Email", "Role", "Department", "Status", "Action"]}
            rows={rows}
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>
    </section>
  );
}

function formatRole(role) {
  return String(role || "-")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
