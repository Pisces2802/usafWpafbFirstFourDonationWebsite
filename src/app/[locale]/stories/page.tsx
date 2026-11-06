import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = ({ params }: PageProps<"/[locale]/stories">) =>
  placeholderMetadata(params, "stories", "/stories");

const StoriesPage = () => <PlaceholderPage titleKey="stories" />;

export default StoriesPage;
