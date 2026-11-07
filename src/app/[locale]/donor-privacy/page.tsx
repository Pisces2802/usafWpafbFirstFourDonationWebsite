import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/config/legal";
import { getPageMetadata } from "@/lib/metadata";

const doc = legalDocs.donorPrivacy;

export const generateMetadata = ({ params }: PageProps<"/[locale]/donor-privacy">) =>
  getPageMetadata(params, { titleKey: doc.titleKey, href: doc.href });

const DonorPrivacyPage = () => <LegalPage doc={doc} />;

export default DonorPrivacyPage;
