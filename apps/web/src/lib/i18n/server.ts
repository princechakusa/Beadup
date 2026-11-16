import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, negotiate, type Locale } from "./index";

/** `bd_lang` cookie (set when a visitor picks a language) first, then the browser's Accept-Language. */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get("bd_lang")?.value;
  if (isLocale(saved)) return saved;
  return negotiate((await headers()).get("accept-language"));
}
