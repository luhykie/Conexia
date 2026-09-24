// User page: i-review ang accounts, i-manage ang status, ug himoa ang department-based users.
import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  RefreshCw,
  Trash2,
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
  deleteUser,
  toggleUserStatus,
} from "../../../services/userService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

// I-render ang user directory uban sa stats summary ug create form.
export default function Page() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const creatingRequestRef = useRef(false);
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

  // I-load ang user list ug department map para sa directory view.
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

  // I-toggle ang active state sa napiling user ug i-sync ang table.
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
      // Success text is intentionally suppressed; the refreshed row is sufficient feedback.
    } catch (requestError) {
      reportClientError("Unable to update user status:", requestError);
      setError(requestError.message || "Unable to update user status.");
    } finally {
      setProcessingId(null);
    }
  }

  // Requires an explicit confirmation before permanently removing a profile.
  async function confirmDeleteUser() {
    if (!deletingUser?.id) return;

    setProcessingId(deletingUser.id);
    setError("");
    setSuccess("");

    try {
      await deleteUser(deletingUser.id);
      setDeletingUser(null);
      // Success text is intentionally suppressed; the refreshed table is sufficient feedback.
      await loadUsers();
    } catch (requestError) {
      reportClientError("Unable to delete user:", requestError);
      setError(requestError.message || "Unable to delete user.");
    } finally {
      setProcessingId(null);
    }
  }

  // I-validate ang payload ug himoa ang bag-ong user pinaagi sa API.
  async function submitNewUser(event) {
    // The form submit event is the single submission path; this ref also blocks
    // rapid clicks before React can re-render the disabled button.
    if (creatingRequestRef.current) return;
    creatingRequestRef.current = true;
    event.preventDefault();
    setCreating(true);
    // Clear stale error and refresh user list on success — previously a leftover error from an earlier failed attempt could remain visible even after a later attempt succeeded, and the new user required a manual refresh to appear.
    setError("");
    setSuccess("");

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
      creatingRequestRef.current = false;
      setCreating(false);
      return;
    }

    if (!payload.email) {
      setError("Email is required.");
      creatingRequestRef.current = false;
      setCreating(false);
      return;
    }

    if (payload.role === "department_staff" && !payload.department_id) {
      // Kinahanglan og valid department link ang department staff una dawaton sa API ang record.
      setError("Department Staff must be assigned to a department.");
      creatingRequestRef.current = false;
      setCreating(false);
      return;
    }

    try {
      await createUser(payload);

      setError("");
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
      // User-facing errors must never expose SQL, stack traces, or connection details.
      const message = requestError.message || "";
      const isSafeMessage =
        message.length <= 160 &&
        !/sqlstate|select |insert |update |delete |pgsql|postgres|connection:|stack trace|exception/i.test(message);
      setError(
        isSafeMessage && message
          ? message
          : "Something went wrong. Please try again.",
      );
    } finally {
      creatingRequestRef.current = false;
      setCreating(false);
    }
  }

  // I-update ang create-user form fields ug tangtanga ang validation error kung mausab.
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
    <div className="user-table-actions" key={`actions-${user.id}`}>
      <button
        type="button"
        className="table-action"
        disabled={processingId === user.id}
        onClick={() => changeStatus(user)}
      >
        {processingId === user.id ? "Saving..." : user.is_active ? "Deactivate" : "Activate"}
      </button>
      <button
        type="button"
        className="table-action user-delete-action"
        disabled={processingId === user.id}
        onClick={() => setDeletingUser(user)}
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>,
  ]);

  return (
    <section className="super-admin-page user-management-table">
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
            columnClasses={["", "", "", "", "", "action-column-header"]}
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>

      {deletingUser && (
        <div className="role-modal-backdrop" role="presentation" onClick={() => setDeletingUser(null)}>
          <section className="role-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2 id="delete-user-title">Delete User</h2>
                <p>This will permanently delete this user's account and login access. This cannot be undone.</p>
              </div>
            </header>
            <footer>
              <button type="button" onClick={() => setDeletingUser(null)} disabled={processingId === deletingUser.id}>Cancel</button>
              <button type="button" className="primary danger" onClick={confirmDeleteUser} disabled={processingId === deletingUser.id}>
                {processingId === deletingUser.id ? "Deleting..." : "Delete Permanently"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

// I-normalize ang role labels para sa table ug user display.
function formatRole(role) {
  return String(role || "-")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
