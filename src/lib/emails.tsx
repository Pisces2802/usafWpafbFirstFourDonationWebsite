import "server-only";

import { getFormatter, getTranslations } from "next-intl/server";
import { Resend } from "resend";

import type { Frequency, FundId } from "@/config/donation";
import { siteConfig } from "@/config/site";
import { NoticeEmail } from "@/emails/notice-email";
import { env } from "@/env";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { MONEY_FORMAT } from "@/lib/money";

export type GiftEmailData = {
  locale: Locale;
  donorEmail: string;
  firstName: string;
  lastName: string;
  frequency: Frequency;
  fundId: FundId;
  amountCents: number;
  feeCoveredCents: number;
  paidAt: Date;
  cardLast4: string | null;
  reference: string;
  tribute: { type: "honour" | "memory"; honoreeName: string; notifyEmail: string | null } | null;
};

let client: Resend | null = null;

const getResend = () => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
};

const siteUrl = (locale: Locale, href: "/" | "/contact") =>
  `${env.NEXT_PUBLIC_SITE_URL}${getPathname({ locale, href })}`;

/**
 * Sends the donor's receipt in their language. Tax wording appears only when the organisation's
 * 501(c)(3) status and EIN are configured; otherwise it's a plain thank-you.
 */
export const sendReceipt = async (gift: GiftEmailData) => {
  const resend = getResend();
  if (!resend || !env.EMAIL_FROM) return;

  const { locale, frequency } = gift;
  const { orgName } = siteConfig;
  const t = await getTranslations({ locale, namespace: "Emails" });
  const tFunds = await getTranslations({ locale, namespace: "Funds" });
  const tFooter = await getTranslations({ locale, namespace: "Footer" });
  const format = await getFormatter({ locale });
  const money = (cents: number) => format.number(cents / 100, MONEY_FORMAT);
  const total = money(gift.amountCents + gift.feeCoveredCents);
  const isTaxDeductible = env.NEXT_PUBLIC_TAX_DEDUCTIBLE && env.ORG_EIN;

  const rows = [
    { label: t("rowDate"), value: format.dateTime(gift.paidAt, { dateStyle: "long" }) },
    { label: t("rowAmount"), value: total },
    { label: t("rowFund"), value: tFunds(`${gift.fundId}.name`) },
    {
      label: t("rowFrequency"),
      value: frequency === "monthly" ? t("frequencyMonthly") : t("frequencyOneTime"),
    },
    ...(gift.cardLast4
      ? [{ label: t("rowCard"), value: t("rowCardValue", { last4: gift.cardLast4 }) }]
      : []),
    { label: t("rowReference"), value: gift.reference },
  ];

  const notes = [
    ...(gift.feeCoveredCents > 0 ? [t("feeNote", { fee: money(gift.feeCoveredCents) })] : []),
    ...(gift.tribute
      ? [t("tributeNote", { type: gift.tribute.type, name: gift.tribute.honoreeName })]
      : []),
    isTaxDeductible ? t("taxNote", { orgName, ein: env.ORG_EIN ?? "" }) : t("plainNote"),
    ...(frequency === "monthly" ? [t("monthlyNote")] : []),
  ];

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: gift.donorEmail,
    replyTo: env.ORG_NOTIFY_EMAIL,
    subject: t("receiptSubject", { frequency, orgName }),
    react: (
      <NoticeEmail
        lang={locale}
        orgName={orgName}
        preview={t("receiptPreview", { amount: total })}
        heading={t("receiptHeading", { name: gift.firstName })}
        paragraphs={[t("receiptIntro", { frequency, orgName })]}
        rows={rows}
        notes={notes}
        link={{ label: t("contactLink", { orgName }), href: siteUrl(locale, "/contact") }}
        footer={[tFooter("disclaimer", { orgName })]}
      />
    ),
  });
};

/**
 * Tells the person a tribute gift names that it was made. Never includes the amount. Sent in the
 * donor's language, since that's the only language we know for the recipient.
 */
export const sendTributeNotice = async (gift: GiftEmailData) => {
  const resend = getResend();
  const tribute = gift.tribute;
  const notifyEmail = tribute?.notifyEmail;
  if (!resend || !env.EMAIL_FROM || !tribute || !notifyEmail) return;

  const { locale } = gift;
  const { orgName } = siteConfig;
  const t = await getTranslations({ locale, namespace: "Emails" });
  const tFooter = await getTranslations({ locale, namespace: "Footer" });
  const donor = `${gift.firstName} ${gift.lastName}`.trim();
  const subject = t("tributeSubject", { type: tribute.type, honoree: tribute.honoreeName });

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: notifyEmail,
    replyTo: env.ORG_NOTIFY_EMAIL,
    subject,
    react: (
      <NoticeEmail
        lang={locale}
        orgName={orgName}
        preview={subject}
        heading={subject}
        paragraphs={[
          t("tributeBody", { type: tribute.type, donor, orgName, honoree: tribute.honoreeName }),
          t("tributeAbout", { orgName }),
        ]}
        notes={[t("tributeWhy", { donor })]}
        link={{ label: t("aboutLink", { orgName }), href: siteUrl(locale, "/") }}
        footer={[tFooter("disclaimer", { orgName })]}
      />
    ),
  });
};
