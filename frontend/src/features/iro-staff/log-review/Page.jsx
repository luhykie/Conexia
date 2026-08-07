import React from "react";

import { PageTitle } from "../../../components/PageTitle";
import { Panel } from "../../../components/Panel";
import { Dropzone } from "../../../components/SharedViews";
import "./Page.css";

export default function IroStaffLogReviewPage() {
  return (
    <section className="page iro-staff-page iro-staff-log-review-page">
      <PageTitle
        title="Log & Review Form"
        subtitle="Verify incoming submission data before routing to Legal."
        action="Mark as Logged"
      />

      <div className="two-col">
        <div>
          <Panel title="Document Preview">
            <div className="doc-preview">
              <h3>Review document from Incoming Submissions</h3>

              <p>
                Open a submitted record from the Incoming Submissions page to
                log it, assign Legal Counsel, and inspect its files.
              </p>
            </div>
          </Panel>
        </div>

        <aside className="review-sidebar">
          <h2>Completeness Check</h2>

          {[
            "Partner Details Verified",
            "Signatory Identified",
            "Standard Template Used",
          ].map((item) => (
            <label className="checkline" key={item}>
              <input type="checkbox" disabled />
              {item}
            </label>
          ))}

          <label>
            Internal Staff Notes
            <textarea
              placeholder="No standalone review endpoint is available yet."
              disabled
            />
          </label>

          <Panel title="Routing & Automation">
            <button
              type="button"
              className="primary wide-inline"
              disabled
              title="Use Incoming Submissions to perform supported workflow actions."
            >
              Generate review form unavailable
            </button>

            <Dropzone
              label="Attach supporting document"
              detail="Use the document file panel on an active submission."
            />
          </Panel>
        </aside>
      </div>
    </section>
  );
}
