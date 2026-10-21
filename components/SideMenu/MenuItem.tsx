"use client";

import Link from "next/link";
import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarContext } from "./SideMenu";



interface MenuItemProps {
  icon: React.ReactNode;
  text: string;
  href: string;
  alert?: string;
}

export const MenuItems = ({ icon, text, href, alert }: MenuItemProps) => {
  const { expanded } = useContext(SidebarContext);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const menuItems = (
    <li
      className={`relative group flex items-center p-2 m-0 cursor-pointer 
      transition-all duration-300 font-medium  hover:bg-green-950 
      hover:text-white hover:shadow-md ${!expanded && "flex justify-center items-center p-4"}
      ${pathname === href ? "bg-green-950 text-white" : "text-white"}`}
      onClick={() => setOpen((prev) => !prev)}>
      {icon}

      <p
        className={`overflow-hidden transition-all duration-300 ${expanded ? "w-40 flex ml-3" : "hidden"
          }`}
      >
        {text}
      </p>

      {/* ALERT */}
      {/* {alert && (
        <div className={`absolute right-2 w-2 h-2 rounded-full bg-white
          ${expanded ? "" : "top-2"}`}>
        </div>
      )} */}

      {!expanded && (
        <div className="absolute z-40 left-full w-auto rounded-md p-2 ml-3
        bg-green-800 text-white text-sm invisible opacity-30 -translate-x-2 transition-opacity duration-300
        group-hover:visible group-hover:opacity-100 group-hover:translate-x-0">{text}</div>
      )}
    </li>
  );

  return (
    <Link key={text} href={href} className="group">
      {menuItems}
    </Link>
  );
};