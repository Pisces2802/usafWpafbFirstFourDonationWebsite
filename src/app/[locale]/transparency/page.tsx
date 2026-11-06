import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/transparency">) =>
  placeholderMetadata(params, "transparency", "/transparency");

const TransparencyPage = () => <PlaceholderPage titleKey="transparency" />;

export default TransparencyPage;
