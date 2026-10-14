"use client"
import Image from "next/image";
const Spinner = () => {
  return (
    <div
      className="z-50 fixed inset-0 flex justify-center items-center 
                 bg-darkColor/70 backdrop-blur-xs"
    >
      <div className="flex flex-col justify-center relative items-center text-2xl">
        <Image
          src={"./tube-spinner.svg"}
          width={200}
          height={200}
          alt="Loading"
          loading="eager"
          className="w-30 h-30 relative z-20 animate"
        />
      </div>
    </div>
  );
};

export default Spinner;
