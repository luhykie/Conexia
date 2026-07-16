import React from "react";
import { createRoot } from "react-dom/client";
import { ChevronRight, ShieldCheck } from "lucide-react";
import "./styles.css";
import { authenticateDevAccount, DEV_PASSWORD } from "./auth/devAccounts";
import { canAccessPage, getDefaultPage } from "./auth/rbac";
import { Shell } from "./components/Shell";
import { roles } from "./data/roles";
import { isSupabaseConfigured, supabaseConfig } from "./supabaseConfig";
import { DepartmentStaff } from "./roles/DepartmentStaff";
import { IroAdmin } from "./roles/IroAdmin";
import { IroStaff } from "./roles/IroStaff";
import { LegalCounsel } from "./roles/LegalCounsel";
import { SuperAdmin } from "./roles/SuperAdmin";

// Main controller for role selection, development login, and RBAC page dispatch.
function App() {
  const [screen, setScreen] = React.useState("role");
  const [selectedRole, setSelectedRole] = React.useState("department");
  const [account, setAccount] = React.useState(null);
  const [page, setPage] = React.useState("dashboard");

  function handleRoleSelect(roleKey) {
    setSelectedRole(roleKey);
    setPage(getDefaultPage(roleKey));
  }

  function handleLogin(nextAccount) {
    setAccount(nextAccount);
    setSelectedRole(nextAccount.roleKey);
    setPage(getDefaultPage(nextAccount.roleKey));
    setScreen("app");
  }

  function handleLogout() {
    setAccount(null);
    setPage(getDefaultPage(selectedRole));
    setScreen("role");
  }

  if (screen === "login") {
    return <LoginScreen selectedRole={selectedRole} onBack={() => setScreen("role")} onLogin={handleLogin} />;
  }

  if (screen === "app" && account) {
    return <ProtectedWorkspace account={account} page={page} setPage={setPage} onLogout={handleLogout} />;
  }

  return <RoleSelect selectedRole={selectedRole} onRoleSelect={handleRoleSelect} onLogin={() => setScreen("login")} />;
}

// Role picker uses the same role metadata as navigation and RBAC.
function RoleSelect({ selectedRole, onRoleSelect, onLogin }) {
  return (
    <main className="role-screen">
      <section className="role-hero">
        <strong>CONEXIA</strong>
        <div>
          <h1>Connecting Institutions,<br /><span>Simplifying Partnerships</span></h1>
          <p>Manage MOA, MOU, and MOF documents through a secure and intelligent workflow system designed for universities and partner institutions.</p>
          <div className="role-pills">
            <span>Secure Document Repository</span>
            <span>Automated Workflow</span>
            <span>International Collaboration</span>
          </div>
        </div>
        <footer>2026 CONEXIA / University International Relations Office</footer>
      </section>

      <section className="role-picker">
        <div className="secure-badge"><ShieldCheck size={18} /> Secure Institutional Portal</div>
        <h2>Select Your Role</h2>
        <p>Choose your workspace to continue to the dashboard.</p>
        <div className="role-list">
          {Object.entries(roles).map(([roleKey, role]) => {
            const Icon = role.icon;
            return (
              <button
                className={`role-card ${selectedRole === roleKey ? "selected" : ""}`}
                onClick={() => onRoleSelect(roleKey)}
                key={roleKey}
              >
                <span><Icon size={30} /></span>
                <b>{role.label}</b>
                <small>{role.subtitle}</small>
              </button>
            );
          })}
        </div>
        <button className="wide" onClick={onLogin}>LOGIN <ChevronRight /></button>
      </section>
    </main>
  );
}

// Development login validates known emails against the shared temporary password.
function LoginScreen({ selectedRole, onBack, onLogin }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState(DEV_PASSWORD);
  const [error, setError] = React.useState("");
  const role = roles[selectedRole];

  function handleSubmit(event) {
    event.preventDefault();
    const result = authenticateDevAccount(email, password);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onLogin(result.account);
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>CONEXIA</h1>
        <p>INTELLIGENT DOCUMENT SYSTEMS</p>
        <label>
          Selected Role
          <input value={role.label} readOnly />
        </label>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@conexia.com" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit">Sign In <ChevronRight /></button>
        <button type="button" className="text-action" onClick={onBack}>Back to role selection</button>
        <small>Development accounts use the shared temporary password: {DEV_PASSWORD}</small>
      </form>
      <footer>
        <span>2024 CONEXIA University Systems</span>
        <span>Secure Institutional Portal</span>
        <span>Privacy Policy</span>
        <span>Accessibility</span>
        <span>Help</span>
      </footer>
    </main>
  );
}

// RBAC guard prevents direct navigation to pages outside the signed-in role.
function ProtectedWorkspace({ account, page, setPage, onLogout }) {
  const safePage = canAccessPage(account.roleKey, page) ? page : getDefaultPage(account.roleKey);

  React.useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage, setPage]);

  return (
    <Shell roleKey={account.roleKey} page={safePage} setPage={setPage} account={account} onLogout={onLogout}>
      <RolePage roleKey={account.roleKey} page={safePage} account={account} />
    </Shell>
  );
}

// Selects the correct role module after RBAC has allowed the page.
function RolePage({ roleKey, page, account }) {
  if (roleKey === "super") return <SuperAdmin page={page} account={account} />;
  if (roleKey === "admin") return <IroAdmin page={page} account={account} />;
  if (roleKey === "staff") return <IroStaff page={page} account={account} />;
  if (roleKey === "legal") return <LegalCounsel page={page} account={account} />;
  return <DepartmentStaff page={page} account={account} />;
}

createRoot(document.getElementById("root")).render(<App />);
