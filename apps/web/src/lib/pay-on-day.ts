/** The note a business gets from "Pay on the day" in the app (apps/mobile/src/lib/payment-methods.ts uses the same text). */
export const PAY_ON_DAY_NOTE = "No deposit needed online. Pay on the day by cash, card or transfer.";
/** The real website a payment link opens (shown to the client before they pay). */
export function linkHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const isPayOnDay = (note: string | null | undefined) => note === PAY_ON_DAY_NOTE;
