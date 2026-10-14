import { Suspense } from "react";
import Link from "next/link";
import { hasPermission, requireUser } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import Spinner from "@/components/Spinner";
import { VscGraph } from "react-icons/vsc";
import Navigation from "@/components/Navigation";
import SideMenu from "@/components/SideMenu/SideMenu";
import { Calendar, HistoryIcon } from "lucide-react";
import { FaFileExcel, FaHome } from "react-icons/fa";
import { PiUsersFill } from "react-icons/pi";
import { RiBuilding4Fill } from "react-icons/ri";
import { FaMedal } from "react-icons/fa";
import { FaUserCheck } from "react-icons/fa";

async function AuthShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = [
    { href: "/home", label: "Dashboard", show: true },
    {
      href: "/employees",
      label: "Employees",
      show: hasPermission(user, PERMISSIONS.EMPLOYEES_VIEW),
    },
    {
      href: "/departments",
      label: "Departments",
      show: hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE),
    },
    {
      href: "/designations",
      label: "Designations",
      show: hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE),
    },
  ].filter((l) => l.show);

  const NavagtionLinks = [
    {
      icon: <FaHome size={24} />,
      text: "Dashboard",
      aleart: "home screen",
      href: "/",
      show: true,
    },
    {
      icon: <PiUsersFill size={24} />,
      text: "Employees",
      alert: "Employees",
      href: "/employees",
      show: hasPermission(user, PERMISSIONS.EMPLOYEES_MANAGE),
    },
    {
      icon: <RiBuilding4Fill size={24} />,
      text: "Departments",
      alert: "Departments",
      href: "/departments",
      show: hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE),
    },
    {
      icon: <FaMedal size={24} />,
      text: "Designations",
      alert: "Designations",
      href: "/designations",
      show: hasPermission(user, PERMISSIONS.DEPARTMENTS_MANAGE),
    },
    {
      icon: <FaUserCheck size={24} />,
      text: "Attendance",
      alert: "Attendance",
      href: "/attendance",
      show: hasPermission(user, PERMISSIONS.ATTENDANCE_IMPORT),
    },
    {
      icon: <Calendar size={24} />,
      text: "Leaves Management",
      alert: "Leaves Management",
      href: "/leaves-management",
      show: hasPermission(user, PERMISSIONS.LEAVES_MANAGE),
    },
    {
      icon: <FaFileExcel size={24} />,
      text: "Excel Import",
      alert: "Excel Import",
      href: "/attendance/import",
      show: hasPermission(user, PERMISSIONS.ATTENDANCE_IMPORT),
    },
    {
      icon: <HistoryIcon size={24} />,
      text: "Imports",
      alert: "Imports",
      href: "/attendance/imports",
      show: hasPermission(
        user,
        PERMISSIONS.ATTENDANCE_IMPORT,
        PERMISSIONS.ATTENDANCE_VIEW,
      ),
    },

    {
      icon: <VscGraph size={24} />,
      text: "Reports",
      alert: "Reports",
      href: "/reports",
      show: hasPermission(user, PERMISSIONS.ATTENDANCE_IMPORT),
    },
  ].filter((l) => l.show);

  return (
    <div>
      <Navigation user={user} />
      <div className="flex h-screen  overflow-hidden">
        <SideMenu links={NavagtionLinks} />
        <div className="flex-1">
          <main className="p-6 bg-slate-100 h-screen">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Spinner />
        </div>
      }
    >
      {" "}
      <AuthShell>{children}</AuthShell>{" "}
    </Suspense>
  );
}
