import React from "react";

const sizeMap = {
  small: "h-4 w-4 border-2",
  default: "h-6 w-6 border-4",
};

const Spinner = ({ size = "default" }) => {
  const sizing = sizeMap[size] ?? sizeMap.default;
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${sizing} mx-auto block rounded-full border-gray-200 border-l-primary animate-spin`}
    />
  );
};

export default Spinner;
