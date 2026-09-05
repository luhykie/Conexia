import React from "react";
import { getDepartments } from "../services/departmentService";

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function words(value) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function levenshtein(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let index = 1; index <= left.length; index += 1) {
    let previous = row[0];
    row[0] = index;
    for (let inner = 1; inner <= right.length; inner += 1) {
      const current = row[inner];
      row[inner] = left[index - 1] === right[inner - 1]
        ? previous
        : Math.min(previous + 1, row[inner - 1] + 1, current + 1);
      previous = current;
    }
  }
  return row[right.length];
}

function scoreDepartment(query, department) {
  const normalizedQuery = normalize(query);
  const name = normalize(department.name);
  const code = normalize(department.code || "");
  const queryWords = words(query);
  const nameWords = words(department.name);

  if (!normalizedQuery) return null;
  if (code === normalizedQuery) return 1000;
  if (code.startsWith(normalizedQuery) && normalizedQuery.length >= 2) return 850;
  if (name.startsWith(normalizedQuery)) return 800;
  if (name.includes(normalizedQuery)) return 650;

  const wordMatch = queryWords.every((queryWord) =>
    nameWords.some((nameWord) =>
      nameWord.startsWith(queryWord) ||
      levenshtein(queryWord, nameWord) <= Math.max(1, Math.floor(queryWord.length / 5))
    )
  );
  if (wordMatch) return 600;

  const distance = levenshtein(normalizedQuery, name);
  const threshold = Math.max(2, Math.floor(normalizedQuery.length / 4));
  return distance <= threshold ? 500 - distance : null;
}

function findSuggestion(value, departments) {
  const query = value.trim();
  if (query.length < 3) return null;

  const ranked = departments
    .map((department) => ({ department, score: scoreDepartment(query, department) }))
    .filter((entry) => entry.score !== null)
    .sort((left, right) => right.score - left.score);

  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0].score < 800 && ranked[0].score - ranked[1].score < 80) return null;
  return ranked[0].department;
}

export function DepartmentAutocomplete({
  value,
  selectedDepartmentId,
  ownDepartmentId,
  disabled = false,
  onChange,
  onSelect,
}) {
  const inputRef = React.useRef(null);
  const [departments, setDepartments] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!open || departments.length) return undefined;
    let active = true;
    setLoading(true);
    getDepartments({ per_page: 100, sort: "code", direction: "asc" })
      .then((response) => {
        if (active) setDepartments((response.data ?? []).filter((department) => department.id !== ownDepartmentId));
      })
      .catch(() => {
        if (active) setDepartments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [departments.length, open, ownDepartmentId]);

  const suggestion = dismissed || selectedDepartmentId ? null : findSuggestion(value, departments);
  const suffix = suggestion && suggestion.name.toLowerCase().startsWith(value.toLowerCase())
    ? suggestion.name.slice(value.length)
    : suggestion
      ? suggestion.name
      : "";

  function acceptSuggestion() {
    if (!suggestion) return false;
    onSelect(suggestion);
    return true;
  }

  function handleChange(event) {
    setDismissed(false);
    onChange(event.target.value);
    setOpen(true);
  }

  function handleKeyDown(event) {
    if (event.key === "Tab" || (event.key === "ArrowRight" && event.currentTarget.selectionStart === value.length)) {
      if (acceptSuggestion()) {
        event.preventDefault();
        setOpen(false);
      }
    } else if (event.key === "Escape") {
      setDismissed(true);
      setOpen(false);
    }
  }

  return (
    <div className="department-autocomplete">
      <div className="department-autocomplete__inline" aria-hidden="true">
        <span>{value}</span><em>{suffix}</em>
      </div>
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        autoComplete="off"
        placeholder="Search registered department..."
        aria-autocomplete="inline"
        onFocus={() => { setDismissed(false); setOpen(true); }}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && loading && <small className="department-autocomplete__status">Matching registered departments...</small>}
    </div>
  );
}
