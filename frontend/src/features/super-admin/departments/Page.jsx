// Department page: i-maintain ang internal department directory ug related summary metrics.
import React, {
  useEffect,
  useState,
} from "react";
import {
  Building2,
  CheckCircle2,
  Trash2,
  X,
  Users,
} from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from "../../../services/departmentService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

// I-render ang department directory uban sa quick stats ug create form.
export default function Page() {
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deletingDepartment, setDeletingDepartment] = useState(null);
  const [newDepartment, setNewDepartment] = useState({
    code: "",
    name: "",
    email: "",
    office_assignment: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Reuses the directory fields for the Manage modal so Super Admin can edit an existing entry.
  const [departmentForm, setDepartmentForm] = useState({
    code: "",
    name: "",
    email: "",
    is_active: true,
  });

  // I-load ang department list ug pagination metadata para sa table.
  async function loadDepartments() {
    setLoading(true);
    setError("");

    try {
      const response = await getDepartments({ page });

      setDepartments(response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (requestError) {
      reportClientError("Unable to load departments:", requestError);
      setError(requestError.message || "Unable to load departments.");
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, [page]);

  // I-validate ug ipadala sa backend ang bag-ong department payload.
  async function submitDepartment(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createDepartment(newDepartment);
      setNewDepartment({
        code: "",
        name: "",
        email: "",
        office_assignment: "",
      });
      setShowCreateForm(false);
      // Refresh the directory without displaying a post-load success banner.
      await loadDepartments();
    } catch (requestError) {
      reportClientError("Unable to create department:", requestError);
      setError(requestError.message || "Unable to create department.");
    } finally {
      setSaving(false);
    }
  }

  // I-update ang create form state kung usbon sa user ang department fields.
  function updateNewDepartment(event) {
    const { name, value } = event.target;

    setNewDepartment((current) => ({
      ...current,
      [name]: value,
    }));
  }

  // Opens the Manage form with the selected department's current values.
  function openDepartmentEditor(department) {
    setEditingDepartment(department);
    setDepartmentForm({
      code: department.code || "",
      name: department.name || "",
      email: department.email || "",
      is_active: department.is_active ?? department.status !== "Inactive",
    });
    setError("");
    setSuccess("");
  }

  // Saves the Manage form through PUT and refreshes the directory after validation succeeds.
  async function submitDepartmentUpdate(event) {
    event.preventDefault();
    if (!editingDepartment?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updateDepartment(editingDepartment.id, departmentForm);
      setEditingDepartment(null);
      // Refresh the table without showing a post-load success banner.
      await loadDepartments();
    } catch (requestError) {
      reportClientError("Unable to update department:", requestError);
      setError(requestError.message || "Unable to update department.");
    } finally {
      setSaving(false);
    }
  }

  // Requires confirmation before permanently removing a department directory entry.
  async function confirmDeleteDepartment() {
    if (!deletingDepartment?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await deleteDepartment(deletingDepartment.id);
      setDeletingDepartment(null);
      setEditingDepartment(null);
      // Refresh the table without showing a post-load success banner.
      await loadDepartments();
    } catch (requestError) {
      reportClientError("Unable to delete department:", requestError);
      setError(requestError.message || "Unable to delete department.");
    } finally {
      setSaving(false);
    }
  }

  // Keeps the edit form controlled and clears stale validation feedback as fields change.
  function updateDepartmentForm(event) {
    const { name, value, type, checked } = event.target;
    setDepartmentForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  }

  // Replaced the old disabled View Only text with a working Manage action for directory maintenance.
  const activeDepartments = departments.filter(
    (department) => department.status === "Active" || department.is_active,
  ).length;
  const assignedStaff = departments.reduce(
    (total, department) => total + Number(department.staffCount || department.staff_count || 0),
    0,
  );

  const rows = departments.map((department) => [
    department.code || "-",
    department.name || "-",
    department.office || department.office_assignment || "-",
    department.email || "-",
    department.staffCount ?? department.staff_count ?? 0,
    department.status || (department.is_active ? "Active" : "Available"),
    <button
      type="button"
      className="table-action department-manage-button"
      key={`manage-${department.id}`}
      onClick={() => openDepartmentEditor(department)}
    >
      Manage
    </button>,
  ]);

  return (
    <section className="super-admin-page">
      <PageTitle
        title="Department Management"
        subtitle="Maintain the institutional department directory used for user assignments."
      >
        <Button icon={Building2} onClick={() => setShowCreateForm((value) => !value)}>
          {showCreateForm ? "Close Form" : "Add Department"}
        </Button>
      </PageTitle>

      <section className="super-admin-stats">
        <article>
          <Building2 size={22} />
          <strong>{loading ? "-" : departments.length}</strong>
          <span>Total Departments</span>
        </article>
        <article>
          <CheckCircle2 size={22} />
          <strong>{loading ? "-" : activeDepartments}</strong>
          <span>Active Departments</span>
        </article>
        <article>
          <Users size={22} />
          <strong>{loading ? "-" : assignedStaff}</strong>
          <span>Assigned Staff</span>
        </article>
      </section>

      <Panel title="Department Directory">
        {showCreateForm && (
          <form className="admin-inline-form" onSubmit={submitDepartment}>
            <label>
              Department Code
              <input name="code" value={newDepartment.code} onChange={updateNewDepartment} disabled={saving} required />
            </label>
            <label>
              Department Name
              <input name="name" value={newDepartment.name} onChange={updateNewDepartment} disabled={saving} required />
            </label>
            <label>
              Department Email
              <input name="email" type="email" value={newDepartment.email} onChange={updateNewDepartment} disabled={saving} />
            </label>
            <label>
              Office Assignment
              <input name="office_assignment" value={newDepartment.office_assignment} onChange={updateNewDepartment} disabled={saving} placeholder="Optional display note" />
            </label>
            <div className="admin-form-actions">
              <button type="button" onClick={() => setShowCreateForm(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create Department"}
              </button>
            </div>
          </form>
        )}
        {loading && <p>Loading departments...</p>}
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        {!loading && !error && rows.length === 0 && (
          <p>No departments are available.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            headers={["Code", "Department", "Office", "Email", "Staff", "Status", "Action"]}
            rows={rows}
            columnClasses={["", "", "", "", "", "", "department-action-column"]}
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>

      {editingDepartment && (
        <div className="department-modal-backdrop" role="presentation" onClick={() => setEditingDepartment(null)}>
          <section
            className="department-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="department-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2 id="department-editor-title">Manage Department</h2>
                <p>Edit the directory information used by Super Admin.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setEditingDepartment(null)}>
                <X size={18} />
              </button>
            </header>

            <form className="admin-inline-form" onSubmit={submitDepartmentUpdate}>
              <label>
                Department Code
                <input name="code" value={departmentForm.code} onChange={updateDepartmentForm} disabled={saving} required />
              </label>
              <label>
                Department Name
                <input name="name" value={departmentForm.name} onChange={updateDepartmentForm} disabled={saving} required />
              </label>
              <label>
                Email
                <input name="email" type="email" value={departmentForm.email} onChange={updateDepartmentForm} disabled={saving} required />
              </label>
              <label className="admin-checkbox">
                <input name="is_active" type="checkbox" checked={departmentForm.is_active} onChange={updateDepartmentForm} disabled={saving} />
                Available
              </label>
              <div className="admin-form-actions">
                <button type="button" onClick={() => setEditingDepartment(null)} disabled={saving}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
                <button
                  type="button"
                  className="department-delete-button"
                  onClick={() => setDeletingDepartment(editingDepartment)}
                  disabled={saving}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deletingDepartment && (
        <div className="department-modal-backdrop" role="presentation" onClick={() => setDeletingDepartment(null)}>
          <section
            className="department-modal department-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-department-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2 id="delete-department-title">Delete Department</h2>
                <p>Are you sure you want to permanently delete this department?</p>
              </div>
            </header>
            <div className="admin-form-actions">
              <button type="button" onClick={() => setDeletingDepartment(null)} disabled={saving}>Cancel</button>
              <button type="button" className="department-delete-button" onClick={confirmDeleteDepartment} disabled={saving}>
                <Trash2 size={14} />
                {saving ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
