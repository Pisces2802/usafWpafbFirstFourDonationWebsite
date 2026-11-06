import React from "react";
import { cn } from "cn";

import { STATISTICS_GRID } from "@/constants/classNames";

export default function Page() {
  return (
    <div className="space-y-6">
      <div className={cn(STATISTICS_GRID)}></div>
    </div>
  );
}
