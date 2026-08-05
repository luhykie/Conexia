import { departments } from "./departments";

// Development seed users mirror the requested test accounts.
export const seedUsers = [
  {
    fullName: "Conexia Super Admin",
    email: "admin@conexia.edu",
    role: "Super Admin",
    roleKey: "super",
    office: "System Administration",
    department: "-",
    status: "Active",
  },
  {
    fullName: "PAIR IRO Staff",
    email: "irostaff@conexia.edu",
    role: "IRO Staff",
    roleKey: "staff",
    office: "Partnerships and International Relations Office",
    department: "-",
    status: "Active",
  },
  {
    fullName: "PAIR IRO Administrator",
    email: "iroadmin@conexia.edu",
    role: "IRO Admin",
    roleKey: "admin",
    office: "Partnerships and International Relations Office",
    department: "-",
    status: "Active",
  },
  {
    fullName: "Legal Counsel",
    email: "legal@conexia.edu",
    role: "Legal Counsel",
    roleKey: "legal",
    office: "Legal Office",
    department: "-",
    status: "Active",
  },
  ...departments.map((department) => ({
    fullName: `${department.code} Department Staff`,
    email: department.email,
    role: "Department Staff",
    roleKey: "department",
    office: department.name,
    department: department.code,
    status: "Active",
  })),
];
