import React from "react";
import { Bell, LogOut, Settings, User } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { roles } from "../data/roles";
import { notificationRows } from "../data/mockData";

// Shared authenticated application frame.
export function Shell({ roleKey, page, setPage, account, onLogout, children }) {
  const role = roles[roleKey];
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const unreadCount = notificationRows.length;

  return (
    <div className="app-shell">
      <Sidebar role={role} roleKey={roleKey} page={page} setPage={setPage} onLogout={onLogout} />
      <main className="workspace">
        <Topbar
          role={role}
          account={account}
          onToggleNotifications={() => {
            setNotificationsOpen((value) => !value);
            setProfileOpen(false);
          }}
          onToggleProfile={() => {
            setProfileOpen((value) => !value);
            setNotificationsOpen(false);
          }}
          unreadCount={unreadCount}
        />
        {children}
      </main>
      {notificationsOpen && (
        <aside className="drawer drawer-notifications" aria-label="Notifications drawer">
          <div className="drawer-header">
            <h2>Notification Center</h2>
            <button type="button" className="icon-close" onClick={() => setNotificationsOpen(false)}>×</button>
          </div>
          <div className="drawer-meta">
            <span>{unreadCount} unread alerts</span>
            <button className="outline" type="button">Mark all as read</button>
          </div>
          <div className="drawer-tabs">
            <button className="active" type="button">All Notifications</button>
            <button type="button">Awaiting Action</button>
            <button type="button">System</button>
          </div>
          <div className="drawer-list">
            {notificationRows.map(([tone, title, timestamp]) => (
              <article className={`drawer-item ${String(tone).toLowerCase()}`} key={`${title}-${timestamp}`}>
                <b>{title}</b>
                <p>{tone} alert from the workflow queue.</p>
                <small>{timestamp}</small>
              </article>
            ))}
          </div>
        </aside>
      )}
      {profileOpen && (
        <aside className="drawer drawer-profile" aria-label="Profile drawer">
          <div className="drawer-profile-head">
            <div className="profile-avatar-lg">{String(account?.fullName || role.user || "U")[0]}</div>
            <div>
              <b>{account?.fullName || role.user}</b>
              <span>{account?.role || role.title}</span>
            </div>
            <button type="button" className="icon-close" onClick={() => setProfileOpen(false)}>×</button>
          </div>
          <div className="drawer-section">
            <h3>Account Information</h3>
            <p>{account?.email || "No email available"}</p>
            <p>{account?.office || "No office available"}</p>
            <p>{account?.department || role.label}</p>
          </div>
          <div className="drawer-section">
            <h3>Quick Settings</h3>
            <button className="drawer-link" type="button"><Settings size={16} /> Theme Toggle</button>
            <button className="drawer-link" type="button"><Bell size={16} /> Notification Preferences</button>
            <button className="drawer-link" type="button"><User size={16} /> Privacy Settings</button>
          </div>
          <div className="drawer-section">
            <h3>Professional Actions</h3>
            <button className="drawer-link" type="button"><User size={16} /> View Full Profile</button>
            <button className="drawer-link" type="button"><LogOut size={16} /> Account Security</button>
          </div>
          <button className="danger-signout" type="button" onClick={onLogout}>Sign Out</button>
        </aside>
      )}
    </div>
  );
}
