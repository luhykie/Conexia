/**
 * Layout: Authenticated application shell
 *
 * Responsibility:
 * - Combines Sidebar, Header, and current role page
 * - Does not contain feature-specific logic
 *
 * Styles:
 * ./AppLayout.css
 */

import React from "react";

import { Sidebar } from "../../components/AppSidebar/Sidebar";
import { Header } from "../../components/AppHeader/Header";

import "./AppLayout.css";

export function AppLayout({
  account,
  onLogout,
  children,
}) {
  return (
    <div className="cx-app-layout">
      <Sidebar
        roleKey={account?.roleKey}
        onLogout={onLogout}
      />

      <Header account={account} />

      <main className="cx-app-layout__content">
        {children}
      </main>
    </div>
  );
}