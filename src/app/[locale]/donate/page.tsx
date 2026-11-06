import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/donate">) =>
  placeholderMetadata(params, "donate", "/donate");

const DonatePage = () => <PlaceholderPage titleKey="donate" />;

export default DonatePage;
