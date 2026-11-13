import "server-only";

import { getFormatter, getTranslations } from "next-intl/server";
import { Resend } from "resend";

import type { Frequency, FundId } from "@/config/donation";
import { siteConfig } from "@/config/site";
import { NoticeEmail } from "@/emails/notice-email";
import { env } from "@/env";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { MANAGE_LINK_MINUTES } from "@/lib/form-schemas";
import type { ManageLinkEmail } from "@/lib/manage-giving";
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

export type CancellationEmailData = {
  locale: Locale;
  donorEmail: string;
  firstName: string;
  fundId: FundId;
  /** What was charged each month: the gift plus any card fees the donor covered. */
  monthlyCents: number;
  endedAt: Date;
};

let client: Resend | null = null;

const getResend = () => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
};

const siteUrl = (locale: Locale, href: "/" | "/contact" | "/manage-giving") =>
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

  const { error } = await resend.emails.send({
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
        link={
          frequency === "monthly"
            ? { label: t("manageLink"), href: siteUrl(locale, "/manage-giving") }
            : { label: t("contactLink", { orgName }), href: siteUrl(locale, "/contact") }
        }
        footer={[tFooter("disclaimer", { orgName })]}
      />
    ),
  });
  if (error) throw new Error(`Resend rejected the email: ${error.message}`);
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

  const { error } = await resend.emails.send({
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
  if (error) throw new Error(`Resend rejected the email: ${error.message}`);
};

/** Tells a donor their monthly gift has ended and that they won't be charged again. */
export const sendCancellationNotice = async (gift: CancellationEmailData) => {
  const resend = getResend();
  if (!resend || !env.EMAIL_FROM) return;

  const { locale } = gift;
  const { orgName } = siteConfig;
  const t = await getTranslations({ locale, namespace: "Emails" });
  const tFunds = await getTranslations({ locale, namespace: "Funds" });
  const tFooter = await getTranslations({ locale, namespace: "Footer" });
  const format = await getFormatter({ locale });

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: gift.donorEmail,
    replyTo: env.ORG_NOTIFY_EMAIL,
    subject: t("cancelSubject", { orgName }),
    react: (
      <NoticeEmail
        lang={locale}
        orgName={orgName}
        preview={t("cancelPreview")}
        heading={t("cancelHeading")}
        paragraphs={[t("cancelIntro", { orgName }), t("cancelThanks")]}
        rows={[
          { label: t("rowFund"), value: tFunds(`${gift.fundId}.name`) },
          {
            label: t("cancelRowAmount"),
            value: format.number(gift.monthlyCents / 100, MONEY_FORMAT),
          },
          {
            label: t("cancelRowEnded"),
            value: format.dateTime(gift.endedAt, { dateStyle: "long" }),
          },
        ]}
        notes={[t("cancelNote")]}
        link={{ label: t("contactLink", { orgName }), href: siteUrl(locale, "/contact") }}
        footer={[tFooter("disclaimer", { orgName })]}
      />
    ),
  });
  if (error) throw new Error(`Resend rejected the email: ${error.message}`);
};

/** Emails a donor the short-lived link that opens their monthly gift in Stripe's billing portal. */
export const sendManageGivingLink = async ({ locale, donorEmail, url }: ManageLinkEmail) => {
  const resend = getResend();
  if (!resend || !env.EMAIL_FROM) return;

  const { orgName } = siteConfig;
  const t = await getTranslations({ locale, namespace: "Emails" });
  const tFooter = await getTranslations({ locale, namespace: "Footer" });
  const subject = t("manageSubject", { orgName });

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: donorEmail,
    replyTo: env.ORG_NOTIFY_EMAIL,
    subject,
    react: (
      <NoticeEmail
        lang={locale}
        orgName={orgName}
        preview={subject}
        heading={t("manageHeading")}
        paragraphs={[t("manageIntro", { minutes: MANAGE_LINK_MINUTES })]}
        notes={[t("manageNote")]}
        link={{ label: t("manageLink"), href: url }}
        footer={[tFooter("disclaimer", { orgName })]}
      />
    ),
  });
  if (error) throw new Error(`Resend rejected the email: ${error.message}`);
};

/** True when emails can be sent at all. */
export const isEmailConfigured = () => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

/**
 * True when submissions can be emailed: Resend is set up and there's somewhere to send them,
 * either `ORG_NOTIFY_EMAIL` or a database holding the team inbox and people's notification choices.
 */
export const isOrgNoticeConfigured = () =>
  isEmailConfigured() && Boolean(env.ORG_NOTIFY_EMAIL || env.DATABASE_URL);

export type OrgNotice = {
  subject: string;
  heading: string;
  replyTo: string;
  rows: { label: string; value: string }[];
  paragraphs?: string[];
  notes?: string[];
};

/**
 * Emails a form submission to `to`: the group's inbox or a team member. Replies go straight to
 * the person who sent it. Written in English, the group's working language, whichever locale the
 * form was filled in.
 */
export const sendOrgNotice = async (
  to: string,
  { subject, heading, replyTo, rows, paragraphs, notes }: OrgNotice,
) => {
  const resend = getResend();
  if (!resend || !env.EMAIL_FROM) return;

  const { orgName } = siteConfig;
  const tFooter = await getTranslations({ locale: "en", namespace: "Footer" });

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    replyTo,
    subject,
    react: (
      <NoticeEmail
        lang="en"
        orgName={orgName}
        preview={subject}
        heading={heading}
        paragraphs={paragraphs ?? []}
        rows={rows}
        notes={notes}
        footer={[tFooter("disclaimer", { orgName })]}
      />
    ),
  });
  if (error) throw new Error(`Resend rejected the notice: ${error.message}`);
};

type AdminEmail = {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  link: { label: string; href: string };
  footer: string[];
};

/**
 * Sends a back-office account email (invite, password reset). Returns whether it was accepted.
 * Failures are logged, not thrown: the caller decides what to tell the person, and a password
 * reset must look the same whether or not the address belongs to someone.
 */
export const sendAdminEmail = async ({
  to,
  subject,
  heading,
  paragraphs,
  link,
  footer,
}: AdminEmail) => {
  const resend = getResend();
  if (!resend || !env.EMAIL_FROM) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[admin email not sent: Resend isn't configured] ${subject}\n${link.href}`);
    }
    return false;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    react: (
      <NoticeEmail
        lang="en"
        orgName={siteConfig.orgName}
        preview={subject}
        heading={heading}
        paragraphs={paragraphs}
        link={link}
        footer={footer}
      />
    ),
  });
  if (error) {
    console.error(`Resend rejected an admin email: ${error.message}`);
    return false;
  }
  return true;
};
