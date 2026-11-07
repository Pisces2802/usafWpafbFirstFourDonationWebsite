import { DatasetPage } from "@/components/admin/dataset-page";
import { VolunteersTable } from "@/components/admin/volunteers-table";
import { loadVolunteers } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("volunteers");

const VolunteersPage = () => (
  <DatasetPage
    dataset="volunteers"
    load={loadVolunteers}
    render={(rows) => <VolunteersTable rows={rows} />}
  />
);

export default VolunteersPage;
