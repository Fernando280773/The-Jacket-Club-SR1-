/**
 * The trading details the law requires on the website and emails (Companies Act 2006 trading disclosures).
 * One place, so every page and email shows the same thing.
 */
export const COMPANY = {
  tradingName: "The Jacket Club SR1",
  legalName: "Fernando & Sons Property Limited",
  number: "15466129",
  registeredIn: "England and Wales",
  registeredOffice: "1–3 Park Lane, Sunderland SR1 3NX",
  shopAddress: "12–14 Park Lane, Sunderland SR1 3NX",
  email: "info@thejacketclubsr1.com",
  /** ICO data protection fee registration (ZA…). Leave null until registered. */
  icoNumber: null as string | null,
  /** Not VAT registered. */
  vatNumber: null as string | null,
};

/** One line for emails and the footer. */
export const COMPANY_LINE = `${COMPANY.tradingName} is a trading name of ${COMPANY.legalName}, registered in ${COMPANY.registeredIn}, company number ${COMPANY.number}. Registered office: ${COMPANY.registeredOffice}.`;

export const LEGAL_PAGES = [
  { href: "/terms", label: "Terms of sale" },
  { href: "/refunds", label: "Refunds" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/allergens", label: "Allergens" },
] as const;

/** Date the legal pages were last updated (shown on each page). */
export const LEGAL_UPDATED = "23 November 2026";
