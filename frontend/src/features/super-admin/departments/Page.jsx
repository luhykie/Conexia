import React, {
  useEffect,
  useState,
} from "react";
import {
  Building2,
  CheckCircle2,
  Users,
} from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import {
  createDepartment,
  getDepartments,
} from "../../../services/departmentService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function Page() {
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDepartment, setNewDepartment] = useState({
    code: "",
    name: "",
    email: "",
    office_assignment: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setSuccess("Department created successfully.");
      await loadDepartments();
    } catch (requestError) {
      reportClientError("Unable to create department:", requestError);
      setError(requestError.message || "Unable to create department.");
    } finally {
      setSaving(false);
    }
  }

  function updateDepartment(event) {
    const { name, value } = event.target;

    setNewDepartment((current) => ({
      ...current,
      [name]: value,
    }));
  }

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
    "View Only",
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
              <input name="code" value={newDepartment.code} onChange={updateDepartment} disabled={saving} required />
            </label>
            <label>
              Department Name
              <input name="name" value={newDepartment.name} onChange={updateDepartment} disabled={saving} required />
            </label>
            <label>
              Department Email
              <input name="email" type="email" value={newDepartment.email} onChange={updateDepartment} disabled={saving} />
            </label>
            <label>
              Office Assignment
              <input name="office_assignment" value={newDepartment.office_assignment} onChange={updateDepartment} disabled={saving} placeholder="Optional display note" />
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
            meta={meta}
            onPageChange={setPage}
          />
        )}
      </Panel>
    </section>
  );
}
