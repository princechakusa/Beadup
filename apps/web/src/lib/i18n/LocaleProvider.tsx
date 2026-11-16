import type { ReactNode } from "react";
import { DATE_LOCALE, messagesFor, phrasesFor } from "./index";
import { I18nProvider } from "./I18nProvider";
import { getLocale } from "./server";

/** Server component: picks the visitor's language and gives it to everything below. */
export async function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} dateLocale={DATE_LOCALE[locale]} messages={messagesFor(locale)} phrases={phrasesFor(locale)}>
      <div lang={locale}>{children}</div>
    </I18nProvider>
  );
}
