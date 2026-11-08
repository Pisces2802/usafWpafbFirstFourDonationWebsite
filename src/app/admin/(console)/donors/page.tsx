import { DatasetPage } from "@/components/admin/dataset-page";
import { DonorsTable } from "@/components/admin/donors-table";
import { loadDonors } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("donors");

const DonorsPage = () => (
  <DatasetPage dataset="donors" load={loadDonors} render={(rows) => <DonorsTable rows={rows} />} />
);

export default DonorsPage;
