"use client";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, User, KeyRound, ShieldCheck } from "lucide-react";
import { FaUser } from "react-icons/fa";
type requiredUser = {
  fullName?: string;
  role?: string;
};

interface IUser {
  user: requiredUser;
}
const LogoutMenu = ({ user }: IUser) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const logout = async () => {
    try {
      const response = await axios.post("/api/auth/logout");
      if (response.data?.success) {
        router.replace(response.data.redirectTo);
        router.refresh();
      }
    } catch (e) {
      console.log(e);
    }
  };

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
    <div ref={ref} className="relative group duration-300">
      <div
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-2 flex justify-center cursor-pointer items-center gap-x-4 hoverEffect"
      >
        <div className="bg-green-800 text-white border border-green-800 group-hover:text-green-800 duration-300 group-hover:bg-white group-hover:border-green-800 w-9 h-9 rounded-full flex items-center justify-center text-md font-bold uppercase">
          {user.fullName?.charAt(0)}
        </div>

        {open && (
          <div className="absolute top-9 right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex gap-2 items-center justify-start">
                <p className="text-sm font-semibold text-slate-800">
                  {user.fullName}
                </p>
                <p className="text-xs text-slate-400 trancate">
                  ({user.role?.toLocaleLowerCase()})
                </p>
              </div>
            </div>

            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
            >
              <User className="w-4 h-4" /> My Profile
            </Link>

            <Link
              href="/auth/change-password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
            >
              <KeyRound className="w-4 h-4" /> Change Password
            </Link>

            {/* {user.role.name === "Admin" && (
              <>
                <Link
                  href="/dashboard/users/pending-approvals"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" /> Pending Approvals
                </Link>
                <Link
                  href="/dashboard/users/view-all"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" /> All Users
                </Link>
                <Link
                  href="/dashboard/roles/view-all"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-green-50 hover:text-green-600 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" /> Manage Roles
                </Link>
              </>
            )} */}

            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-green-600 hover:bg-green-50 transition-colors border-t border-slate-100"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoutMenu;
