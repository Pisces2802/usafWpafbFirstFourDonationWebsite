import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/privacy">) =>
  placeholderMetadata(params, "privacy", "/privacy");

const PrivacyPage = () => <PlaceholderPage titleKey="privacy" />;

export default PrivacyPage;
