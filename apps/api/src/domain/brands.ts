/**
 * Curated aliases for automatic merchant logos (008 research R3, R8): recipient words → brand
 * keys in order of preference (coloured theSVG logo first, Simple Icons glyph as fallback).
 * Only generic brand words, never names from the owner's bookings. An alias matches as
 * consecutive whole words of the normalized recipient text ("dm" never matches "Admiral").
 */
export interface CuratedBrand {
  /** Brand keys `<set>:<name>`; the first one in the catalogue wins. */
  keys: readonly string[]
  aliases: readonly string[]
}

/** Colour name (theSVG) and/or Simple Icons slug → ordered key list. */
const both = (colour: string | null, glyph: string | null): string[] => [
  ...(colour ? [`thesvg-color:${colour}`] : []),
  ...(glyph ? [`simple-icons:${glyph}`] : []),
]

export const BRAND_ALIASES: readonly CuratedBrand[] = [
  { keys: both('rewe', 'rewe'), aliases: ['rewe'] },
  { keys: both('lidl', 'lidl'), aliases: ['lidl'] },
  { keys: both('aldi-sud', 'aldisud'), aliases: ['aldi sud', 'aldi süd', 'aldi sued'] },
  { keys: both('aldi-nord', 'aldinord'), aliases: ['aldi nord', 'aldi'] },
  { keys: both('edeka', 'edeka'), aliases: ['edeka'] },
  { keys: both('dm', 'dm'), aliases: ['dm drogerie', 'dm'] },
  { keys: both('kaufland', 'kaufland'), aliases: ['kaufland'] },
  { keys: both('netto', 'netto'), aliases: ['netto marken discount', 'netto'] },
  { keys: both('penny', 'penny'), aliases: ['penny'] },
  { keys: both('rossmann', 'rossmann'), aliases: ['rossmann'] },
  { keys: both('paypal', 'paypal'), aliases: ['paypal'] },
  { keys: both('klarna', 'klarna'), aliases: ['klarna'] },
  // Not in Simple Icons any more (removed at the brand's request): coloured logo only.
  { keys: both('amazon', null), aliases: ['amazon', 'amzn'] },
  { keys: both('netflix', 'netflix'), aliases: ['netflix'] },
  { keys: both('spotify', 'spotify'), aliases: ['spotify'] },
  {
    keys: both('deutsche-bahn', 'deutschebahn'),
    aliases: ['deutsche bahn', 'db vertrieb', 'db fernverkehr'],
  },
  { keys: both('vodafone', 'vodafone'), aliases: ['vodafone'] },
  {
    keys: both('deutsche-telekom', 'deutschetelekom'),
    aliases: ['telekom deutschland', 'deutsche telekom', 'telekom'],
  },
  { keys: both('o2', 'o2'), aliases: ['telefonica germany', 'o2'] },
  { keys: both('ikea', 'ikea'), aliases: ['ikea'] },
  { keys: both('shell', 'shell'), aliases: ['shell'] },
  { keys: both('aral', 'aral'), aliases: ['aral'] },
  { keys: both('sparkasse', 'sparkasse'), aliases: ['sparkasse'] },
  { keys: both('n26', 'n26'), aliases: ['n26'] },
  { keys: both('apple-light', 'apple'), aliases: ['apple com bill', 'apple'] },
  { keys: both('google', 'google'), aliases: ['google'] },
  {
    keys: both('mcdonalds', 'mcdonalds'),
    aliases: ['mcdonalds', 'mcdonald s', 'mcdonald', 'mc donalds'],
  },
  { keys: both('burger-king', 'burgerking'), aliases: ['burger king'] },
  { keys: both('zalando', 'zalando'), aliases: ['zalando'] },
  { keys: both('ebay', 'ebay'), aliases: ['ebay'] },
  { keys: both('otto', 'otto'), aliases: ['otto gmbh', 'otto de'] },
  { keys: both('uber-light', 'uber'), aliases: ['uber', 'uber eats'] },
  { keys: both('deutsche-post', 'deutschepost'), aliases: ['deutsche post'] },
  { keys: both('dhl', 'dhl'), aliases: ['dhl'] },
  { keys: both('commerzbank', 'commerzbank'), aliases: ['commerzbank'] },
  { keys: both('zara', 'zara'), aliases: ['zara'] },
  { keys: both('mediamarkt', 'mediamarkt'), aliases: ['media markt', 'mediamarkt'] },
  { keys: both('saturn', 'saturn'), aliases: ['saturn electro', 'saturn'] },
  { keys: both('easyjet', 'easyjet'), aliases: ['easyjet'] },
]
