import React from "react";
import { Filter, Search, X } from "lucide-react";

const agreementTypes = ["MOA", "MOU", "MOF"];
const partnershipScopes = ["Departmental", "Local", "International"];

export function DocumentFilters({
  filters,
  onChange,
  onClear,
  searchPlaceholder = "Search by tracking number, partner, institution...",
  statusOptions = [],
  showAgreementType = true,
  showPartnershipScope = true,
  partnershipScopeOptions = partnershipScopes,
  showDateRange = true,
  showExpiryWindow = false,
  showDepartment = false,
  showAssignedLegal = false,
  unsupported = {},
}) {
  const [search, setSearch] = React.useState(filters.search || "");

  React.useEffect(() => {
    setSearch(filters.search || "");
  }, [filters.search]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== (filters.search || "")) {
        onChange("search", search);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search, filters.search, onChange]);

  const activeFilters = activeFilterItems(filters, {
    statusOptions,
  });
  const topControlCount = [
    showAgreementType,
    showPartnershipScope,
    statusOptions.length > 0,
  ].filter(Boolean).length;

  return (
    <section className="document-filters" aria-label="Document filters">
      <div className={`document-filters__top document-filters__top--${topControlCount}`}>
        <label className="document-filters__search">
          <Search size={17} />
          <input
            value={search}
            disabled={unsupported.search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>

        {showAgreementType && (
          <FilterSelect
            label="Agreement Type"
            value={filters.document_type || ""}
            disabled={unsupported.document_type}
            onChange={(value) => onChange("document_type", value)}
            options={agreementTypes}
          />
        )}

        {showPartnershipScope && (
          <FilterSelect
            label="Partnership Scope"
            value={filters.partnership_scope || ""}
            disabled={unsupported.partnership_scope}
            onChange={(value) => onChange("partnership_scope", value)}
            options={partnershipScopeOptions}
          />
        )}

        {statusOptions.length > 0 && (
          <FilterSelect
            label="Status"
            value={filters.status || ""}
            disabled={unsupported.status}
            onChange={(value) => onChange("status", value)}
            options={statusOptions}
          />
        )}

        {activeFilters.length > 0 && (
          <button type="button" className="outline document-filters__clear" onClick={onClear}>
            <X size={15} /> Clear
          </button>
        )}
      </div>

      {(showDateRange ||
        showExpiryWindow ||
        showDepartment ||
        showAssignedLegal) && (
        <div className="document-filters__advanced">
          {showDateRange && (
            <>
              <FilterDate
                label="Date From"
                value={filters.date_from || ""}
                disabled={unsupported.date_from}
                onChange={(value) => onChange("date_from", value)}
              />
              <FilterDate
                label="Date To"
                value={filters.date_to || ""}
                disabled={unsupported.date_to}
                onChange={(value) => onChange("date_to", value)}
              />
            </>
          )}

          {showExpiryWindow && (
            <FilterSelect
              label="Expiry Window"
              value={filters.expiry_window || ""}
              disabled={unsupported.expiry_window}
              onChange={(value) => onChange("expiry_window", value)}
              options={["120 Days", "90 Days", "60 Days", "30 Days", "Expired"]}
            />
          )}

          {showDepartment && (
            <FilterSelect
              label="Department / Office"
              value={filters.department || ""}
              disabled={unsupported.department}
              onChange={(value) => onChange("department", value)}
              options={["SCS", "SEA", "SBM", "SAS", "SAMS", "SED", "SOL", "ETEEAP"]}
            />
          )}

          {showAssignedLegal && (
            <FilterSelect
              label="Assigned Legal Counsel"
              value={filters.assigned_legal_counsel || ""}
              disabled={unsupported.assigned_legal_counsel}
              onChange={(value) => onChange("assigned_legal_counsel", value)}
              options={[]}
            />
          )}
        </div>
      )}

      <div className="document-filters__meta">
        <span>
          <Filter size={14} />
          {activeFilters.length} active filter{activeFilters.length === 1 ? "" : "s"}
        </span>
        {activeFilters.length > 0 && (
          <div className="document-filter-chips">
            {activeFilters.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => onChange(item.key, "")}
              >
                {item.label}
                <X size={13} />
              </button>
            ))}
            <button type="button" onClick={onClear}>
              Clear All
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function useDocumentFilters(initialFilters = {}) {
  const emptyFilters = React.useMemo(
    () => ({
      search: "",
      status: "",
      document_type: "",
      partnership_scope: "",
      date_from: "",
      date_to: "",
      expiry_window: "",
      department: "",
      assigned_legal_counsel: "",
      ...initialFilters,
    }),
    [],
  );
  const [filters, setFilters] = React.useState(emptyFilters);

  const updateFilter = React.useCallback((key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const clearFilters = React.useCallback(() => {
    setFilters(emptyFilters);
  }, [emptyFilters]);

  const queryParams = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== ""),
      ),
    [filters],
  );

  return {
    filters,
    queryParams,
    updateFilter,
    clearFilters,
  };
}

function FilterSelect({
  label,
  value,
  options,
  disabled = false,
  onChange,
}) {
  return (
    <label className="document-filter-control">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        title={disabled ? "Backend filter support required" : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
        {options.length === 0 && <option value="">Not Available</option>}
      </select>
    </label>
  );
}

function FilterDate({ label, value, disabled = false, onChange }) {
  return (
    <label className="document-filter-control">
      <span>{label}</span>
      <input
        type="date"
        value={value}
        disabled={disabled}
        title={disabled ? "Backend filter support required" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function activeFilterItems(filters) {
  return Object.entries(filters)
    .filter(([, value]) => value)
    .map(([key, value]) => ({
      key,
      label: `${labelFor(key)}: ${value}`,
    }));
}

function labelFor(key) {
  return {
    search: "Search",
    status: "Status",
    document_type: "Agreement Type",
    partnership_scope: "Partnership Scope",
    date_from: "From",
    date_to: "To",
    expiry_window: "Expiry Window",
    department: "Department",
    assigned_legal_counsel: "Legal Counsel",
  }[key] || key;
}
