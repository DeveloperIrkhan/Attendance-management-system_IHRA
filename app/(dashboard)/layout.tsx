import { Suspense } from "react";
import { BsCalendar2Month } from "react-icons/bs";
import { hasPermission, requireUser } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TfiStamp } from "react-icons/tfi";

import Spinner from "@/components/Spinner";
import { VscGraph } from "react-icons/vsc";
import Navigation from "@/components/Navigation";
import SideMenu from "@/components/SideMenu/SideMenu";
import { HistoryIcon } from "lucide-react";
import { FaFileExcel, FaHome } from "react-icons/fa";
import { PiGearFill, PiUsersFill } from "react-icons/pi";
import { RiBuilding4Fill } from "react-icons/ri";
import { FaMedal } from "react-icons/fa";
import { FaListCheck } from "react-icons/fa6";
import { SlCalender } from "react-icons/sl";

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
      icon: <BsCalendar2Month size={24} />,
      text: "Monthly Summary",
      alert: "Monthly Summary",
      href: "/attendance/monthly",
      show: hasPermission(user, PERMISSIONS.ATTENDANCE_VIEW),
    },
    {
      icon: <TfiStamp size={24} />,
      text: "Missing punches",
      alert: "Missing punches",
      href: "/attendance/review",
      show: hasPermission(user, PERMISSIONS.ATTENDANCE_EDIT),
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
      text: "All imports",
      alert: "upload history",
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
    {
      icon: <SlCalender size={24} />,
      text: "Calendar",
      alert: "Calendar",
      href: "/attendance/calendar",
      show: hasPermission(user, PERMISSIONS.ATTENDANCE_SETTINGS),
    },
    {
      icon: <FaListCheck size={24} />,
      text: "Daily attendance",
      alert: "Daily attendance",
      href: "/attendance/daily",
      show: hasPermission(user, PERMISSIONS.ATTENDANCE_SETTINGS),
    },
    {
      icon: <PiGearFill size={24} />,
      text: "Rules",
      alert: "Rules & Settings",
      href: "/attendance/settings",
      show: hasPermission(user, PERMISSIONS.ATTENDANCE_VIEW),
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
