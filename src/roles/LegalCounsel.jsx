import React from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Gavel,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../supabaseConfig";
import { DataTable } from "../components/DataTable";
import { PageTitle } from "../components/PageTitle";
import { Panel } from "../components/Panel";
import {
  DashboardView,
  Dropzone,
  ExpiryView,
  FilterBar,
} from "../components/SharedViews";
import { StatGrid } from "../components/StatGrid";
import { createNotification } from "../utils/notifications";  
import { NotificationsPage } from "../components/NotificationsPage";

// Routes all Legal Counsel pages through one role-owned component.
export function LegalCounsel({ page }) {
  if (page === "review") {
    return <ReviewQueue />;
  }

  if (page === "notarization") {
    return <NotarizationTracker />;
  }

  if (page === "expiry") {
    return (
      <ExpiryView
        title="Institutional Workspace"
        action="New Submission"
      />
    );
  }

  if (page === "history") {
    return <ActionHistory />;
  }

  if (page === "notifications") {
    return <NotificationsPage />;
  }

  return (
    <DashboardView
      roleKey="legal"
      title="Legal Counsel Dashboard"
      subtitle="Prioritized legal review, approval, return, and notarization workload."
      action="Open Document"
    />
  );
}

// Provides a legal review queue with a side panel for findings and decisions.
function ReviewQueue() {
  const [documents, setDocuments] = React.useState([]);
  const [selectedDocument, setSelectedDocument] =
    React.useState(null);

  const [legalNotes, setLegalNotes] =
    React.useState("");

  const [complianceVerified, setComplianceVerified] =
    React.useState(false);

  const [loading, setLoading] =
    React.useState(true);

  const [processing, setProcessing] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [success, setSuccess] =
    React.useState("");

  async function loadDocuments() {
    setLoading(true);
    setError("");

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError(
        authError?.message ||
          "Unable to identify the signed-in Legal Counsel."
      );

      setLoading(false);
      return;
    }

    const { data, error: queryError } =
      await supabase
        .from("documents")
        .select(`
          id,
          tracking_number,
          title,
          document_type,
          partner_institution,
          partner_email,
          description,
          submitted_by,
          assigned_legal_counsel,
          status,
          legal_notes,
          submitted_at,
          updated_at
        `)
        .eq(
          "assigned_legal_counsel",
          authData.user.id
        )
        .in("status", [
          "Under Legal Review",
          "Corrections Needed",
        ])
        .order("updated_at", {
          ascending: false,
        });

    if (queryError) {
      console.error(
        "Unable to load Legal review documents:",
        queryError
      );

      setError(queryError.message);
      setDocuments([]);
      setSelectedDocument(null);
    } else {
      const loadedDocuments = data ?? [];

      setDocuments(loadedDocuments);

      setSelectedDocument((current) => {
        if (!loadedDocuments.length) {
          return null;
        }

        const currentDocument =
          loadedDocuments.find(
            (document) =>
              document.id === current?.id
          );

        return (
          currentDocument ||
          loadedDocuments[0]
        );
      });
    }

    setLoading(false);
  }

  React.useEffect(() => {
    loadDocuments();
  }, []);

  React.useEffect(() => {
    setLegalNotes(
      selectedDocument?.legal_notes || ""
    );

    setComplianceVerified(false);
    setError("");
    setSuccess("");
  }, [selectedDocument]);

  async function submitDecision(newStatus) {
    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    const notes = legalNotes.trim();

    if (
      newStatus === "Corrections Needed" &&
      !notes
    ) {
      setError(
        "Enter the required corrections before returning the document."
      );

      return;
    }

    if (
      newStatus === "Approved" &&
      !complianceVerified
    ) {
      setError(
        "Check Compliance Verified before approving."
      );

      return;
    }

    const confirmed = window.confirm(
      newStatus === "Approved"
        ? "Approve this document?"
        : "Return this document for corrections?"
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    const { error: updateError } =
      await supabase
        .from("documents")
        .update({
          status: newStatus,
          legal_notes: notes || null,
          updated_at:
            new Date().toISOString(),
        })
  if (updateError) {
      console.error(
        "Unable to save the Legal decision:",
        updateError
      );

      setError(updateError.message);
      setProcessing(false);
      return;
    }

    if (selectedDocument.submitted_by) {
      const notificationResult =
        await createNotification({
          userId: selectedDocument.submitted_by,
          documentId: selectedDocument.id,

          title:
            newStatus === "Approved"
              ? "Document Approved"
              : "Corrections Required",

          message:
            newStatus === "Approved"
              ? `${selectedDocument.tracking_number} has been approved by Legal Counsel.`
              : `${selectedDocument.tracking_number} requires corrections. Please review the remarks and resubmit.`,

          type:
            newStatus === "Approved"
              ? "document_approved"
              : "corrections_required",
        });

      if (!notificationResult.success) {
        console.error(
          "Notification failed:",
          notificationResult.error
        );
      }
    }

    setSuccess(
      newStatus === "Approved"
        ? "Document approved successfully."
        : "Document returned for corrections."
    );

    setLegalNotes("");
setComplianceVerified(false);

await loadDocuments();

setProcessing(false);
    setComplianceVerified(false);

    await loadDocuments();

    setProcessing(false);
  }

  const rows = documents.map(
    (document) => [
      document.tracking_number,

      document.partner_institution,

      document.document_type,

      document.updated_at
        ? new Date(
            document.updated_at
          ).toLocaleDateString()
        : "-",

      <span
        key={`status-${document.id}`}
        className={`badge ${
          document.status ===
          "Corrections Needed"
            ? "danger"
            : "pending"
        }`}
      >
        {document.status}
      </span>,

      <button
        key={`open-${document.id}`}
        type="button"
        className="table-action"
        onClick={() =>
          setSelectedDocument(document)
        }
      >
        Open
      </button>,
    ]
  );

  return (
    <section className="page split-page legal-page">
      <div>
        <PageTitle
          title="Review Queue"
          subtitle="Manage documents explicitly routed for your counsel."
        />

        <FilterBar
          labels={[
            "All Routed",
            "Under Legal Review",
            "Corrections Needed",
          ]}
        />

        <Panel title="Routed Documents">
          {loading && (
            <p>Loading routed documents...</p>
          )}

          {error && !selectedDocument && (
            <p className="auth-error">
              {error}
            </p>
          )}

          {!loading &&
            !error &&
            documents.length === 0 && (
              <p>
                No documents are currently
                assigned to you.
              </p>
            )}

          {!loading &&
            documents.length > 0 && (
              <DataTable
                headers={[
                  "Tracking #",
                  "Partner",
                  "Document Type",
                  "Route Date",
                  "Status",
                  "Action",
                ]}
                rows={rows}
              />
            )}
        </Panel>
      </div>

      <aside className="review-sidebar">
        <h2>Review Sidebar</h2>

        {!selectedDocument ? (
          <p>
            Select a routed document to begin
            reviewing.
          </p>
        ) : (
          <>
            <div className="dropzone">
              <FileText />

              <b>
                {selectedDocument.title}
              </b>

              <p>
                {
                  selectedDocument.tracking_number
                }
                {" · "}
                {
                  selectedDocument.document_type
                }
              </p>
            </div>

            <p>
              <b>Partner:</b>{" "}
              {
                selectedDocument.partner_institution
              }
            </p>

            <p>
              <b>Status:</b>{" "}
              {selectedDocument.status}
            </p>

            {selectedDocument.description && (
              <p>
                <b>Description:</b>{" "}
                {
                  selectedDocument.description
                }
              </p>
            )}

            <label>
              Liability Assessment and Legal
              Findings

              <textarea
                value={legalNotes}
                onChange={(event) =>
                  setLegalNotes(
                    event.target.value
                  )
                }
                placeholder="Enter findings, corrections, or approval remarks..."
              />
            </label>

            <label className="checkline">
              <input
                type="checkbox"
                checked={complianceVerified}
                onChange={(event) =>
                  setComplianceVerified(
                    event.target.checked
                  )
                }
              />

              Compliance Verified
            </label>

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

            <footer>
              <button
                type="button"
                className="outline danger"
                disabled={processing}
                onClick={() =>
                  submitDecision(
                    "Corrections Needed"
                  )
                }
              >
                {processing
                  ? "Saving..."
                  : "Return"}
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() =>
                  submitDecision("Approved")
                }
              >
                {processing
                  ? "Saving..."
                  : "Approve"}
              </button>
            </footer>
          </>
        )}
      </aside>
    </section>
  );
}

