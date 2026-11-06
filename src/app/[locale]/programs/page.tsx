import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/programs">) =>
  placeholderMetadata(params, "programs", "/programs");

const ProgramsPage = () => <PlaceholderPage titleKey="programs" />;

export default ProgramsPage;
