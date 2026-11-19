// [FEATURE: Shared/Utility] - provides shared application infrastructure and reusable interface behavior.
import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

const tableStateByKey = new Map();
const FILTERABLE_HEADER = /status|scope|type|role|department|office|level|access/i;
const ACTION_HEADER = /action/i;

// Coordinates table within the shared application infrastructure and reusable interface behavior workflow.
export function DataTable({
  headers = [],
  rows = [],
  meta,
  onPageChange,
  emptyMessage = "No records found.",
  columnClasses = [],
  statusColumnIndex,
  rowClasses = [],
  sortable = true,
  filterable = true,
  tableId,
}) {
  const tableKey = tableId !== undefined
    ? tableId
    : `${typeof window === "undefined" ? "" : window.location.pathname}|${headers.join("|")}`;
  const [tableState, setTableState] = useState(
    () => tableStateByKey.get(tableKey) || { sort: null, filters: {} },
  );
  useEffect(() => {
    tableStateByKey.set(tableKey, tableState);
  }, [tableKey, tableState]);
  const currentPage = toFiniteNumber(meta?.current_page, 1);
  const lastPage = toFiniteNumber(meta?.last_page, 1);
  const perPage = toFiniteNumber(meta?.per_page, rows.length || 1);
  const total = toFiniteNumber(meta?.total, rows.length);
  const from = rows.length
    ? ((currentPage - 1) * perPage) + 1
    : 0;
  const to = rows.length
    ? from + rows.length - 1
    : 0;

  const filterColumns = filterable
    ? headers.reduce((columns, header, columnIndex) => {
        const label = cellText(header).trim();
        if (!label || ACTION_HEADER.test(label)) return columns;

        const values = new Map();
        rows.forEach((row) => {
          const value = cellText(row[columnIndex]).trim();
          if (value) values.set(value, (values.get(value) || 0) + 1);
        });

        const distinctValues = [...values.keys()];

        const alwaysFilterable = FILTERABLE_HEADER.test(label);
        const selectedValue = tableState.filters[columnIndex];
        const repeatedCategory = distinctValues.length >= 2 &&
          distinctValues.length <= 8 &&
          [...values.values()].every((count) => count > 1);
        const selectFilter = distinctValues.length <= 30 &&
          (alwaysFilterable || repeatedCategory);

        if (label) {
          if (selectFilter && selectedValue && !values.has(selectedValue)) {
            values.set(selectedValue, 0);
          }

          columns.push({
            columnIndex,
            label,
            type: selectFilter ? "select" : "search",
            values: [...values.keys()],
          });
        }

        return columns;
      }, [])
    : [];
  const activeFilters = filterable ? tableState.filters : {};
  const hasActiveFilter = Object.values(activeFilters).some((value) => value !== "");
  const activeSort = sortable ? tableState.sort : null;
  const hasActiveSortOrFilter = Boolean(activeSort || hasActiveFilter);
  const filterTypes = new Map(filterColumns.map(({ columnIndex, type }) => [columnIndex, type]));
  const originalRows = rows.map((row, originalIndex) => ({ row, originalIndex }));
  const visibleRows = originalRows.filter(({ row }) =>
    Object.entries(activeFilters).every(([columnIndex, selectedValue]) =>
      selectedValue === "" ||
      (filterTypes.get(Number(columnIndex)) === "select"
        ? cellText(row[Number(columnIndex)]).trim() === selectedValue
        : cellText(row[Number(columnIndex)]).trim().toLocaleLowerCase()
          .includes(selectedValue.trim().toLocaleLowerCase())),
    ),
  );
  const displayRows = activeSort
    ? visibleRows.slice().sort((left, right) => {
        const leftValue = cellText(left.row[activeSort.columnIndex]).trim();
        const rightValue = cellText(right.row[activeSort.columnIndex]).trim();
        const leftEmpty = !leftValue || leftValue === "-";
        const rightEmpty = !rightValue || rightValue === "-";

        if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1;
        if (leftEmpty) return left.originalIndex - right.originalIndex;

        const comparison = compareCellValues(leftValue, rightValue);
        if (comparison === 0) return left.originalIndex - right.originalIndex;
        return comparison * (activeSort.direction === "asc" ? 1 : -1);
      })
    : visibleRows;

  function updateTableState(update) {
    setTableState(update);
  }

  function toggleSort(columnIndex) {
    updateTableState((previousState) => {
      const currentSort = previousState.sort;
      let nextSort = { columnIndex, direction: "asc" };

      if (currentSort?.columnIndex === columnIndex) {
        if (currentSort.direction === "asc") {
          nextSort = { columnIndex, direction: "desc" };
        } else {
          nextSort = null;
        }
      }

      return { ...previousState, sort: nextSort };
    });
  }

  function updateFilter(columnIndex, value) {
    updateTableState((previousState) => ({
      ...previousState,
      filters: { ...previousState.filters, [columnIndex]: value },
    }));
  }

  function resetTableState() {
    updateTableState(() => ({ sort: null, filters: {} }));
  }

  return (
    <div className="cx-table">
      {(sortable || filterable) && (
        <div className="cx-table-filters">
          {filterColumns.map(({ columnIndex, label, type, values }) => (
            <label className="cx-table-filter" key={columnIndex}>
              <span>{label}</span>
              {type === "select" ? (
                <select
                  aria-label={`Filter by ${label}`}
                  value={activeFilters[columnIndex] || ""}
                  onChange={(event) => updateFilter(columnIndex, event.target.value)}
                >
                  <option value="">All</option>
                  {values.map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="search"
                  aria-label={`Filter by ${label}`}
                  placeholder={`Search ${label}`}
                  value={activeFilters[columnIndex] || ""}
                  onChange={(event) => updateFilter(columnIndex, event.target.value)}
                />
              )}
            </label>
          ))}
          <button
            type="button"
            className="cx-table-filter-reset"
            onClick={resetTableState}
          >
            Reset
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            {headers.map((header, headerIndex) => {
              const label = cellText(header).trim();
              const canSortColumn = sortable && label && !ACTION_HEADER.test(label);
              const isSorted = activeSort?.columnIndex === headerIndex;
              const SortIcon = isSorted
                ? activeSort.direction === "asc" ? ArrowUp : ArrowDown
                : ArrowUpDown;

              return (
                <th
                  key={headerIndex}
                  className={columnClasses[headerIndex] || ""}
                  aria-sort={isSorted
                    ? activeSort.direction === "asc" ? "ascending" : "descending"
                    : "none"}
                >
                  {canSortColumn ? (
                    <button
                      type="button"
                      className="cx-sort-button"
                      aria-label={`Sort by ${label}${isSorted ? `, ${activeSort.direction}ending` : ""}`}
                      onClick={() => toggleSort(headerIndex)}
                    >
                      <span>{header}</span>
                      <SortIcon aria-hidden="true" size={14} />
                    </button>
                  ) : header}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="cx-table-empty"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : displayRows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="cx-table-empty">
                No records on this page match the selected filters.
              </td>
            </tr>
          ) : (
            displayRows.map(({ row, originalIndex }) => (
              <tr key={originalIndex} className={rowClasses[originalIndex] || ""}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={[
                      columnClasses[cellIndex] || "",
                      statusColumnIndex === undefined && cellIndex === row.length - 1
                        ? statusClass(cell)
                        : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {cellIndex === statusColumnIndex
                      ? <span className={statusClass(cell)}>{cell}</span>
                      : cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <footer className="cx-table-footer">
        <span>
          {hasActiveFilter
            ? `Showing ${displayRows.length} of ${rows.length} on this page (${total} total)`
            : `Showing ${from}-${to} of ${total}`}
          {hasActiveSortOrFilter && lastPage > 1 && (
            <span className="cx-table-page-note">
              Sorting and filters apply to the rows on this page only.
            </span>
          )}
        </span>

        <div className="cx-pagination">
          <button
            disabled={!onPageChange || currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>

          <span>
            {currentPage} / {lastPage}
          </span>

          <button
            disabled={
              !onPageChange ||
              currentPage >= lastPage
            }
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}

function cellText(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(cellText).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  if (React.isValidElement(value)) {
    return cellText(value.props.children);
  }

  return "";
}

function compareCellValues(leftValue, rightValue) {
  const leftDate = dateValue(leftValue);
  const rightDate = dateValue(rightValue);
  if (leftDate !== null && rightDate !== null) {
    return leftDate - rightDate;
  }

  const leftNumber = numericValue(leftValue);
  const rightNumber = numericValue(rightValue);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }

  return leftValue.localeCompare(
    rightValue,
    undefined,
    { numeric: true, sensitivity: "base" },
  );
}

function numericValue(value) {
  const match = value.match(/^(?:[$€£¥]\s*)?([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|[+-]?\.\d+)\s*(?:%|[a-z]+)?$/i);
  if (!match) return null;

  const number = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function dateValue(value) {
  const looksLikeDate =
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[t\s].*)?$/i.test(value) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value) ||
    /^[a-z]{3,9}\s+\d{1,2},?\s+\d{2,4}(?:\s+.*)?$/i.test(value) ||
    /^\d{1,2}\s+[a-z]{3,9}\s+\d{2,4}$/i.test(value);
  if (!looksLikeDate) return null;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

// Coordinates class within the shared application infrastructure and reusable interface behavior workflow.
function statusClass(value) {
  if (typeof value !== "string") return "";

  return `badge ${value
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}
