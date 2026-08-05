import React from "react";
// IRO Staff dashboard greeting and primary actions.
export function DashboardHeader({ account, incomingCount = 0 }) {
  const firstName =
    account?.fullName?.trim().split(/\s+/)[0] || "IRO Staff";

  return (
    <header className="iro-dashboard-header">
      <div className="title-block">
        <h1>Welcome, {firstName}.</h1>
        <p>
          Here is your operational overview. You have{" "}
          {incomingCount} unlogged{" "}
          {incomingCount === 1 ? "item" : "items"} requiring
          attention.
        </p>
      </div>
    </header>
  );
}
