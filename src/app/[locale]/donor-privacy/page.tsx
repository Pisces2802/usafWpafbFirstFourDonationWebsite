import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/donor-privacy">) =>
  placeholderMetadata(params, "donorPrivacy", "/donor-privacy");

const DonorPrivacyPage = () => <PlaceholderPage titleKey="donorPrivacy" />;

export default DonorPrivacyPage;