// Records and verifies notarization events.
function NotarizationTracker() {
  const [documents, setDocuments] =
    React.useState([]);

  const [
    selectedDocument,
    setSelectedDocument,
  ] = React.useState(null);

  const [
    referenceNumber,
    setReferenceNumber,
  ] = React.useState("");

  const [
    notarizationDate,
    setNotarizationDate,
  ] = React.useState("");

  const [
    signatureCode,
    setSignatureCode,
  ] = React.useState("");

  const [loading, setLoading] =
    React.useState(true);

  const [processing, setProcessing] =
    React.useState(false);

  const [error, setError] =
    React.useState("");

  const [success, setSuccess] =
    React.useState("");

  async function loadDocuments() {
    setLoading(true);
    setError("");

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError(
        authError?.message ||
          "Unable to identify the signed-in Legal Counsel."
      );

      setLoading(false);
      return;
    }

    const { data, error: queryError } =
      await supabase
        .from("documents")
        .select(`
          id,
          tracking_number,
          title,
          document_type,
          partner_institution,
          assigned_legal_counsel,
          status,
          submitted_by,
          legal_notes,
          notarial_reference_number,
          notarization_date,
          notary_signature_code,
          updated_at
        `)
        .eq(
          "assigned_legal_counsel",
          authData.user.id
        )
        .in("status", [
          "Approved",
          "Pending Notarization",
          "Notarized",
        ])
        .order("updated_at", {
          ascending: false,
        });

    if (queryError) {
      console.error(
        "Unable to load notarization documents:",
        queryError
      );

      setError(queryError.message);
      setDocuments([]);
      setSelectedDocument(null);
    } else {
      const loadedDocuments = data ?? [];

      setDocuments(loadedDocuments);

      setSelectedDocument((current) => {
        if (!loadedDocuments.length) {
          return null;
        }

        const currentDocument =
          loadedDocuments.find(
            (document) =>
              document.id === current?.id
          );

        return (
          currentDocument ||
          loadedDocuments[0]
        );
      });
    }

    setLoading(false);
  }

  React.useEffect(() => {
    loadDocuments();
  }, []);

  React.useEffect(() => {
    setReferenceNumber(
      selectedDocument
        ?.notarial_reference_number || ""
    );

    setNotarizationDate(
      selectedDocument
        ?.notarization_date || ""
    );

    setSignatureCode(
      selectedDocument
        ?.notary_signature_code || ""
    );

    setError("");
    setSuccess("");
  }, [selectedDocument]);

  function validateNotarizationFields() {
    if (
      !referenceNumber.trim() ||
      !notarizationDate ||
      !signatureCode.trim()
    ) {
      setError(
        "Complete the reference number, notarization date, and signature code."
      );

      return false;
    }

    return true;
  }

  async function submitNotarization() {
    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    if (
      selectedDocument.status !== "Approved"
    ) {
      setError(
        "Only approved documents can be submitted for notarization."
      );

      return;
    }

    if (!validateNotarizationFields()) {
      return;
    }

    const confirmed = window.confirm(
      "Submit this document for notarization?"
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    if (selectedDocument.submitted_by) {
      const notificationResult =
        await createNotification({
          userId: selectedDocument.submitted_by,
          documentId: selectedDocument.id,
          title: "Pending Notarization",
          message: `${selectedDocument.tracking_number} has been submitted for notarization.`,
          type: "pending_notarization",
        });

      if (!notificationResult.success) {
        console.error(
          "Notification failed:",
          notificationResult.error
        );
      }
    }

    const { error: updateError } =
      await supabase
        .from("documents")
        .update({
          status: "Pending Notarization",

          notarial_reference_number:
            referenceNumber.trim(),

          notarization_date:
            notarizationDate,

          notary_signature_code:
            signatureCode.trim(),

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", selectedDocument.id);

    if (updateError) {
      console.error(
        "Unable to submit document for notarization:",
        updateError
      );

      setError(updateError.message);
      setProcessing(false);
      return;
    }

    setSuccess(
      "Document submitted for notarization successfully."
    );

    await loadDocuments();

    setProcessing(false);
  }

  async function completeNotarization() {
    if (!selectedDocument) {
      setError("Select a document first.");
      return;
    }

    if (
      selectedDocument.status !==
      "Pending Notarization"
    ) {
      setError(
        "Only documents pending notarization can be completed."
      );

      return;
    }

    if (!validateNotarizationFields()) {
      return;
    }

    const confirmed = window.confirm(
      "Mark this document as notarized?"
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    if (selectedDocument.submitted_by) {
      const notificationResult =
        await createNotification({
          userId: selectedDocument.submitted_by,
          documentId: selectedDocument.id,
          title: "Document Notarized",
          message: `${selectedDocument.tracking_number} has been successfully notarized.`,
          type: "document_notarized",
        });

      if (!notificationResult.success) {
        console.error(
          "Notification failed:",
          notificationResult.error
        );
      }
    }

    const { error: updateError } =
      await supabase
        .from("documents")
        .update({
          status: "Notarized",

          notarial_reference_number:
            referenceNumber.trim(),

          notarization_date:
            notarizationDate,

          notary_signature_code:
            signatureCode.trim(),

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", selectedDocument.id);

    if (updateError) {
      console.error(
        "Unable to complete notarization:",
        updateError
      );

      setError(updateError.message);
      setProcessing(false);
      return;
    }

    setSuccess(
      "Document notarization completed successfully."
    );

    await loadDocuments();

    setProcessing(false);
  }

  const totalQueue = documents.length;

  const pendingCount =
    documents.filter(
      (document) =>
        document.status ===
        "Pending Notarization"
    ).length;

  const completedCount =
    documents.filter(
      (document) =>
        document.status === "Notarized"
    ).length;

  const rows = documents.map(
    (document) => [
      document.tracking_number,

      document.partner_institution,

      <span
        key={`status-${document.id}`}
        className={`badge ${
          document.status === "Notarized"
            ? "active"
            : document.status ===
                "Pending Notarization"
              ? "pending"
              : ""
        }`}
      >
        {document.status}
      </span>,

      document.updated_at
        ? new Date(
            document.updated_at
          ).toLocaleDateString()
        : "-",

      <button
        key={`select-${document.id}`}
        type="button"
        className="table-action"
        onClick={() =>
          setSelectedDocument(document)
        }
      >
        Select
      </button>,
    ]
  );

  const canEdit =
    selectedDocument &&
    [
      "Approved",
      "Pending Notarization",
    ].includes(selectedDocument.status);

  return (
    <section className="page legal-page">
      <PageTitle
        title="Notarization Tracker"
        subtitle="Track approved documents and pending notarization records."
      />

      <StatGrid
        stats={[
          [
            String(totalQueue).padStart(
              2,
              "0"
            ),
            "Total Queue",
            Gavel,
          ],

          [
            String(pendingCount).padStart(
              2,
              "0"
            ),
            "Pending Notarization",
            CalendarClock,
            "",
            "blue",
          ],

          [
            String(
              completedCount
            ).padStart(2, "0"),
            "Completed",
            CheckCircle2,
          ],
        ]}
      />

      <div className="two-col">
        <Panel title="Document Tracking Queue">
          {loading && (
            <p>
              Loading notarization
              documents...
            </p>
          )}

          {error &&
            !selectedDocument && (
              <p className="auth-error">
                {error}
              </p>
            )}

          {!loading &&
            !error &&
            documents.length === 0 && (
              <p>
                No documents are ready for
                notarization.
              </p>
            )}

          {!loading &&
            documents.length > 0 && (
              <DataTable
                headers={[
                  "Document ID",
                  "Entity / Client",
                  "Status",
                  "Last Activity",
                  "Action",
                ]}
                rows={rows}
              />
            )}
        </Panel>

        <aside className="form-card">
          <h2>Record Notarization</h2>

          <label>
            Selected Document ID

            <input
              value={
                selectedDocument
                  ?.tracking_number || ""
              }
              readOnly
              placeholder="Select a document"
            />
          </label>

          <label>
            Notarial Reference Number

            <input
              value={referenceNumber}
              disabled={
                processing || !canEdit
              }
              onChange={(event) =>
                setReferenceNumber(
                  event.target.value
                )
              }
              placeholder="Enter reference number"
            />
          </label>

          <label>
            Date of Notarization

            <input
              type="date"
              value={notarizationDate}
              disabled={
                processing || !canEdit
              }
              onChange={(event) =>
                setNotarizationDate(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Notary Public Signature Code

            <input
              value={signatureCode}
              disabled={
                processing || !canEdit
              }
              onChange={(event) =>
                setSignatureCode(
                  event.target.value
                )
              }
              placeholder="Enter signature code"
            />
          </label>

          {selectedDocument && (
            <p>
              <b>Status:</b>{" "}
              {selectedDocument.status}
            </p>
          )}

          {selectedDocument?.status ===
            "Notarized" && (
            <div className="notice">
              <b>
                Notarization Completed
              </b>

              <p>
                Reference Number:{" "}
                {selectedDocument
                  .notarial_reference_number ||
                  "-"}
              </p>

              <p>
                Notarization Date:{" "}
                {selectedDocument
                  .notarization_date || "-"}
              </p>

              <p>
                Signature Code:{" "}
                {selectedDocument
                  .notary_signature_code || "-"}
              </p>
            </div>
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

          {selectedDocument?.status ===
            "Approved" && (
            <button
              type="button"
              disabled={processing}
              onClick={submitNotarization}
            >
              {processing
                ? "Submitting..."
                : "Submit for Notarization"}
            </button>
          )}

          {selectedDocument?.status ===
            "Pending Notarization" && (
            <button
              type="button"
              disabled={processing}
              onClick={
                completeNotarization
              }
            >
              {processing
                ? "Completing..."
                : "Complete Notarization"}
            </button>
          )}

          {selectedDocument?.status ===
            "Notarized" && (
            <button
              type="button"
              disabled
            >
              Notarization Completed
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}

// Lists the legal team's review and notarization history.
function ActionHistory() {
  const historyItems = [
    [
      "Approved #USJR-2023-0842",
      "Review of Commercial Master Services Agreement completed successfully.",
      "Verified",
    ],

    [
      "Notarized Entry #NX-9921",
      "Digital notarial seal applied to Partnership Addendum.",
      "Recorded",
    ],

    [
      "Rejected #UK-LTD-4401",
      "Insufficient identity verification documents provided.",
      "Correction",
    ],
  ];

  return (
    <section className="page legal-page">
      <PageTitle
        title="Legal Action History"
        subtitle="Audit Log & Activity"
        action="Download Report"
      />

      <FilterBar
        labels={[
          "All Entities",
          "Date Range",
          "Any Status",
        ]}
      />

      <div className="two-col">
        <Panel title="Audit Log & Activity">
          {historyItems.map(
            (
              [title, detail, status],
              index
            ) => (
              <div
                className={`timeline-item ${
                  index === 2
                    ? "danger"
                    : ""
                }`}
                key={title}
              >
                <b>{title}</b>

                <p>{detail}</p>

                <span
                  className={`badge ${
                    index === 2
                      ? "danger"
                      : ""
                  }`}
                >
                  {status}
                </span>
              </div>
            )
          )}
        </Panel>

        <Panel title="Expiring Soon">
          <div className="notice danger">
            <b>
              Strategic Alliances Ltd.
            </b>

            <p>
              Expires in 3 days -
              #CERT-998-AX
            </p>

            <button className="primary">
              Flag for Renewal
            </button>
          </div>

          <div className="notice warn">
            <b>Cloud Systems Inc.</b>

            <p>
              Expires in 12 days -
              #CERT-204-VY
            </p>

            <button className="outline">
              Flag for Renewal
            </button>
          </div>

          <section className="dark-card">
            <ShieldCheck />

            <div>
              <h2>
                Compliance Status
              </h2>

              <p>
                4 agreements require
                notarization updates this
                month.
              </p>
            </div>
          </section>
        </Panel>
      </div>
    </section>
  );
}