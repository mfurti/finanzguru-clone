/**
 * Curated aliases for automatic merchant logos (008 research R3): recipient words → Simple Icons
 * slug. Only generic brand words, never names from the owner's bookings. An alias matches as
 * consecutive whole words of the normalized recipient text ("dm" never matches "Admiral").
 * Amazon is not part of Simple Icons (removed at the brand's request): own upload instead.
 */
export const BRAND_ALIASES: readonly { slug: string; aliases: readonly string[] }[] = [
  { slug: 'rewe', aliases: ['rewe'] },
  { slug: 'lidl', aliases: ['lidl'] },
  { slug: 'aldisud', aliases: ['aldi sud', 'aldi süd', 'aldi sued'] },
  { slug: 'aldinord', aliases: ['aldi nord', 'aldi'] },
  { slug: 'edeka', aliases: ['edeka'] },
  { slug: 'dm', aliases: ['dm drogerie', 'dm'] },
  { slug: 'kaufland', aliases: ['kaufland'] },
  { slug: 'netto', aliases: ['netto marken discount', 'netto'] },
  { slug: 'penny', aliases: ['penny'] },
  { slug: 'rossmann', aliases: ['rossmann'] },
  { slug: 'paypal', aliases: ['paypal'] },
  { slug: 'klarna', aliases: ['klarna'] },
  { slug: 'netflix', aliases: ['netflix'] },
  { slug: 'spotify', aliases: ['spotify'] },
  { slug: 'deutschebahn', aliases: ['deutsche bahn', 'db vertrieb', 'db fernverkehr'] },
  { slug: 'vodafone', aliases: ['vodafone'] },
  { slug: 'deutschetelekom', aliases: ['telekom deutschland', 'deutsche telekom', 'telekom'] },
  { slug: 'o2', aliases: ['telefonica germany', 'o2'] },
  { slug: 'ikea', aliases: ['ikea'] },
  { slug: 'shell', aliases: ['shell'] },
  { slug: 'aral', aliases: ['aral'] },
  { slug: 'sparkasse', aliases: ['sparkasse'] },
  { slug: 'n26', aliases: ['n26'] },
  { slug: 'apple', aliases: ['apple com bill', 'apple'] },
  { slug: 'google', aliases: ['google'] },
  { slug: 'mcdonalds', aliases: ['mcdonalds', 'mcdonald s', 'mcdonald', 'mc donalds'] },
  { slug: 'burgerking', aliases: ['burger king'] },
  { slug: 'zalando', aliases: ['zalando'] },
  { slug: 'ebay', aliases: ['ebay'] },
  { slug: 'otto', aliases: ['otto gmbh', 'otto de'] },
  { slug: 'uber', aliases: ['uber', 'uber eats'] },
  { slug: 'deutschepost', aliases: ['deutsche post'] },
  { slug: 'dhl', aliases: ['dhl'] },
  { slug: 'commerzbank', aliases: ['commerzbank'] },
  { slug: 'zara', aliases: ['zara'] },
  { slug: 'mediamarkt', aliases: ['media markt', 'mediamarkt'] },
  { slug: 'saturn', aliases: ['saturn electro', 'saturn'] },
  { slug: 'easyjet', aliases: ['easyjet'] },
]

/** Curated slugs, shown first in the brand picker. */
export const CURATED_SLUGS: readonly string[] = BRAND_ALIASES.map((brand) => brand.slug)
