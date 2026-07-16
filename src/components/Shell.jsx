import React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { roles } from "../data/roles";

// Shared authenticated application frame.
export function Shell({ roleKey, page, setPage, account, onLogout, children }) {
  const role = roles[roleKey];

  return (
    <div className="app-shell">
      <Sidebar role={role} roleKey={roleKey} page={page} setPage={setPage} onLogout={onLogout} />
      <main className="workspace">
        <Topbar role={role} account={account} />
        {children}
      </main>
    </div>
  );
}
