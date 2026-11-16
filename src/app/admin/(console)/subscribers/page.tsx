import { DatasetPage } from "@/components/admin/dataset-page";
import { SubscribersTable } from "@/components/admin/subscribers-table";
import { loadSubscribers } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("subscribers");

const SubscribersPage = () => (
  <DatasetPage
    dataset="subscribers"
    load={loadSubscribers}
    render={(rows) => <SubscribersTable rows={rows} />}
  />
);

export default SubscribersPage;
