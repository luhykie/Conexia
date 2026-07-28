const SCHOOL_LABELS = {
  SCS: "School of Computer Studies",
  SBM: "School of Business Management",
  SEA: "School of Engineering and Architecture",
  SED: "School of Education",
  SOL: "School of Law",
  SAS: "School of Arts and Sciences",
};

const SCHOOL_NAME_ALIASES = {
  "school of computer studies": "School of Computer Studies",
  "computer studies": "School of Computer Studies",
  "school of business management": "School of Business Management",
  "business management": "School of Business Management",
  "school of engineering and architecture": "School of Engineering and Architecture",
  "engineering and architecture": "School of Engineering and Architecture",
  "school of education": "School of Education",
  education: "School of Education",
  "school of law": "School of Law",
  law: "School of Law",
  "school of arts and sciences": "School of Arts and Sciences",
  "arts and sciences": "School of Arts and Sciences",
};

export function getSchoolLabel(row) {
  const trackingPrefix = String(row?.tracking_number || "").split("-")[0].toUpperCase();
  const source = String(row?.department || row?.office || "").trim().toLowerCase();

  return (
    SCHOOL_LABELS[trackingPrefix] ||
    SCHOOL_NAME_ALIASES[source] ||
    row?.department ||
    row?.office ||
    "School of Computer Studies"
  );
}
