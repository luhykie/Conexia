import React from "react";
import { FileText, UploadCloud } from "lucide-react";
import { supabase } from "../supabaseConfig";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { createNotification } from "../utils/notifications";
import { Panel } from "../components/Panel";
import { DashboardView, Dropzone, ExpiryView, FilterBar, NotificationsView } from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { NotificationsPage } from "../components/NotificationsPage";

// Routes all Department Staff pages through one role-owned component.
export function DepartmentStaff({ page, account }) {
  if (page === "submission") return <SubmissionPage account={account} />;
  if (page === "submissions") return <MySubmissionsPage />;
  if (page === "engagements") return <EngagementsPage />;
  if (page === "expiry") return <ExpiryView action="Manual Update" />;
  if (page === "notifications") {
    return <NotificationsPage />;
  }
  
  return (
    <DashboardView
      roleKey="department"
      title="Institutional Workspace"
      subtitle={`Welcome back, ${account.name || account.fullName}. Here is the real-time status for your department.`}
      action="New Submission"
    />
  );
}

// Handles the department upload workflow for new agreements.
function SubmissionPage({ account }) {
  const [form, setForm] = React.useState({
    partnerInstitution: "",
    agreementType: "MOA",
    expectedDuration: "5 Years",
    partnerEmail: "",
    description: "",
  });

  const [submitting, setSubmitting] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [success, setSuccess] =
    React.useState("");

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  function createTrackingNumber() {
    const datePart = new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");

    const randomPart = Math.floor(
      1000 + Math.random() * 9000,
    );

    return `CONEXIA-${datePart}-${randomPart}`;
  }

  async function submitDocument(event) {
    event.preventDefault();

    if (!form.partnerInstitution.trim()) {
      setError(
        "Please enter the partner institution name.",
      );
      return;
    }

    if (!account?.id || !account?.departmentId) {
      setError(
        "Your account has no department assignment.",
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const trackingNumber =
      createTrackingNumber();

    const { data, error: insertError } =
      await supabase
        .from("documents")
        .insert({
          tracking_number: trackingNumber,
          title: `${form.partnerInstitution.trim()} ${form.agreementType}`,
          document_type: form.agreementType,
          partner_institution:
            form.partnerInstitution.trim(),
          partner_email:
            form.partnerEmail.trim() || null,
          description:
            form.description.trim() || null,
          department_id:
            account.departmentId,
          submitted_by:
            account.id,
          status: "Submitted",
        })
        .select(`
          id,
          tracking_number,
          title,
          status
        `)
        .single();

    if (insertError) {
      console.error(
        "Document submission failed:",
        insertError,
      );

      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(
      `Document submitted successfully. Tracking number: ${data.tracking_number}`,
    );

    setForm({
      partnerInstitution: "",
      agreementType: "MOA",
      expectedDuration: "5 Years",
      partnerEmail: "",
      description: "",
    });

    setSubmitting(false);
  }

  return (
    <section className="page department-page">
      <PageTitle
        title="Submit New Document"
        subtitle={`Initiate a formal review process from ${
          account.office || "your department"
        }.`}
      />

      <form onSubmit={submitDocument}>
        <div className="two-col">
          <div>
            <div className="steps">
              <span className="on">
                1<b>Partner Info</b>
              </span>

              <span>
                2<b>Upload</b>
              </span>

              <span>
                3<b>Confirmation</b>
              </span>
            </div>

            <Panel title="Partner Institution Details">
              <div className="form-grid">
                <label>
                  Partner Institution Name

                  <input
                    name="partnerInstitution"
                    value={form.partnerInstitution}
                    onChange={updateForm}
                    placeholder="e.g. Global Tech University"
                    required
                  />
                </label>

                <label>
                  Agreement Type

                  <select
                    name="agreementType"
                    value={form.agreementType}
                    onChange={updateForm}
                  >
                    <option value="MOA">
                      Memorandum of Agreement (MOA)
                    </option>

                    <option value="MOU">
                      Memorandum of Understanding (MOU)
                    </option>

                    <option value="MOF">
                      Memorandum of Funding (MOF)
                    </option>
                  </select>
                </label>

                <label>
                  Expected Duration

                  <select
                    name="expectedDuration"
                    value={form.expectedDuration}
                    onChange={updateForm}
                  >
                    <option value="5 Years">
                      5 Years (Standard)
                    </option>

                    <option value="3 Years">
                      3 Years
                    </option>

                    <option value="1 Year">
                      1 Year
                    </option>
                  </select>
                </label>

                <label>
                  Partner Contact Email

                  <input
                    name="partnerEmail"
                    type="email"
                    value={form.partnerEmail}
                    onChange={updateForm}
                    placeholder="contact@partner.edu"
                  />
                </label>

                <label className="full-width">
                  Description

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateForm}
                    placeholder="Briefly describe the agreement."
                    rows="4"
                  />
                </label>
              </div>
            </Panel>

            <Panel title="Document Upload Section">
              <Dropzone
                label="Drag and drop agreement draft here"
                detail="PDF, DOCX, ODT - MAX 25MB"
              />

              <p>
                File upload will be connected to
                Supabase Storage later. This form
                currently saves the document metadata.
              </p>
            </Panel>

            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                {success}
              </div>
            )}
          </div>

          <aside className="summary-card">
            <h2>Review Summary</h2>

            <p>
              Intended Partner:{" "}
              <b>
                {form.partnerInstitution || "---"}
              </b>
            </p>

            <p>
              Agreement Class:{" "}
              <b>{form.agreementType}</b>
            </p>

            <p>
              Processing Office:{" "}
              <b>
                {account.office ||
                  "Assigned Department"}
              </b>
            </p>

            <p>
              Initial Status:{" "}
              <b>Submitted</b>
            </p>

            <button
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Submitting..."
                : "Submit for Review"}

              {!submitting && (
                <UploadCloud size={18} />
              )}
            </button>

            <button
              type="button"
              className="outline"
              disabled={submitting}
            >
              Save as Draft
            </button>
          </aside>
        </div>
      </form>
    </section>
  );
}

