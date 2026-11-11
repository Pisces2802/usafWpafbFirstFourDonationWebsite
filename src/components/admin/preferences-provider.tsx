"use client";

import { createContext, type ReactNode, useContext } from "react";

type AdminPreferences = { pageSize: number };

const PreferencesContext = createContext<AdminPreferences>({ pageSize: 10 });

/** Shares the signed-in person's back-office preferences with client components. */
export const AdminPreferencesProvider = ({
  pageSize,
  children,
}: AdminPreferences & { children: ReactNode }) => (
  <PreferencesContext value={{ pageSize }}>{children}</PreferencesContext>
);

/** The signed-in person's preferences, or the defaults outside the console. */
export const useAdminPreferences = () => useContext(PreferencesContext);
