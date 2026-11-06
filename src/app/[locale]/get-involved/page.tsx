import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/get-involved">) =>
  placeholderMetadata(params, "getInvolved", "/get-involved");

const GetInvolvedPage = () => <PlaceholderPage titleKey="getInvolved" />;

export default GetInvolvedPage;
