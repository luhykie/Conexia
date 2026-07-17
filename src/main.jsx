import React from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  AtSign,
  BarChart3,
  ChevronRight,
  Globe2,
  Network,
  Shield,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import "./styles.css";
import { authenticateDevAccount, DEV_PASSWORD } from "./auth/devAccounts";
import { canAccessPage, getDefaultPage } from "./auth/rbac";
import { Shell } from "./components/Shell";
import { DepartmentStaff } from "./roles/DepartmentStaff";
import { IroAdmin } from "./roles/IroAdmin";
import { IroStaff } from "./roles/IroStaff";
import { LegalCounsel } from "./roles/LegalCounsel";
import { SuperAdmin } from "./roles/SuperAdmin";

// Main controller for the public welcome page, development login, and RBAC page dispatch.
function App() {
  const [screen, setScreen] = React.useState("welcome");
  const [account, setAccount] = React.useState(null);
  const [page, setPage] = React.useState("dashboard");

  function handleLogin(nextAccount) {
    setAccount(nextAccount);
    setPage(getDefaultPage(nextAccount.roleKey));
    setScreen("app");
  }

  function handleLogout() {
    setAccount(null);
    setPage("dashboard");
    setScreen("welcome");
  }

  if (screen === "login") {
    return <LoginScreen onBack={() => setScreen("welcome")} onLogin={handleLogin} />;
  }

  if (screen === "app" && account) {
    return <ProtectedWorkspace account={account} page={page} setPage={setPage} onLogout={handleLogout} />;
  }

  return <WelcomePage onLogin={() => setScreen("login")} />;
}

// Public welcome page matched to the supplied Conexia Figma export.
function WelcomePage({ onLogin }) {
  return (
    <main className="welcome-page">
      <header className="welcome-nav">
        <strong>CONEXIA</strong>
        <nav>
          <a className="active-link" href="#product">Product</a>
          <a href="#solutions">Solutions</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <button className="nav-login" onClick={onLogin}>Login</button>
        <button className="nav-cta" onClick={onLogin}>Get Started</button>
      </header>

      <section className="welcome-hero" id="product">
        <div className="hero-copy">
          <span className="trusted-pill"><ShieldCheck size={15} /> Trusted by 500+ universities</span>
          <h1>Connecting Institutions,<br /><em>Simplifying Partnerships</em></h1>
          <p>The definitive OS for global academic document management. Automate workflows with impenetrable security and real-time compliance.</p>
          <div className="hero-actions">
            <button onClick={onLogin}>Get Started</button>
            <button className="hero-link">Explore Platform <ChevronRight size={18} /></button>
          </div>
        </div>
        <CampusIllustration />
      </section>

      <section className="welcome-features" id="solutions">
        <h2>Streamlined Institutional Management</h2>
        <p>A unified platform for secure academic document management and global partnership scaling.</p>
        <div className="feature-grid welcome-grid">
          <FeatureCard icon={WandSparkles} title="Smart Workflows" />
          <FeatureCard icon={Globe2} title="Global Compliance" />
          <FeatureCard icon={Shield} title="Secure Vault" />
        </div>
      </section>

      <section className="security-band" id="security">
        <div>
          <h3>Institutional-Grade Security</h3>
          <p>Protecting sensitive data with the world's most rigorous security certifications.</p>
        </div>
        <div className="cert-row">
          <span><ShieldCheck /> SOC2 TYPE II</span>
          <span><Shield /> ISO 27001</span>
          <span><ShieldCheck /> HIPAA READY</span>
          <span><Shield /> FERPA COMPLIANT</span>
        </div>
      </section>

      <section className="metric-row">
        <MetricCard value="1.4k" label="Daily Processed Logs" icon={BarChart3} />
        <MetricCard value="98.2%" label="Workflow Efficiency" icon={Zap} tone="green" />
        <MetricCard value="8.4k" label="Archived Documents" icon={Archive} tone="gold" />
      </section>

      <section className="welcome-cta">
        <h2>Modernize Your Partnership Management</h2>
        <p>Join the world's leading universities in streamlining documentation and scaling global academic cooperation effortlessly.</p>
        <div>
          <button onClick={onLogin}>Get Started Today</button>
        </div>
      </section>

      <footer className="welcome-footer">
        <div>
          <h3><Network size={22} /> CONEXIA</h3>
          <p>Secure and compliant document management for the global higher education ecosystem.</p>
          <div className="footer-icons"><Globe2 /><AtSign /></div>
        </div>
        <FooterColumn title="Platform" items={["Solutions", "Resources", "Accessibility"]} />
        <FooterColumn title="Company" items={["Company", "Contact", "Careers"]} />
        <FooterColumn title="Legal" items={["Compliance", "Legal", "Privacy Policy"]} />
        <small>© 2024 CONEXIA University Document Systems. All rights reserved. Secure and Compliant Document Management.</small>
      </footer>
    </main>
  );
}

// Decorative campus scene used to mirror the Figma welcome hero without external assets.
function CampusIllustration() {
  return (
    <div className="campus-art" aria-hidden="true">
      <div className="orbit" />
      <div className="book-tower" />
      <div className="arch" />
      <div className="building mid" />
      <div className="building tall" />
      <div className="building chapel" />
    </div>
  );
}

function FeatureCard({ icon: Icon, title }) {
  return (
    <article className="feature-card">
      <Icon size={26} />
      <h3>{title}</h3>
      <p>Automated logic for repetitive requests.</p>
    </article>
  );
}

function MetricCard({ value, label, icon: Icon, tone = "" }) {
  return (
    <article className={`metric-card ${tone}`}>
      <strong>{value}</strong>
      <p>{label}</p>
      <Icon />
    </article>
  );
}

function FooterColumn({ title, items }) {
  return (
    <div>
      <h4>{title}</h4>
      {items.map((item) => <a href="#product" key={item}>{item}</a>)}
    </div>
  );
}

// Development login validates known emails and infers each user's role automatically.
function LoginScreen({ onBack, onLogin }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState(DEV_PASSWORD);
  const [error, setError] = React.useState("");

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
          Email
          <input
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            placeholder="name@university.edu"
            autoComplete="email"
          />
        </label>
        <label>
          <span className="password-label">Password <button type="button">Forgot Password?</button></span>
          <input
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit">Sign In <ChevronRight /></button>
        <button type="button" className="text-action" onClick={onBack}>Back to welcome page</button>
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
