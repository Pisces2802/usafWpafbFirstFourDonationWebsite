import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/terms">) =>
  placeholderMetadata(params, "terms", "/terms");

const TermsPage = () => <PlaceholderPage titleKey="terms" />;

export default TermsPage;
