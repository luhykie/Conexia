import React from "react";
import IncomingSummary from "./IncomingSummary";
import { IncomingHeader } from "./IncomingHeader";
import { IncomingFilters } from "./IncomingFilters";
import IncomingTable from "./IncomingTable";
import Pagination from "./Pagination";
import { useNavigate } from "react-router-dom"; 

// Mock rows tailored to the requested columns
const mockRows = [
  { department: "School of Education", partner: "Global Relief Initiative", type: "MOA", dateSubmitted: "Oct 24, 2023", daysWaiting: 3 },
  { department: "College of Law", partner: "Vertex Logistics Corp.", type: "MOU", dateSubmitted: "Oct 23, 2023", daysWaiting: 5 },
  { department: "Engineering", partner: "Apex Manufacturing", type: "MOF", dateSubmitted: "Oct 22, 2023", daysWaiting: 10 },
  { department: "Business School", partner: "Starlight Foundation", type: "MOA", dateSubmitted: "Oct 21, 2023", daysWaiting: 1 },
  { department: "Medicine", partner: "Oceanic Blue LLC", type: "MOU", dateSubmitted: "Oct 20, 2023", daysWaiting: 12 },
];

export function IncomingSubmissions() {

  const stats = {
    incoming: 12,
    loggedToday: 9,
    awaitingCheck: 3,
    routedToLegal: 24,
  };

  return (
    <section className="page iro-staff-page incoming-page">

      <IncomingHeader />

      <IncomingSummary stats={stats} />

      <IncomingFilters />

      <div className="panel">
        <h2>Active Incoming Submissions</h2>
        <IncomingTable rows={mockRows} />
        <Pagination />
      </div>

    </section>
  );
}

export default IncomingSubmissions;
