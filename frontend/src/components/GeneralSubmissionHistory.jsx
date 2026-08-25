import React from "react";
import { History } from "lucide-react";

import { getIroSubmissionHistory } from "../services/iroDocumentService";
import { Panel } from "./Panel";

export function GeneralSubmissionHistory({ documentId }) {
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getIroSubmissionHistory(documentId)
      .then((response) => active && setEvents(response.events ?? []))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [documentId]);

  return <Panel title="Submission History" className="submission-activity-history">
    {loading && <p>Loading history...</p>}
    {error && <p className="auth-error">{error}</p>}
    {!loading && !error && !events.length && <p>No history events are available.</p>}
    {!loading && !error && events.map((event) => <article key={event.id} className="submission-activity-history__event">
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
  </Panel>;
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
