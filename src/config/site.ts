export const siteConfig = {
  orgName: "FirstFour",
  annualReportYear: 2027,
  url: "https://{ORG_NAME}.org",
  /** Dates are shown in this zone unless a back-office user picks their own. */
  timeZone: "America/New_York",
} as const;

export type SocialLink = {
  /** The network's name as people say it, like "Instagram". Shown as the link text. */
  label: string;
  href: `https://${string}`;
};

/**
 * The group's social accounts, in footer order. The footer hides the list while it's empty.
 * Add accounts once the group confirms them; links only, no network logos.
 */
export const socialLinks: readonly SocialLink[] = [];
