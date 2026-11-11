import { Archivo, Inter } from "next/font/google";

export const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

/** Font variables for a root layout's `<html>` class. */
export const fontVariables = `${archivo.variable} ${inter.variable}`;
