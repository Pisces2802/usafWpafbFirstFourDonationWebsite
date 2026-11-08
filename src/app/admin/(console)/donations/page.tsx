import { DatasetPage } from "@/components/admin/dataset-page";
import { DonationsTable } from "@/components/admin/donations-table";
import { loadDonations } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("donations");

const DonationsPage = () => (
  <DatasetPage
    dataset="donations"
    load={loadDonations}
    render={(rows) => <DonationsTable rows={rows} />}
  />
);

export default DonationsPage;
