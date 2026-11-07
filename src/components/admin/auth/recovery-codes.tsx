"use client";

import { Check, Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { useCopy } from "@/hooks/use-copy";

/** Recovery codes in a grid, with copy and download. Shown once, right after they're made. */
export const RecoveryCodes = ({ codes }: { codes: string[] }) => {
  const t = useTranslations("Admin.auth.setup");
  const { copied, copy } = useCopy();
  const text = codes.join("\n");
  const download = `data:text/plain;charset=utf-8,${encodeURIComponent(`${text}\n`)}`;

  return (
    <div className="flex flex-col gap-4">
      <ul className="bg-muted grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="touch" onClick={() => copy(text)}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t("copied") : t("copyCodes")}
        </Button>
        <a
          href={download}
          download={`${siteConfig.orgName.toLowerCase()}-recovery-codes.txt`}
          className="border-border hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
        >
          <Download aria-hidden="true" className="size-4" />
          {t("download")}
        </a>
      </div>
    </div>
  );
};
