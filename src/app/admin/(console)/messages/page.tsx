import { DatasetPage } from "@/components/admin/dataset-page";
import { MessagesTable } from "@/components/admin/messages-table";
import { loadMessages } from "@/lib/admin/data";
import { adminMetadata } from "@/lib/admin/metadata";

export const generateMetadata = adminMetadata("messages");

const MessagesPage = () => (
  <DatasetPage
    dataset="messages"
    load={loadMessages}
    render={(rows) => <MessagesTable rows={rows} />}
  />
);

export default MessagesPage;
