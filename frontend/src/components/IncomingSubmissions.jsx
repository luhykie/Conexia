import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DashboardStats } from "./DashboardStats";
import { IncomingHeader } from "./IncomingHeader";
import { IncomingFilters } from "./IncomingFilters";
import IncomingTable from "./IncomingTable";
import Pagination from "./Pagination";

import {
  getIncomingDocuments,
  getIroStaffDashboard,
} from "../services/documentService";

const AGREEMENT_TYPES = new Set(["MOA", "MOU", "MOF"]);
const PAGE_SIZE = 5;

function departmentName(document) {
  return (
    document.department?.name ||
    document.departments?.name ||
    document.department_name ||
    "Department unavailable"
  );
}

function daysWaiting(document) {
  if (!document.submitted_at) return null;
  const submittedAt = new Date(document.submitted_at);
  if (Number.isNaN(submittedAt.getTime())) return null;

  return Math.max(
    0,
    Math.floor((Date.now() - submittedAt.getTime()) / 86400000)
  );
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function IncomingSubmissions({ roleKey = "staff" }) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] =
    useState("All");
  const [partnerFilter, setPartnerFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [incoming, dashboard] = await Promise.all([
        getIncomingDocuments(),
        getIroStaffDashboard(),
      ]);
      const validDocuments = (incoming ?? []).filter((document) =>
        AGREEMENT_TYPES.has(
          document.document_type?.toUpperCase()
        )
      );

      setDocuments(validDocuments);
      setStats(dashboard?.stats ?? {});
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      setErrorMessage(
        error?.message || "Unable to load incoming submissions."
      );
    } finally {
      setLoading(false);
    }
  }

  const departments = useMemo(
    () =>
      [
        ...new Set(
          documents.map(departmentName).filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [documents]
  );

  const partners = useMemo(
    () =>
      [
        ...new Set(
          documents
            .map((document) => document.partner_institution)
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [documents]
  );

  const documentTypes = useMemo(
    () =>
      [
        ...new Set(
          documents
            .map((document) =>
              document.document_type?.toUpperCase()
            )
            .filter((type) => AGREEMENT_TYPES.has(type))
        ),
      ].sort(),
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return documents.filter((document) => {
      const department = departmentName(document);
      const matchesSearch =
        !search ||
        [
          document.tracking_number,
          department,
          document.partner_institution,
          document.document_type,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(search)
          );

      return (
        matchesSearch &&
        (departmentFilter === "All" ||
          department === departmentFilter) &&
        (partnerFilter === "All" ||
          document.partner_institution === partnerFilter) &&
        (typeFilter === "All" ||
          document.document_type?.toUpperCase() === typeFilter)
      );
    });
  }, [
    documents,
    searchTerm,
    departmentFilter,
    partnerFilter,
    typeFilter,
  ]);

  const totalRecords = filteredDocuments.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalRecords / PAGE_SIZE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const pagedDocuments = filteredDocuments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function updateFilter(setter, value) {
    setter(value);
    setCurrentPage(1);
  }

  function handleCardClick(label) {
    if (roleKey !== "staff") return;

    if (label === "Unlogged") navigate("/app/incoming");
    if (label === "Awaiting Check") {
      navigate("/app/log-review", {
        state: { filterStatus: "awaiting" },
      });
    }
    if (label === "Routed to Legal") {
      navigate("/app/status", {
        state: { filterStatus: "routed" },
      });
    }
  }

  function handleExport() {
    const header = [
      "Tracking Number",
      "Department",
      "Partner",
      "Type",
      "Date Submitted",
      "Days Waiting",
      "Status",
    ];
    const rows = filteredDocuments.map((document) => {
      const waiting = daysWaiting(document);
      return [
        document.tracking_number,
        departmentName(document),
        document.partner_institution,
        document.document_type,
        document.submitted_at
          ? new Date(document.submitted_at).toLocaleDateString()
          : "Not available",
        waiting === null ? "Not available" : waiting,
        document.status,
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "incoming-submissions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="page iro-staff-page incoming-page">
      <IncomingHeader
        roleKey={roleKey}
        onAdvancedFilters={() =>
          document.getElementById("incoming-search")?.focus()
        }
      />

      <DashboardStats
        stats={stats}
        showLoggedToday={false}
        onCardClick={
          roleKey === "staff" ? handleCardClick : undefined
        }
      />

      <IncomingFilters
        searchTerm={searchTerm}
        onSearchChange={(value) =>
          updateFilter(setSearchTerm, value)
        }
        department={departmentFilter}
        onDepartmentChange={(value) =>
          updateFilter(setDepartmentFilter, value)
        }
        departments={departments}
        partner={partnerFilter}
        onPartnerChange={(value) =>
          updateFilter(setPartnerFilter, value)
        }
        partners={partners}
        documentType={typeFilter}
        onDocumentTypeChange={(value) =>
          updateFilter(setTypeFilter, value)
        }
        documentTypes={documentTypes}
        onRefresh={loadDocuments}
        refreshing={loading}
        onExport={handleExport}
        canExport={!loading && totalRecords > 0}
      />

      <div className="panel">
        <header>
          <h2>Active Incoming Submissions</h2>
        </header>

        {loading && <p className="empty-state">Loading documents...</p>}

        {!loading && errorMessage && (
          <div className="error-message incoming-error">
            <p>{errorMessage}</p>
            <button
              className="btn outline"
              type="button"
              onClick={loadDocuments}
            >
              Retry
            </button>
          </div>
        )}

        {!loading &&
          !errorMessage &&
          totalRecords === 0 && (
            <p className="empty-state">
              No submitted documents match the selected filters.
            </p>
          )}

        {!loading && !errorMessage && totalRecords > 0 && (
          <IncomingTable
            rows={pagedDocuments}
            roleKey={roleKey}
          />
        )}

        {!loading && !errorMessage && (
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalRecords={totalRecords}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </section>
  );
}

export default IncomingSubmissions;
