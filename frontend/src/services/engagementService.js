import { apiRequest } from "./documentService";

export async function getEngagements() {
  const result = await apiRequest("/iro-admin/engagements");
  return result.data ?? result;
}

export async function getEngagementOptions() {
  const result = await apiRequest("/iro-admin/engagements/options");
  return result.data ?? result;
}

export async function createEngagement(values) {
  const body = new FormData();
  const scalarFields = [
    "agreement_type", "engagement_type", "partner_classification",
    "partner_name", "partner_email", "partner_contact", "partner_address",
    "agreement_title", "agreement_summary", "effective_date", "expiry_date",
  ];
  scalarFields.forEach((field) => {
    if (values[field]) body.append(field, values[field]);
  });
  values.department_ids.forEach((id) => body.append("department_ids[]", id));
  values.distribution_recipient_ids.forEach((id) =>
    body.append("distribution_recipient_ids[]", id)
  );
  body.append("draft", values.draft);
  Array.from(values.attachments || []).forEach((file) =>
    body.append("attachments[]", file)
  );

  const result = await apiRequest("/iro-admin/engagements", {
    method: "POST",
    body,
  });
  window.dispatchEvent(new CustomEvent("conexia:workflow-changed"));
  return result.data ?? result;
}
