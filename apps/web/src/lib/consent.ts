/**
 * SMS consent wording shown at booking (rules.md section 4, TCPA). The server
 * stores this exact text with a timestamp, rebuilt from the database business
 * name rather than trusted from the browser.
 */
export function smsConsentText(businessName: string): string {
  const name = businessName.replace(/\.+$/, "");
  return `Text me booking confirmations and reminders from ${name}. Msg & data rates may apply. Reply STOP to opt out.`;
}
