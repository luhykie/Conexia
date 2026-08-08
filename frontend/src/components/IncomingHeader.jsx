import React from "react";

export function IncomingHeader({ roleKey = "staff" }) {
  return (
    <header className="incoming-header">
      <div className="title-block">
        <h1>INCOMING SUBMISSIONS</h1>
        <p className="subtitle">
          {roleKey === "admin"
            ? "Monitor documents awaiting IRO Staff logging. Logged records are available under IRO Staff Submissions."
            : "View incoming partnership records and log submissions for IRO Admin review."}
        </p>
      </div>
    </header>
  );
}
