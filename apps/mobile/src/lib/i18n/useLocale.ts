import { useSyncExternalStore } from 'react';

import { getLocale, subscribeLocale, type Locale } from './index';

/** The current language; the component re-renders when it changes. */
export const useLocale = (): Locale => useSyncExternalStore(subscribeLocale, getLocale, getLocale);
