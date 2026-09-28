// Brand marks from Simple Icons (https://simpleicons.org, CC0 collection; the marks
// themselves are trademarks of their owners and are used here only to identify each phone).
import apple from 'simple-icons/icons/apple.svg?raw';
import xiaomi from 'simple-icons/icons/xiaomi.svg?raw';
import android from 'simple-icons/icons/android.svg?raw';
import ios from 'simple-icons/icons/ios.svg?raw';
import motorola from 'simple-icons/icons/motorola.svg?raw';

const pathOf = (svg) => svg.match(/ d="([^"]+)"/)[1];

// Xiaomi's current mark is "mi" cut out of a rounded square. Phones of the Redmi Note 3
// era carried just the "mi" letters, so drop the first sub-path (the square).
const xiaomiPath = pathOf(xiaomi);
const miLetters = xiaomiPath.slice(xiaomiPath.indexOf('M', 1));

export const LOGO_PATHS = {
  apple: pathOf(apple),
  mi: miLetters,
  android: pathOf(android),
  ios: pathOf(ios),
  motorola: pathOf(motorola),
};

/** Inline SVG for the UI. */
export function logoSvg(name, { size = 18, label = name } = {}) {
  const d = LOGO_PATHS[name];
  if (!d) return '';
  return `<svg class="logo logo-${name}" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${label}" fill="currentColor"><path d="${d}"/></svg>`;
}
