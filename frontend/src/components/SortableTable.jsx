import React from "react";
import { DataTable } from "./DataTable";
import "./SortableTable.css";

function textOf(node) {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }

  if (React.isValidElement(node)) {
    return textOf(node.props.children);
  }

  return "";
}

export function SortableTable({
  headers = [],
  rows = [],
  sortableColumns,
  ...props
}) {
  const [sort, setSort] = React.useState(null);

  const sortable = (column) => {
    if (sortableColumns) {
      return sortableColumns.includes(column);
    }

    return column !== "Action" && column !== "Actions";
  };

  const handleDoubleClick = (event) => {
    const header = event.target.closest("th");
    if (!header) return;

    const column = header.cellIndex;
    const columnName = headers[column];
    if (!sortable(columnName)) return;

    window.getSelection()?.removeAllRanges();

    if (!sort || sort.column !== column) {
      setSort({ column, direction: "asc" });
    } else if (sort.direction === "asc") {
      setSort({ column, direction: "desc" });
    } else {
      setSort(null);
    }
  };

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows;

    return [...rows].sort((left, right) => {
      const leftValue = textOf(left[sort.column]).trim();
      const rightValue = textOf(right[sort.column]).trim();
      const leftEmpty = leftValue === "" || leftValue === "-";
      const rightEmpty = rightValue === "" || rightValue === "-";

      if (leftEmpty !== rightEmpty) {
        return leftEmpty ? 1 : -1;
      }
      if (leftEmpty && rightEmpty) return 0;

      const comparison = leftValue.localeCompare(
        rightValue,
        undefined,
        { sensitivity: "base", numeric: true },
      );
      return comparison * (sort.direction === "asc" ? 1 : -1);
    });
  }, [rows, sort]);

  return (
    <div className="sortable-table" onDoubleClick={handleDoubleClick}>
      <DataTable headers={headers} rows={sortedRows} {...props} />
    </div>
  );
}
