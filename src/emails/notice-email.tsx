import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

const colors = {
  ultramarine: "#00308f",
  night: "#0e1c36",
  taxiway: "#f2b705",
  cloud: "#f7f8fa",
  muted: "#55606f",
  rule: "#d9dcd6",
};

const font =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type NoticeEmailProps = {
  lang: string;
  orgName: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  rows?: { label: string; value: string }[];
  notes?: string[];
  link?: { label: string; href: string };
  footer: string[];
};

/** Plain, single-column email used for gift receipts and tribute notices. All text arrives translated. */
export const NoticeEmail = ({
  lang,
  orgName,
  preview,
  heading,
  paragraphs,
  rows = [],
  notes = [],
  link,
  footer,
}: NoticeEmailProps) => (
  <Html lang={lang}>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: colors.cloud, fontFamily: font, margin: 0, padding: "24px 0" }}>
      <Container style={{ backgroundColor: "#ffffff", maxWidth: 560, borderRadius: 12 }}>
        <Section
          style={{
            backgroundColor: colors.night,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderBottom: `4px solid ${colors.taxiway}`,
            padding: "20px 32px",
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: 700, margin: 0 }}>
            {orgName}
          </Text>
        </Section>

        <Section style={{ padding: "32px" }}>
          <Heading
            as="h1"
            style={{ color: colors.night, fontSize: 28, lineHeight: "34px", margin: "0 0 16px" }}
          >
            {heading}
          </Heading>
          {paragraphs.map((paragraph) => (
            <Text
              key={paragraph}
              style={{ color: colors.night, fontSize: 16, lineHeight: "24px", margin: "0 0 12px" }}
            >
              {paragraph}
            </Text>
          ))}

          {rows.length > 0 && (
            <Section
              style={{
                border: `1px solid ${colors.rule}`,
                borderRadius: 8,
                margin: "20px 0",
                padding: "8px 16px",
              }}
            >
              {rows.map((row) => (
                <Row key={row.label}>
                  <Column style={{ color: colors.muted, fontSize: 14, padding: "8px 0" }}>
                    {row.label}
                  </Column>
                  <Column
                    align="right"
                    style={{ color: colors.night, fontSize: 14, fontWeight: 600, padding: "8px 0" }}
                  >
                    {row.value}
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          {notes.map((note) => (
            <Text
              key={note}
              style={{ color: colors.muted, fontSize: 14, lineHeight: "22px", margin: "0 0 8px" }}
            >
              {note}
            </Text>
          ))}

          {link && (
            <Text style={{ fontSize: 14, margin: "16px 0 0" }}>
              <Link href={link.href} style={{ color: colors.ultramarine, fontWeight: 600 }}>
                {link.label}
              </Link>
            </Text>
          )}

          <Hr style={{ borderColor: colors.rule, margin: "28px 0 16px" }} />
          {footer.map((line) => (
            <Text
              key={line}
              style={{ color: colors.muted, fontSize: 12, lineHeight: "18px", margin: "0 0 6px" }}
            >
              {line}
            </Text>
          ))}
        </Section>
      </Container>
    </Body>
  </Html>
);
