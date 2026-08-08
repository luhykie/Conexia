import { formatTrackingNumber, getSchoolCode, parseTrackingSequence } from "../utils/school";

const LOCAL_SUBMISSIONS_KEY = "conexia-local-submissions";

function readLocalSubmissions() {
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function writeLocalSubmissions(submissions) {
  try {
    localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(submissions));
  } catch (error) {
    // ignore localStorage write failures
  }
}

function normalizeLocalSubmission(submission, index = 0, submissions = []) {
  if (!submission) return submission;

  const trackingNumber = String(submission.tracking_number || "");
  if (trackingNumber && !trackingNumber.startsWith("local-")) {
    return submission;
  }

  const departmentCode = getSchoolCode(submission.department || submission.office || "SCS");
  const existingSequence = submissions.reduce((max, row) => {
    const rowNumber = String(row?.tracking_number || "");
    const prefix = rowNumber.split("-")[0].toUpperCase();
    if (prefix !== departmentCode) return max;
    return Math.max(max, parseTrackingSequence(rowNumber));
  }, 0);

  return {
    ...submission,
    tracking_number: formatTrackingNumber(departmentCode, Math.max(existingSequence, index + 1)),
  };
}

export function isMissingSubmissionsTableError(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  return (
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("Could not find the table 'public.submissions'")
  );
}

export function addLocalSubmission(submission) {
  const current = readLocalSubmissions();
  const next = [normalizeLocalSubmission(submission, 0, current), ...current];
  writeLocalSubmissions(next);
  return next[0];
}

export function listLocalSubmissions(filterFn = null) {
  const submissions = readLocalSubmissions().map((submission, index, all) =>
    normalizeLocalSubmission(submission, index, all)
  );
  return filterFn ? submissions.filter(filterFn) : submissions;
}

export function updateLocalSubmission(id, updater) {
  const submissions = readLocalSubmissions();
  const next = submissions.map((submission) => {
    const updated = submission.id === id ? updater(submission) : submission;
    return normalizeLocalSubmission(updated, 0, submissions);
  });
  writeLocalSubmissions(next);
  return next.find((submission) => submission.id === id) || null;
}

export function deleteLocalSubmission(id) {
  const submissions = readLocalSubmissions();
  const next = submissions.filter((submission) => submission.id !== id);
  writeLocalSubmissions(next);
  return next;
}
