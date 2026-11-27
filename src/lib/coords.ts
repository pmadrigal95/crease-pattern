/**
 * A place as coordinates, worded by the page's language: "9.86° N · 83.92° W". Shared by the hero's
 * byline and the contact postcard's postmark, so both always print the same spot.
 */
export interface CompassWords {
  north: string;
  south: string;
  east: string;
  west: string;
}

const degrees = (value: number, plus: string, minus: string) =>
  `${Math.abs(value).toFixed(2)}° ${value < 0 ? minus : plus}`;

export const coordsText = (lat: number, lon: number, words: CompassWords): string =>
  `${degrees(lat, words.north, words.south)} · ${degrees(lon, words.east, words.west)}`;