// Shows department-owned submissions and legal comments.
function MySubmissionsPage() {
 const [documents, setDocuments] = React.useState([]);
 const [selectedDocument, setSelectedDocument] =
  React.useState(null);

 const [loading, setLoading] = React.useState(true);
 const [processing, setProcessing] =
  React.useState(false);

 const [error, setError] = React.useState("");
 const [success, setSuccess] = React.useState("");

  React.useEffect(() => {
    async function loadDocuments() {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("documents")
        .select(`
            id,
            tracking_number,
            title,
            document_type,
            partner_institution,
            partner_email,
            description,
            status,
            legal_notes,
            submitted_at,
            updated_at
        `)
        .order("submitted_at", {
          ascending: false,
        });

      if (queryError) {
        console.error(
          "Unable to load submissions:",
          queryError,
        );

        setError(queryError.message);
        setDocuments([]);
      } else {
        const loadedDocuments = data ?? [];

        setDocuments(loadedDocuments);

        setSelectedDocument((current) => {
          if (!loadedDocuments.length) return null;

          return (
            loadedDocuments.find(
              (document) => document.id === current?.id
            ) || loadedDocuments[0]
          );
        });
      }

      setLoading(false);
    }

    loadDocuments();
  }, []);

  const rows = documents.map((document) => [
    document.tracking_number,

    document.partner_institution,

    document.document_type,

    <span
      key={`status-${document.id}`}
      className={`badge ${
        document.status === "Corrections Needed"
          ? "danger"
          : document.status === "Submitted"
            ? "pending"
            : "active"
      }`}
    >
      {document.status}
    </span>,

    <button
      key={`view-${document.id}`}
      type="button"
      className="table-action"
      onClick={() => {
        setSelectedDocument(document);
        setError("");
        setSuccess("");
      }}
    >
      View
    </button>,
  ]);

  async function resubmitDocument() {
    if (!selectedDocument) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("documents")
      .update({
        status: "Submitted",
        legal_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedDocument.id);

    if (error) {
      setError(error.message);
      setProcessing(false);
      return;
    }

    setSuccess("Document successfully resubmitted.");

    const { data } = await supabase
      .from("documents")
      .select(`
        id,
        tracking_number,
        title,
        document_type,
        partner_institution,
        partner_email,
        description,
        status,
        legal_notes,
        submitted_at,
        updated_at
      `)
      .order("submitted_at", {
        ascending: false,
      });

    const loadedDocuments = data ?? [];

    setDocuments(loadedDocuments);

    setSelectedDocument(
      loadedDocuments.find(
        (document) =>
          document.id === selectedDocument.id
      ) || null
    );

    setProcessing(false);
  }

  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle
          title="My Submissions"
          subtitle="Real-time tracking of institutional documents and partner agreements."
        />

        <StatGrid
          stats={[
            [
              String(
                documents.filter((document) =>
                  [
                    "Submitted",
                    "Logged",
                    "Under Legal Review",
                  ].includes(document.status),
                ).length,
              ).padStart(2, "0"),
              "Currently in Review",
              FileText,
              "Active",
            ],
            [
              String(
                documents.filter(
                  (document) =>
                    document.status ===
                    "Pending Notarization",
                ).length,
              ).padStart(2, "0"),
              "Awaiting Notarization",
              FileText,
              "Pending",
              "warn",
            ],
            [
              String(
                documents.filter(
                  (document) =>
                    document.status ===
                    "Corrections Needed",
                ).length,
              ).padStart(2, "0"),
              "Requires Resubmission",
              FileText,
              "Action",
              "danger",
            ],
          ]}
        />

        <Panel title="Submission Records">
          {loading && <p>Loading submissions...</p>}

          {error && (
            <p className="auth-error">
              Unable to load submissions: {error}
            </p>
          )}

          {!loading &&
            !error &&
            documents.length === 0 && (
              <p>
                No submissions are available for this
                department.
              </p>
            )}

          {!loading &&
            !error &&
            documents.length > 0 && (
              <DataTable
                headers={[
                  "Tracking #",
                  "Partner",
                  "Type",
                  "Status",
                  "Action",
                ]}
                rows={rows}
              />
            )}
        </Panel>
      </div>

      <aside className="detail-drawer">
        <h2>Submission Details</h2>

        {!selectedDocument ? (
          <p>Select a submission.</p>
        ) : (
          <>
            <p>
              <b>Tracking #:</b>{" "}
              {selectedDocument.tracking_number}
            </p>

            <p>
              <b>Partner:</b>{" "}
              {selectedDocument.partner_institution}
            </p>

            <p>
              <b>Document Type:</b>{" "}
              {selectedDocument.document_type}
            </p>

            <p>
              <b>Status:</b>{" "}
              {selectedDocument.status}
            </p>

            {selectedDocument.description && (
              <p>
                <b>Description:</b>{" "}
                {selectedDocument.description}
              </p>
            )}

            {selectedDocument.legal_notes && (
              <>
                <h3>Legal Remarks</h3>

                <div className="notice danger">
                  <p>{selectedDocument.legal_notes}</p>
                </div>
              </>
            )}

            {error && (
              <p className="auth-error">
                {error}
              </p>
            )}

            {success && (
              <p className="success-message">
                {success}
              </p>
            )}

            {selectedDocument.status ===
              "Corrections Needed" && (
              <button
                disabled={processing}
                onClick={resubmitDocument}
              >
                {processing
                  ? "Resubmitting..."
                  : "Resubmit Document"}
              </button>
            )}
          </>
        )}
      </aside>
    </section>
  );
}

// Lists external partnerships visible to the department.
function EngagementsPage() {
  return (
    <section className="page split-page department-page">
      <div>
        <PageTitle title="Engagements Management" subtitle="Oversee institutional partnerships and document compliance for your office." action="Create Engagement" />
        <FilterBar labels={["All Institutions", "All", "Active", "Pending", "Expiring"]} />
        <Panel title="Partner Engagements">
          <DataTable
            headers={["Partner Organization", "Agreement", "Duration", "Documents", "Status"]}
          />
        </Panel>
      </div>
      <aside className="detail-drawer">
        <h2>Engagement Details</h2>
        <div className="mini-grid">
          <span>Start Date<b>Jan 12, 2024</b></span>
          <span>Expiration<b>Jan 11, 2029</b></span>
        </div>
        <h3>Submission Compliance</h3>
        <div className="notice"><b>Notarized MOA</b><p>Verified</p></div>
        <div className="notice"><b>Institutional Profile</b><p>Verified</p></div>
        <div className="notice warn"><b>Financial Audit</b><p>Pending</p></div>
        <button className="primary wide-inline">Renew Agreement</button>
      </aside>
    </section>
  );
}
