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

const SCHOOL_CODE_ALIASES = {
  "school of computer studies": "SCS",
  "computer studies": "SCS",
  scs: "SCS",
  "school of business management": "SBM",
  "business management": "SBM",
  sbm: "SBM",
  "school of engineering and architecture": "SEA",
  "engineering and architecture": "SEA",
  sea: "SEA",
  "school of education": "SED",
  education: "SED",
  sed: "SED",
  "school of law": "SOL",
  law: "SOL",
  sol: "SOL",
  "school of arts and sciences": "SAS",
  "arts and sciences": "SAS",
  sas: "SAS",
  sams: "SAMS",
  "school of allied medical sciences": "SAMS",
  "expanded tertiary education equivalency and accreditation program": "ETEEAP",
  eteeap: "ETEEAP",
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

export function getSchoolCode(source) {
  const value = String(source || "").trim();
  if (!value) return "SCS";

  const normalized = value.toLowerCase();
  if (SCHOOL_CODE_ALIASES[normalized]) return SCHOOL_CODE_ALIASES[normalized];
  if (SCHOOL_CODE_ALIASES[value.toUpperCase()]) return SCHOOL_CODE_ALIASES[value.toUpperCase()];

  if (/^[A-Z0-9]{3,8}$/.test(value.toUpperCase())) {
    return value.toUpperCase();
  }

  return "SCS";
}

export function formatTrackingNumber(code, sequence) {
  const prefix = getSchoolCode(code);
  const safeSequence = Number.isFinite(sequence) && sequence > 0 ? sequence : 1;
  return `${prefix}-${String(safeSequence).padStart(5, "0")}`;
}

export function getTrackingPrefix(row) {
  return getSchoolCode(row?.department || row?.office || row?.tracking_number || "SCS");
}

export function parseTrackingSequence(value) {
  const match = String(value || "").match(/-(\d{1,})$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}
