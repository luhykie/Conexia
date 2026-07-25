import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DashboardStats } from "./DashboardStats";
import { IncomingHeader } from "./IncomingHeader";
import { IncomingFilters } from "./IncomingFilters";
import IncomingTable from "./IncomingTable";
import Pagination from "./Pagination";

import { getIncomingDocuments } from "../services/documentService";

const AGREEMENT_TYPES = new Set(["MOA", "MOU", "MOF"]);

export function IncomingSubmissions() {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getIncomingDocuments();

      const validDocuments = (data ?? []).filter((document) =>
        AGREEMENT_TYPES.has(
          document.document_type?.toUpperCase()
        )
      );

      setDocuments(validDocuments);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      setErrorMessage("Unable to load incoming submissions.");
    } finally {
      setLoading(false);
    }
  }

  const submittedDocuments = documents.filter(
    (document) => document.status === "Submitted"
  );

  const loggedDocuments = documents.filter(
    (document) => document.status === "Logged"
  );

  const routedDocuments = documents.filter(
    (document) => document.status === "Under Legal Review"
  );

  const today = new Date().toDateString();

  const stats = {
    incoming: submittedDocuments.length,

    loggedToday: loggedDocuments.filter((document) => {
      if (!document.updated_at) return false;

      return (
        new Date(document.updated_at).toDateString() === today
      );
    }).length,

    awaitingCheck: loggedDocuments.length,

    routedToLegal: routedDocuments.length,
  };

  function handleCardClick(label) {
    switch (label) {
      case "Unlogged":
        navigate("/app/incoming");
        break;

      case "Awaiting Check":
        navigate("/app/log-review", {
          state: { filterStatus: "awaiting" },
        });
        break;

      case "Routed to Legal":
        navigate("/app/status", {
          state: { filterStatus: "routed" },
        });
        break;

      default:
        break;
    }
  }

  return (
    <section className="page iro-staff-page incoming-page">
      <IncomingHeader />

      <DashboardStats
        stats={stats}
        showLoggedToday={false}
        onCardClick={handleCardClick}
      />

      <IncomingFilters onRefresh={loadDocuments} />

      <div className="panel">
        <h2>Active Incoming Submissions</h2>

        {loading && <p>Loading documents...</p>}

        {!loading && errorMessage && (
          <p className="error-message">{errorMessage}</p>
        )}

        {!loading &&
          !errorMessage &&
          submittedDocuments.length === 0 && (
            <p>No submitted documents found.</p>
          )}

        {!loading &&
          !errorMessage &&
          submittedDocuments.length > 0 && (
            <IncomingTable rows={submittedDocuments} />
          )}

        <Pagination />
      </div>
    </section>
  );
}

export default IncomingSubmissions;