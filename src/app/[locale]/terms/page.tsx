import { LegalPage } from "@/components/legal/legal-page";
import { legalDocs } from "@/config/legal";
import { getPageMetadata } from "@/lib/metadata";

const doc = legalDocs.terms;

export const generateMetadata = ({ params }: PageProps<"/[locale]/terms">) =>
  getPageMetadata(params, { titleKey: doc.titleKey, href: doc.href });

const TermsPage = () => <LegalPage doc={doc} />;

export default TermsPage;
