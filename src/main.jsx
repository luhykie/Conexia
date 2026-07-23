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
import { fetchProfile, signInWithEmail, signOut } from "./auth/supabaseAuth";
import { supabase } from "./lib/supabaseClient";
import { canAccessPage, getDefaultPage } from "./auth/rbac";
import { isSupabaseConfigured } from "./supabaseConfig";
import { Shell } from "./components/Shell";
import { DepartmentStaff } from "./pages/roles/DepartmentStaff";
import { IroAdmin } from "./pages/roles/IroAdmin";
import { IroStaff } from "./pages/roles/IroStaff";
import { LegalCounsel } from "./pages/roles/LegalCounsel";
import { SuperAdmin } from "./pages/roles/SuperAdmin";
import {BrowserRouter, Navigate, Route, Routes, useNavigate, useParams,} from "react-router-dom";

// Main controller for the public welcome page, development login, and RBAC page dispatch.
const AUTH_STORAGE_KEY = "conexia-account";

function getSavedAccount() {
  try {
    const savedAccount = localStorage.getItem(AUTH_STORAGE_KEY);

    return savedAccount ? JSON.parse(savedAccount) : null;
  } catch (error) {
    console.error("Unable to restore saved account:", error);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function App() {
  const [account, setAccount] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // On first load, check if a Supabase session already exists (page refresh case).
    async function restoreSession() {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        const profile = await fetchProfile(data.session.user.id);
        setAccount(profile);
      }

      setLoading(false);
    }

    restoreSession();

    // Keep account in sync if the session changes elsewhere (e.g. token refresh, logout in another tab).
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setAccount(null);
        return;
      }

      const profile = await fetchProfile(session.user.id);
      setAccount(profile);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function handleLogin(nextAccount) {
    setAccount(nextAccount);
  }

  async function handleLogout() {
    await signOut();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAccount(null);
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          account
            ? <Navigate to={`/app/${getDefaultPage(account.roleKey)}`} replace />
            : <WelcomeRoute />
        }
      />

      <Route
        path="/login"
        element={
          account
            ? <Navigate to={`/app/${getDefaultPage(account.roleKey)}`} replace />
            : <LoginRoute onLogin={handleLogin} />
        }
      />

      <Route
        path="/app/:page"
        element={
          account
            ? (
              <WorkspaceRoute
                account={account}
                onLogout={handleLogout}
              />
            )
            : <Navigate to="/login" replace />
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function WelcomeRoute() {
  const navigate = useNavigate();

  return (
    <WelcomePage
      onLogin={() => navigate("/login")}
    />
  );
}

function LoginRoute({ onLogin }) {
  const navigate = useNavigate();

  function handleSuccessfulLogin(nextAccount) {
    onLogin(nextAccount);

    navigate(
      `/app/${getDefaultPage(nextAccount.roleKey)}`,
      { replace: true }
    );
  }

  return (
    <LoginScreen
      onBack={() => navigate("/")}
      onLogin={handleSuccessfulLogin}
    />
  );
}

function WorkspaceRoute({ account, onLogout }) {
  const navigate = useNavigate();
  const { page = "dashboard" } = useParams();

  const safePage = canAccessPage(account.roleKey, page)
    ? page
    : getDefaultPage(account.roleKey);

  React.useEffect(() => {
    if (page !== safePage) {
      navigate(`/app/${safePage}`, { replace: true });
    }
  }, [page, safePage, navigate]);

  function navigateToPage(nextPage) {
    if (!canAccessPage(account.roleKey, nextPage)) {
      navigate(
        `/app/${getDefaultPage(account.roleKey)}`,
        { replace: true }
      );

      return;
    }

    navigate(`/app/${nextPage}`);
  }

  function handleLogout() {
    onLogout();
    navigate("/", { replace: true });
  }

  return (
    <Shell
      roleKey={account.roleKey}
      page={safePage}
      setPage={navigateToPage}
      account={account}
      onLogout={handleLogout}
    >
      <RolePage
        roleKey={account.roleKey}
        page={safePage}
        account={account}
      />
    </Shell>
  );
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
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signInWithEmail(email, password);

    setLoading(false);

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
            placeholder="role@conexia.edu"
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
        <button type="submit" disabled={loading}>{loading ? "Signing In..." : "Sign In"} <ChevronRight /></button>
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

// Selects the correct role module after RBAC has allowed the page.
function RolePage({ roleKey, page, account }) {
  if (roleKey === "super") return <SuperAdmin page={page} account={account} />;
  if (roleKey === "admin") return <IroAdmin page={page} account={account} />;
  if (roleKey === "staff") return <IroStaff page={page} account={account} />;
  if (roleKey === "legal") return <LegalCounsel page={page} account={account} />;
  return <DepartmentStaff page={page} account={account} />;
}

const root = createRoot(document.getElementById("root"));

if (!isSupabaseConfigured) {
  root.render(
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#b00020' }}>Configuration required</h2>
      <p>
        Supabase is not configured for this environment. Please add the following environment variables to a local env file (e.g. <code>.env.local</code>) and restart the dev server:
      </p>
      <ul>
        <li><code>VITE_SUPABASE_URL</code> — your Supabase project URL</li>
        <li><code>VITE_SUPABASE_ANON_KEY</code> — your Supabase anon (public) key</li>
      </ul>
      <p>After updating the file, run <code>npm run dev</code> to restart Vite.</p>
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}