import { Loader2 } from "lucide-react";
import Link from "next/link";

const NotFound = () => {
  return (
    <div className="h-screen bg-[#344b61]">
      <div className="w-full h-full">
        <div className="flex flex-col md:flex-row h-full">
          <div className="w-full flex flex-col justify-center items-center h-full gap-y-3">
            <h2 className="text-xl md:text-4xl text-white">
              We're Sorry, Something went wrong here!
            </h2>
            <h2 className="text-xl font-medium text-white">
              We can't find the page you looking for, We're working on it.
            </h2>
            <div className="flex gap-x-2 text-white">
              <Loader2 className="animate-spin" /> we are working on it
            </div>

            <div className="flex gap-x-2">
              <Link
                href={"/"}
                className="flex justify-center items-center custom-button w-36 font-medium text-[#344b61] rounded-sm h-10 bg-white border-2 border-[#344b61]"
              >
                HELP
              </Link>
              <Link
                href={"/"}
                className="flex justify-center items-center custom-button w-36 font-medium text-white rounded-sm h-10 bg-[#344b61] border-2 border-white"
              >
                HOME
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
