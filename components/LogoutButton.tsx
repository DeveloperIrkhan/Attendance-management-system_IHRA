"use client"
import axios from "axios";
import { useRouter } from "next/navigation";
const LogoutButton = () => {
  const router = useRouter();
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
  return (
    <button
      onClick={logout}
      className="rounded bg-black border px-3 py-1 text-sm hover:bg-zinc-100"
    >
      Log out
    </button>
  );
};

export default LogoutButton;
