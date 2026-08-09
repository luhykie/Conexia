import React, { useEffect, useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { DashboardStats } from "./DashboardStats";
import { IncomingHeader } from "./IncomingHeader";
import { IncomingFilters } from "./IncomingFilters";
import IncomingTable from "./IncomingTable";
import Pagination from "./Pagination";

import {
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

export function IncomingSubmissions({ roleKey = "staff" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const linkedSearch = searchParams.get("search") || "";
  const [searchTerm, setSearchTerm] = useState(linkedSearch);
  const [departmentFilter, setDepartmentFilter] =
    useState("All");
  const [partnerFilter, setPartnerFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    setSearchTerm(linkedSearch);
    setCurrentPage(1);
  }, [linkedSearch]);

  async function loadDocuments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const dashboard = await getIroStaffDashboard(true);
      const incoming = dashboard?.incoming ?? [];
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

  return (
    <section className="page iro-staff-page incoming-page">
      <IncomingHeader
        roleKey={roleKey}
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
            <div className="incoming-empty-state">
              <span><Inbox size={22} aria-hidden="true" /></span>
              <h3>No incoming submissions found</h3>
              <p>No submitted documents match the selected filters.</p>
            </div>
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
