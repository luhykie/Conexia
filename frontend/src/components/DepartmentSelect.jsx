// [FEATURE: Department Management] - manages departments and department-scoped workflow data.
import React from "react";
import { getDepartments } from "../services/departmentService";
import { reportClientError } from "../utils/reportClientError";

// Coordinates select within the department management and department-scoped workflow.
export function DepartmentSelect({
  value,
  ownDepartmentId,
  disabled = false,
  onChange,
}) {
  const [departments, setDepartments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    // Loads departments within the department management and department-scoped workflow.
    async function loadDepartments() {
      try {
        const response = await getDepartments({
          per_page: 100,
          sort: "code",
          direction: "asc",
        });

        if (active) {
          setDepartments(
            (response.data ?? []).filter(
              (department) => department.id !== ownDepartmentId,
            ),
          );
        }
      } catch (requestError) {
        reportClientError("Unable to load departments:", requestError);
        if (active) setDepartments([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDepartments();
    return () => {
      active = false;
    };
  }, [ownDepartmentId]);

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      required
    >
      <option value="">
        {loading ? "Loading departments..." : "Select a registered department"}
      </option>
      {departments.map((department) => (
        <option key={department.id} value={department.id}>
          {department.code ? `${department.code} - ` : ""}
          {department.name}
        </option>
      ))}
    </select>
  );
}
