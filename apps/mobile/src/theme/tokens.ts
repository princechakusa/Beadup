/**
 * Beadup design tokens (approved palette, CLAUDE.md). Dark only.
 * Gold is reserved for money. Everything else is blue, white and steel.
 */
export const colors = {
  midnight: '#0A0C10', // app background
  gunmetal: '#161A21', // raised surfaces
  panel: 'rgba(22, 26, 33, 0.72)', // glass fill over blur
  line: 'rgba(255, 255, 255, 0.08)', // hairlines
  lineStrong: 'rgba(255, 255, 255, 0.14)',
  bead: '#4DD8FF', // primary accent
  beadDeep: '#0B4F7A',
  beadInk: '#04121A', // text on bead blue
  gold: '#FFB547', // money only
  paint: '#F4F6FA', // primary text
  steel: '#9AA3B2', // secondary text
  danger: '#FF8A8A',
  success: '#5BE3A4',
} as const;

export const fonts = {
  display: 'Sora_700Bold',
  displayHeavy: 'Sora_800ExtraBold',
  displaySemi: 'Sora_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Type scale: [fontSize, lineHeight, letterSpacing]. */
export const type = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  eyebrow: { fontFamily: fonts.bodySemi, fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
  money: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 } as const;

/** Spring presets (Reanimated withSpring configs). */
export const springs = {
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  bouncy: { damping: 9, stiffness: 260, mass: 0.7 },
  settle: { damping: 22, stiffness: 180, mass: 1 },
} as const;

/** Soft bead-blue glow for focused or primary elements. */
export const glow = {
  shadowColor: colors.bead,
  shadowOpacity: 0.35,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
} as const;
