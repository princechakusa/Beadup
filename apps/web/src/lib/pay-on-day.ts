/** The note a business gets from "Pay on the day" in the app (apps/mobile/src/lib/payment-methods.ts uses the same text). */
export const PAY_ON_DAY_NOTE = "No deposit needed online. Pay on the day by cash, card or transfer.";
export const isPayOnDay = (note: string | null | undefined) => note === PAY_ON_DAY_NOTE;
