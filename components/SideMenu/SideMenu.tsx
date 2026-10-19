"use client";
import { KeyRound, MoreVertical, ShieldCheck, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { createContext, useEffect, useRef, useState } from "react";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { boolean } from "zod";
import { MenuItems } from "./MenuItem";

type NavigationLink = {
  icon: React.ReactNode;
  text: string;
  alert?: string;
  href: string;
};

type NavigationProps = {
  links: NavigationLink[];
};
interface SidebarContextType {
  expanded: boolean;
}

export const SidebarContext = createContext<SidebarContextType>({
  expanded: true,
});

const SideMenu = ({ links }: NavigationProps) => {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  return (
    <aside ref={ref} className="h-screen relative">
      <nav className="h-full flex flex-col bg-green-800 shadow-md">
        <div className="p-4 pb-2 flex items-center justify-between gap-2 border-b border-white">
          {expanded && (
            <Link href={"/"} className="flex items-start flex-col">
              <h2 className="text-lg font-bold text-white tracking-widest">
                Attendance
              </h2>
              <p className="text-gray-300 text-sm">management system</p>
            </Link>
          )}
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="p-2 rounded-full bg-white hover:bg-slate-200 text-green-800 transition"
          >
            {expanded ? <IoIosArrowBack /> : <IoIosArrowForward />}
          </button>
        </div>
        {/* MENU */}
        <SidebarContext.Provider value={{ expanded }}>
          <ul className="flex-1 ">
            {links?.map((link, index) => (
              <MenuItems
                key={index}
                icon={link.icon}
                text={link.text}
                alert={link.text}
                href={link.href}
              />
            ))}
          </ul>
        </SidebarContext.Provider>
        {/*user section */}
        <div className="border-t border-gray-400 flex p-3 text-white">
          <MoreVertical onClick={() => setOpen(!open)} size={20} />
          {open && (
            <div className="absolute bottom-10  mt-3 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
              <Link
                href="/auth/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-100 hover:text-green-800 transition-colors"
              >
                <User className="w-4 h-4" /> My Profile
              </Link>

              <Link
                href="/auth/change-password"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-100 hover:text-green-800 transition-colors"
              >
                <KeyRound className="w-4 h-4" /> Change Password
              </Link>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default SideMenu;
