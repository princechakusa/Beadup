import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { supabase } from './supabase';

// Beadup Pro via the App Store / Google Play (owner decision 2026-11-07),
// through RevenueCat. Prices are never hardcoded: the paywall shows the
// store's own localized price string. The server learns about purchases
// from RevenueCat's webhook; the app user id is the Supabase user id.

export const ENTITLEMENT = 'pro';

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let configuredFor: string | null = null;

/** True when this build can sell subscriptions (store keys configured). */
export const purchasesAvailable = Boolean(apiKey && supabase);

/** Configure once per signed-in user. Safe to call repeatedly. */
export async function ensurePurchases(userId: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    if (!configuredFor) {
      Purchases.configure({ apiKey, appUserID: userId });
      configuredFor = userId;
    } else if (configuredFor !== userId) {
      await Purchases.logIn(userId);
      configuredFor = userId;
    }
    return true;
  } catch {
    return false;
  }
}

export async function resetPurchases(): Promise<void> {
  if (!configuredFor) return;
  configuredFor = null;
  await Purchases.logOut().catch(() => {});
}

export type ProOffer = { pkg: PurchasesPackage; price: string; period: string };

/** Human period from an ISO 8601 duration ("P1M" -> "month"). */
function periodLabel(iso: string | null): string {
  switch (iso) {
    case 'P1W':
      return 'week';
    case 'P1M':
      return 'month';
    case 'P3M':
      return '3 months';
    case 'P6M':
      return '6 months';
    case 'P1Y':
      return 'year';
    default:
      return 'period';
  }
}

export async function loadProOffer(): Promise<ProOffer | null> {
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.monthly ?? offerings.current?.availablePackages[0];
  if (!pkg) return null;
  return { pkg, price: pkg.product.priceString, period: periodLabel(pkg.product.subscriptionPeriod) };
}

export const isPro = (info: CustomerInfo) => Boolean(info.entitlements.active[ENTITLEMENT]);

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

export async function buyPro(offer: ProOffer): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(offer.pkg);
    return isPro(customerInfo) ? 'purchased' : 'failed';
  } catch (e) {
    return (e as { userCancelled?: boolean | null }).userCancelled ? 'cancelled' : 'failed';
  }
}

export async function restorePro(): Promise<boolean> {
  return isPro(await Purchases.restorePurchases());
}

/** Store page for managing or cancelling the subscription. */
export async function managementUrl(): Promise<string | null> {
  return (await Purchases.getCustomerInfo()).managementURL;
}
