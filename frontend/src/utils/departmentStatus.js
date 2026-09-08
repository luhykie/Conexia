export function departmentStatusBadgeClass(status) {
  if (typeof status !== "string") return "";

  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === "logged") return "badge logged";
  if (normalizedStatus === "approved") return "badge approved";
  if (
    normalizedStatus === "under review" ||
    (normalizedStatus.includes("review") && !normalizedStatus.includes("complete"))
  ) {
    return "badge under-review";
  }
  if (
    normalizedStatus === "corrections needed" ||
    normalizedStatus === "ready for correction" ||
    normalizedStatus.includes("corrections")
  ) {
    return "badge corrections-needed";
  }
  if (normalizedStatus === "archived") return "badge archived";

  return "";
}
