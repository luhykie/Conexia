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
  const next = [submission, ...readLocalSubmissions()];
  writeLocalSubmissions(next);
  return submission;
}

export function listLocalSubmissions(filterFn = null) {
  const submissions = readLocalSubmissions();
  return filterFn ? submissions.filter(filterFn) : submissions;
}

export function updateLocalSubmission(id, updater) {
  const submissions = readLocalSubmissions();
  const next = submissions.map((submission) =>
    submission.id === id ? updater(submission) : submission
  );
  writeLocalSubmissions(next);
  return next.find((submission) => submission.id === id) || null;
}
