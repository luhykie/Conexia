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
import { getDepartments } from "../../../services/departmentService";
import { reportClientError } from "../../../utils/reportClientError";
import "./Page.css";

export default function Page() {
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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

    loadDepartments();
  }, [page]);

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
        <Button icon={Building2} disabled>
          Add Department - Backend Required
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
        {loading && <p>Loading departments...</p>}
        {error && <p className="auth-error">{error}</p>}
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
