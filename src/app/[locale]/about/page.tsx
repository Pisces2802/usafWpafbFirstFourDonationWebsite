import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/about">) =>
  placeholderMetadata(params, "about", "/about");

const AboutPage = () => <PlaceholderPage titleKey="about" />;

export default AboutPage;
