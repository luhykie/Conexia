import React from "react";
import { ChevronDown, History } from "lucide-react";

import { getIroSubmissionHistory } from "../services/iroDocumentService";
import { Panel } from "./Panel";

export function GeneralSubmissionHistory({ documentId }) {
  const [events, setEvents] = React.useState([]);
  const [selectedVersion, setSelectedVersion] = React.useState("all");
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const entriesRef = React.useRef(null);

  React.useEffect(() => {
    let active = true;
    setEvents([]);
    setSelectedVersion("all");
    setIsExpanded(false);
    setLoading(true);
    setError("");
    getIroSubmissionHistory(documentId)
      .then((response) => {
        if (!active) return;

        const loadedEvents = response.events ?? [];
        const loadedVersions = availableVersions(loadedEvents);
        setEvents(loadedEvents);
        setSelectedVersion(loadedVersions[0] ?? "all");
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [documentId]);

  const versions = availableVersions(events);
  const visibleEvents = selectedVersion === "all"
    ? events
    : events.filter((event) => String(event.version) === selectedVersion);
  const showEntries = loading || Boolean(error) || !events.length || isExpanded;

  function toggleVersion(version) {
    if (version === selectedVersion) {
      setIsExpanded((expanded) => !expanded);
      return;
    }

    setSelectedVersion(version);
    setIsExpanded(true);
    if (entriesRef.current) entriesRef.current.scrollTop = 0;
  }

  return <Panel title="Submission History" className="submission-activity-history">
    {!loading && !error && <div className="document-filter-control submission-history-filter">
      <span>Document Version History</span>
      <button
        type="button"
        className="submission-history-filter__toggle"
        aria-expanded={isExpanded}
        aria-controls={`submission-history-options-${documentId} submission-history-${documentId}`}
        onClick={() => toggleVersion(selectedVersion)}
      >
        {selectedVersion === "all" ? "All Versions" : `Version ${selectedVersion}`}
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div
        id={`submission-history-options-${documentId}`}
        className="submission-history-filter__options"
        role="group"
        aria-label="Document versions"
      >
        {["all", ...versions].map((version) => <button
          key={version}
          type="button"
          aria-pressed={selectedVersion === version}
          onClick={() => toggleVersion(version)}
        >
          {version === "all" ? "All Versions" : `Version ${version}`}
        </button>)}
      </div>
    </div>}
    <div
      id={`submission-history-${documentId}`}
      className={`submission-activity-history__entries${showEntries ? " is-expanded" : ""}`}
      ref={entriesRef}
      aria-hidden={!showEntries}
    >
    {loading && <p>Loading history...</p>}
    {error && <p className="auth-error">{error}</p>}
    {!loading && !error && !events.length && <p>No history events are available.</p>}
    {!loading && !error && visibleEvents.map((event) => <article key={event.id} className={`submission-activity-history__event${event.action === "document.viewed" ? " document-view-history-event" : ""}`}>
      <History size={16} aria-hidden="true" />
      <div>
        <b>{event.label}</b>
        <small>{formatActor(event)} · {formatDate(event.created_at)}</small>
        {event.version && <p>Version {event.version}</p>}
        {(event.previous_status || event.new_status) && <p>{[event.previous_status, event.new_status].filter(Boolean).join(" → ")}</p>}
        {event.destination && <p>Destination: {formatDestination(event.destination)}</p>}
        {event.reason && <p>Reason: {event.reason}</p>}
      </div>
    </article>)}
    </div>
  </Panel>;
}

function availableVersions(events) {
  return [...new Set(
    events
      .filter((event) => event.version !== null && event.version !== undefined)
      .map((event) => String(event.version)),
  )].sort((left, right) => Number(right) - Number(left));
}

function formatActor(event) {
  const role = event.actor_role
    ? String(event.actor_role).split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
    : "";
  return [event.actor, role].filter(Boolean).join(" — ");
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Date unavailable";
}

function formatDestination(destination) {
  if (typeof destination === "string") return destination;
  return destination.name || destination.department?.name || destination.type?.replaceAll("_", " ") || "Workflow destination";
}
