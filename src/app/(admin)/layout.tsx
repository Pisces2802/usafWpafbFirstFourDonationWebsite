import React from "react";

import { Sidebar } from "@/components/admin/sidebar";
import { Header } from "@/components/admin/header";

interface Props {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  return (
    <div className="flex h-screen min-h-0 w-screen min-w-screen">
      <Sidebar />
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
        <Header />
        {/* subtract the height of the header from the full height */}
        <div className="h-[calc(100%-4rem)] min-h-0 w-full min-w-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
