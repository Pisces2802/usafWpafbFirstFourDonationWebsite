import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const NotFoundPage = () => {
  const t = useTranslations("NotFound");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-24">
      <h1 className="headline text-5xl">{t("title")}</h1>
      <p className="text-muted-foreground text-xl">{t("description")}</p>
      <Link href="/" className="text-primary font-medium underline underline-offset-4">
        {t("backHome")}
      </Link>
    </div>
  );
};

export default NotFoundPage;
