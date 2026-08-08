import React, {
  useState,
} from "react";
import {
  KeyRound,
  Mail,
  Paintbrush,
  Save,
  Settings,
} from "lucide-react";
import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Button } from "../../../components/Button/Button";
import "./Page.css";

export default function Page() {
  const [settings, setSettings] = useState({
    systemName: "CONEXIA",
    universityName: "University of San Jose-Recoletos",
    minimumPasswordLength: 8,
    sessionTimeout: 30,
    senderEmail: "noreply@conexia.edu",
  });

  function updateSetting(event) {
    const { name, value } = event.target;

    setSettings((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return (
    <section className="super-admin-page">
      <PageTitle
        title="System Settings"
        subtitle="Review deployment-facing configuration. Saving requires a backend settings endpoint."
      >
        <Button icon={Save} disabled>
          Save Settings - Backend Required
        </Button>
      </PageTitle>

      <div className="settings-grid">
        <SettingsPanel icon={Paintbrush} title="Branding">
          <label>
            System Name
            <input name="systemName" value={settings.systemName} onChange={updateSetting} />
          </label>
          <label>
            University Name
            <input name="universityName" value={settings.universityName} onChange={updateSetting} />
          </label>
        </SettingsPanel>

        <SettingsPanel icon={KeyRound} title="Authentication Policy">
          <label>
            Minimum Password Length
            <input
              name="minimumPasswordLength"
              type="number"
              min="6"
              value={settings.minimumPasswordLength}
              onChange={updateSetting}
            />
          </label>
          <label>
            Session Timeout Minutes
            <input
              name="sessionTimeout"
              type="number"
              min="5"
              value={settings.sessionTimeout}
              onChange={updateSetting}
            />
          </label>
        </SettingsPanel>

        <SettingsPanel icon={Mail} title="Mail">
          <label>
            Sender Email
            <input
              name="senderEmail"
              type="email"
              value={settings.senderEmail}
              onChange={updateSetting}
            />
          </label>
          <Button icon={Mail} disabled>
            Send Test Email - Backend Required
          </Button>
        </SettingsPanel>

        <SettingsPanel icon={Settings} title="Maintenance">
          <p>
            Maintenance mode, backup creation, and restore controls need
            dedicated backend endpoints before they can be enabled.
          </p>
        </SettingsPanel>
      </div>
    </section>
  );
}

function SettingsPanel({ icon: Icon, title, children }) {
  return (
    <Panel title={title}>
      <div className="settings-panel">
        <Icon size={22} />
        {children}
      </div>
    </Panel>
  );
}
