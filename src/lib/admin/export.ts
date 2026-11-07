import "server-only";

import { requireAdmin } from "@/lib/admin/access";
import { adminTranslator } from "@/lib/admin/translator";
import { type CsvColumn, toCsv } from "@/lib/admin/csv";
import { loadDonations, loadDonors, loadMessages, loadVolunteers } from "@/lib/admin/data";
import type {
  AdminDonationRow,
  AdminDonorRow,
  AdminMessageRow,
  AdminVolunteerRow,
} from "@/lib/admin/queries";

export const ADMIN_DATASETS = ["donations", "donors", "volunteers", "messages"] as const;
export type AdminDataset = (typeof ADMIN_DATASETS)[number];

export const isAdminDataset = (value: string): value is AdminDataset =>
  ADMIN_DATASETS.includes(value as AdminDataset);

type Header = (key: string) => string;

const dollars = (cents: number) => (cents / 100).toFixed(2);

const donationColumns = (h: Header): CsvColumn<AdminDonationRow>[] => [
  { header: h("date"), value: (row) => row.createdAt },
  { header: h("firstName"), value: (row) => row.donorFirstName },
  { header: h("lastName"), value: (row) => row.donorLastName },
  { header: h("email"), value: (row) => row.donorEmail },
  { header: h("amount"), value: (row) => dollars(row.amountCents) },
  { header: h("fee"), value: (row) => dollars(row.feeCoveredCents) },
  { header: h("refunded"), value: (row) => dollars(row.refundedCents) },
  { header: h("frequency"), value: (row) => row.frequency },
  { header: h("fund"), value: (row) => row.fund },
  { header: h("campaign"), value: (row) => row.campaign },
  { header: h("status"), value: (row) => row.status },
  { header: h("tributeType"), value: (row) => row.tributeType },
  { header: h("honoree"), value: (row) => row.honoreeName },
  { header: h("stripePayment"), value: (row) => row.stripePaymentIntentId },
  { header: h("stripeInvoice"), value: (row) => row.stripeInvoiceId },
];

const donorColumns = (h: Header): CsvColumn<AdminDonorRow>[] => [
  { header: h("firstName"), value: (row) => row.firstName },
  { header: h("lastName"), value: (row) => row.lastName },
  { header: h("email"), value: (row) => row.email },
  { header: h("net"), value: (row) => dollars(row.netCents) },
  { header: h("gifts"), value: (row) => row.giftCount },
  { header: h("lastGift"), value: (row) => row.lastGiftAt },
  { header: h("monthly"), value: (row) => row.isMonthly },
  { header: h("language"), value: (row) => row.locale },
  { header: h("marketing"), value: (row) => row.marketingOptIn },
];

const volunteerColumns = (h: Header): CsvColumn<AdminVolunteerRow>[] => [
  { header: h("date"), value: (row) => row.createdAt },
  { header: h("name"), value: (row) => row.name },
  { header: h("email"), value: (row) => row.email },
  { header: h("phone"), value: (row) => row.phone },
  { header: h("affiliation"), value: (row) => row.affiliation },
  { header: h("interests"), value: (row) => row.interests.join("; ") },
  { header: h("availability"), value: (row) => row.availability },
  { header: h("language"), value: (row) => row.locale },
];

const messageColumns = (h: Header): CsvColumn<AdminMessageRow>[] => [
  { header: h("date"), value: (row) => row.createdAt },
  { header: h("name"), value: (row) => row.name },
  { header: h("email"), value: (row) => row.email },
  { header: h("topic"), value: (row) => row.topic },
  { header: h("message"), value: (row) => row.message },
  { header: h("language"), value: (row) => row.locale },
];

/**
 * Builds a dataset's CSV, or null when there's no database. Needs the dataset's export permission,
 * and goes through the admin loaders, so the view permission is checked too.
 */
export const exportDataset = async (dataset: AdminDataset): Promise<string | null> => {
  await requireAdmin(`${dataset}:export`);
  const h: Header = (key) => adminTranslator(`csv.${key}` as Parameters<typeof adminTranslator>[0]);

  switch (dataset) {
    case "donations": {
      const rows = await loadDonations();
      return rows && toCsv(rows, donationColumns(h));
    }
    case "donors": {
      const rows = await loadDonors();
      return rows && toCsv(rows, donorColumns(h));
    }
    case "volunteers": {
      const rows = await loadVolunteers();
      return rows && toCsv(rows, volunteerColumns(h));
    }
    case "messages": {
      const rows = await loadMessages();
      return rows && toCsv(rows, messageColumns(h));
    }
  }
};
