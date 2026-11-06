import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { NoticeEmail } from "@/emails/notice-email";

describe("NoticeEmail", () => {
  it("renders every row, note and link it is given", async () => {
    const html = await render(
      <NoticeEmail
        lang="fr"
        orgName="FirstFour"
        preview="Merci. Voici votre reçu pour 77,55 $US."
        heading="Merci, Sam."
        paragraphs={["Voici le reçu de votre don à FirstFour."]}
        rows={[
          { label: "Montant", value: "77,55 $US" },
          { label: "Carte", value: "Se terminant par 4242" },
        ]}
        notes={["À la mémoire de Jo Rivera."]}
        link={{ label: "Contacter FirstFour", href: "https://example.org/fr/contact" }}
        footer={["FirstFour est un organisme bénévole indépendant."]}
      />,
    );

    expect(html).toContain('lang="fr"');
    for (const text of [
      "Merci, Sam.",
      "77,55 $US",
      "Se terminant par 4242",
      "À la mémoire de Jo Rivera.",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('href="https://example.org/fr/contact"');
  });
});
