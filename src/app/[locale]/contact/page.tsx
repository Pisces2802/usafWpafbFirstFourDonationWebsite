import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/contact">) =>
  placeholderMetadata(params, "contact", "/contact");

const ContactPage = () => <PlaceholderPage titleKey="contact" />;

export default ContactPage;
