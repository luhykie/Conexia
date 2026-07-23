import React, { useState, useMemo } from "react";
import { DashboardStats } from "./DashboardStats";
import { IncomingHeader } from "./IncomingHeader";
import { IncomingFilters } from "./IncomingFilters";
import IncomingTable from "./IncomingTable";
import Pagination from "./Pagination";
import { useNavigate } from "react-router-dom"; 

// Mock rows tailored to the requested columns
const mockRows = [
  {
    department: "School of Education",
    partner: "Global Relief Initiative",
    type: "MOA",
    collab: "International",
    status: "unlogged",
    completeness: "missing",
    priority: "high",
    referenceId: "LEX-2024-0001",
    dateSubmitted: "Oct 24, 2023",
    daysWaiting: 3,
  },
  {
    department: "College of Law",
    partner: "Vertex Logistics Corp.",
    type: "MOU",
    collab: "Local",
    status: "awaiting",
    completeness: "complete",
    priority: "normal",
    referenceId: "LEX-2024-0002",
    dateSubmitted: "Oct 23, 2023",
    daysWaiting: 5,
  },
  {
    department: "Engineering",
    partner: "Apex Manufacturing",
    type: "MOF",
    collab: "Local",
    status: "ready-legal",
    completeness: "complete",
    priority: "urgent",
    referenceId: "LEX-2024-0003",
    dateSubmitted: "Oct 22, 2023",
    daysWaiting: 10,
  },
  {
    department: "Business School",
    partner: "Starlight Foundation",
    type: "MOA",
    collab: "International",
    status: "returned",
    completeness: "correction",
    priority: "low",
    referenceId: "LEX-2024-0004",
    dateSubmitted: "Oct 21, 2023",
    daysWaiting: 1,
  },
  {
    department: "Medicine",
    partner: "Oceanic Blue LLC",
    type: "MOU",
    collab: "International",
    status: "routed",
    completeness: "complete",
    priority: "normal",
    referenceId: "LEX-2024-0005",
    dateSubmitted: "Oct 20, 2023",
    daysWaiting: 12,
  },
];

export function IncomingSubmissions() {

  const stats = {
    incoming: 12,
    loggedToday: 9,
    awaitingCheck: 3,
    routedToLegal: 24,
  };

  const [filters, setFilters] = useState(null);

  const filteredRows = useMemo(() => {
    if (!filters) return mockRows;

    return mockRows.filter((row) => {
      // Document Type
      if (filters.docType && filters.docType !== '' && row.type !== filters.docType) return false;
      // Collaboration Type
      if (filters.collab && filters.collab !== '' && row.collab !== filters.collab) return false;
      // Department
      if (filters.department && filters.department !== 'All Departments' && row.department !== filters.department) return false;
      // Partner search
      if (filters.partner && !row.partner.toLowerCase().includes(filters.partner.toLowerCase())) return false;
      // Reference ID
      if (filters.referenceId && !row.referenceId?.toLowerCase().includes(filters.referenceId.toLowerCase())) return false;

      // Statuses
      if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(row.status)) return false;

      // Completeness
      if (filters.completeness && filters.completeness.length > 0 && !filters.completeness.includes(row.completeness)) return false;

      // Priority
      if (filters.priority && filters.priority !== '' && row.priority !== filters.priority) return false;

      // Date range - try to parse dateSubmitted like 'Oct 24, 2023'
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        const rowDate = new Date(row.dateSubmitted);
        if (isFinite(from) && rowDate < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        const rowDate = new Date(row.dateSubmitted);
        if (isFinite(to) && rowDate > to) return false;
      }

      return true;
    });
  }, [filters]);

  function handleApply(filtersObj) {
    setFilters(filtersObj);
  }

  function handleReset() {
    setFilters(null);
  }

  return (
    <section className="page iro-staff-page incoming-page">

      <IncomingHeader />

      <DashboardStats stats={stats} showLoggedToday={false} />

      <IncomingFilters onApply={handleApply} onReset={handleReset} initial={{}} />

      <div className="panel">
        <h2>Active Incoming Submissions</h2>
        <IncomingTable rows={filteredRows} />
        <Pagination />
      </div>

    </section>
  );
}

export default IncomingSubmissions;
