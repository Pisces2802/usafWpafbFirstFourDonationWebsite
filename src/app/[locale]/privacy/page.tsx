import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/config/legal";
import { getPageMetadata } from "@/lib/metadata";

const doc = legalDocs.privacy;

export const generateMetadata = ({ params }: PageProps<"/[locale]/privacy">) =>
  getPageMetadata(params, { titleKey: doc.titleKey, href: doc.href });

const PrivacyPage = () => <LegalPage doc={doc} />;

export default PrivacyPage;
