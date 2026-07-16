import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Folder,
  Gauge,
  Gavel,
  Grid2X2,
  Info,
  RefreshCw,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";

// Dashboard card data is shared by role dashboards.
export const dashboardStats = {
  department: [
    ["14", "Active Submissions", Grid2X2, "Own Office"],
    ["06", "Pending Corrections", CalendarClock, "Requires Action", "warn"],
    ["128", "Approved", ShieldCheck],
    ["42", "Notarized", Gavel],
  ],
  staff: [
    ["12", "Unlogged", CalendarClock, "+2 New"],
    ["08", "Logged Today", CheckCircle2],
    ["15", "Awaiting Check", ClipboardCheck],
    ["24", "Routed To Legal", Gavel],
  ],
  admin: [
    ["1,284", "Total Submissions", Folder, "+12%"],
    ["42", "Pending Validation", CalendarClock, "! Critical", "warn"],
    ["2.4 days", "Turnaround Avg.", Gauge, "Target"],
    ["892", "Notarized", FileCheck2, "This Month", "dark"],
  ],
  legal: [
    ["14", "Pending Review", CalendarClock, "Priority", "warn"],
    ["08", "Pending Notarization", Gavel, "Staged", "blue"],
    ["22", "Approved", ShieldCheck, "Complete"],
    ["05", "Corrections Sent", FileText, "Action Req", "danger"],
  ],
  super: [
    ["12,842", "Total Submissions", FileText, "+14.2%"],
    ["88.4%", "User Engagement", Users, "+2.1%"],
    ["1,054", "Active Sessions", Gauge, "Monitored"],
    ["32", "Pending Verification", CalendarClock, "Review Required", "danger"],
  ],
};

export const recentActivity = [
  ["#IRO-84920", "Vertex Logistics Corp.", "Annual Audit", "10:45 AM", "Approved"],
  ["#IRO-84918", "Global Nexus Ltd.", "License Renewal", "09:12 AM", "Pending"],
  ["#IRO-84915", "Starlight Foundation", "Compliance Filings", "Yesterday", "Notarized"],
  ["#IRO-84912", "Apex Manufacturing", "Tax Exemption", "Yesterday", "Approved"],
  ["#IRO-84909", "Oceanic Blue LLC", "Risk Assessment", "Oct 24, 2023", "Flagged"],
];

export const expiryRows = [
  ["MOU: Global Tech Internship Program", "Global Tech Solutions", "Expired (3 days ago)", "Critical", "Initiate Renewal"],
  ["Facility Access Lease: Block 4 Annex", "Real Estate Management Corp.", "Expires in 5 days", "Expiring", "Initiate Renewal"],
  ["Data Processing Agreement", "Azure Systems Int.", "Expires in 15 days", "Active", "View Document"],
  ["Student Insurance Master Policy", "Metropolitan Insurance", "Expires in 22 days", "Active", "View Document"],
];

export const incomingRows = [
  ["#IRO-2024-0012", "College of Law", "MOU - Legal Internship", "Oct 24, 2023 09:45 AM", "Submitted"],
  ["#IRO-2024-0013", "Engineering", "MOA - Tech Exchange", "Oct 23, 2023 02:15 PM", "Logged"],
  ["#IRO-2024-0015", "Business School", "MOF - Corporate Funding", "Oct 22, 2023 11:30 AM", "Under Review"],
  ["#IRO-2024-0018", "College of Law", "MOU - Research Collab", "Oct 21, 2023 04:50 PM", "Submitted"],
];

export const archiveStats = [
  ["1,284", "Total Archived", Archive],
  ["24", "Finalized Today", ShieldCheck],
  ["12", "Pending Archival", CalendarClock, "", "warn"],
  ["03", "Audit Flags", Info, "", "danger"],
];

export const notificationRows = [
  ["Urgent", "Correction Requested: MOU Renewal", "October 24, 2023 02:15 PM"],
  ["Success", "Submission Approved: International Research Grant", "October 24, 2023 11:30 AM"],
  ["Success", "Notarization Completed: Property Lease Agreement", "October 23, 2023 04:45 PM"],
  ["Security", "New User Access Granted", "October 23, 2023 09:12 AM"],
  ["Info", "System Maintenance Schedule", "October 22, 2023 01:30 PM"],
];

export const reportStats = [
  ["1,482", "Total Reviewed", FileCheck2, "+12.5% from last quarter"],
  ["94", "Total Returned", RefreshCw, "-4.2% correction rate", "danger"],
  ["1,126", "Total Notarized", Shield, "86% fulfillment rate"],
];
