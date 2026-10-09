/**
 * Natural-language map intent for TG / RU / EN (typed or speech-to-text).
 * Maps chat/voice queries → nearby / search / route / locate actions.
 * Pure module — safe on server and client.
 */
import type { TravelMode } from "@/providers/maps/types";
import { wordRe } from "@/lib/maps/places-tj";
import { findScope, type MapScope } from "@/lib/maps/places-world";

export type { MapScope } from "@/lib/maps/places-world";

export type MapCategoryKey =
  | "pharmacy"
  | "hospital"
  | "restaurant"
  | "cafe"
  | "supermarket"
  | "bank"
  | "atm"
  | "fuel"
  | "hotel"
  | "mosque"
  | "school"
  | "university"
  | "shop"
  | "car_repair"
  | "mobile_phone"
  | "park"
  | "marketplace"
  | "airport"
  | "station"
  | "bus_stop"
  | "attraction"
  /** "What is near me?" — any named everyday place (food, pharmacy, bank, shops…). */
  | "poi";

/** Display order for category chips. */
export const CATEGORY_ORDER: MapCategoryKey[] = [
  "pharmacy",
  "hospital",
  "restaurant",
  "cafe",
  "supermarket",
  "bank",
  "atm",
  "fuel",
  "hotel",
  "mosque",
  "school",
  "university",
  "shop",
  "car_repair",
  "mobile_phone",
  "park",
  "marketplace",
  "airport",
  "station",
  "bus_stop",
];

export const CATEGORY_EMOJI: Record<MapCategoryKey, string> = {
  pharmacy: "💊",
  hospital: "🏥",
  restaurant: "🍽",
  cafe: "☕",
  supermarket: "🛒",
  bank: "🏦",
  atm: "🏧",
  fuel: "⛽",
  hotel: "🏨",
  mosque: "🕌",
  school: "🏫",
  university: "🎓",
  shop: "🛍",
  car_repair: "🔧",
  mobile_phone: "📱",
  park: "🌳",
  marketplace: "🏪",
  airport: "✈️",
  station: "🚆",
  bus_stop: "🚌",
  attraction: "📍",
  poi: "📍",
};

/**
 * `scope` = the city/country the user named ("Дар Лондон …"). When present the
 * search runs there, never around the user's current location.
 */
/** One end of an "from A to B" question, before geocoding. */
export type MapEndpoint = { query: string; raw: string; scope?: MapScope };

export type MapIntent =
  | {
      type: "nearby";
      category: MapCategoryKey;
      raw: string;
      scope?: MapScope;
      /** "Ба фурудгоҳ чӣ тавр равам?" — find the nearest one and route to it. */
      route?: boolean;
      mode?: TravelMode;
    }
  | {
      type: "search";
      /** Place name without the scope; empty = the scope itself ("Лондон куҷост?"). */
      query: string;
      raw: string;
      category?: MapCategoryKey;
      scope?: MapScope;
      mode?: TravelMode;
    }
  | {
      type: "route";
      raw: string;
      destination?: string;
      scope?: MapScope;
      mode?: TravelMode;
      /** Explicit start ("Аз Душанбе то Хуҷанд"); absent = the user's location. */
      origin?: MapEndpoint;
    }
  | { type: "locate"; raw: string }
  | { type: "none" };

/**
 * OSM tag selectors (union) + search radii for each category.
 * Airports / railway stations are sparse, so they search much wider.
 */
export const CATEGORY_TAGS: Record<
  MapCategoryKey,
  { overpass: string[]; nominatim: string; labelEn: string; radii?: number[] }
> = {
  pharmacy: {
    overpass: ['["amenity"="pharmacy"]', '["healthcare"="pharmacy"]'],
    nominatim: "pharmacy",
    labelEn: "Pharmacy",
  },
  hospital: {
    overpass: ['["amenity"~"^(hospital|clinic)$"]', '["healthcare"~"^(hospital|clinic)$"]'],
    nominatim: "hospital",
    labelEn: "Hospital",
  },
  restaurant: {
    overpass: ['["amenity"~"^(restaurant|fast_food)$"]'],
    nominatim: "restaurant",
    labelEn: "Restaurant",
  },
  cafe: { overpass: ['["amenity"="cafe"]'], nominatim: "cafe", labelEn: "Café" },
  supermarket: {
    overpass: ['["shop"~"^(supermarket|hypermarket|convenience)$"]'],
    nominatim: "supermarket",
    labelEn: "Supermarket",
  },
  bank: { overpass: ['["amenity"="bank"]'], nominatim: "bank", labelEn: "Bank" },
  atm: { overpass: ['["amenity"="atm"]', '["atm"="yes"]'], nominatim: "atm", labelEn: "ATM" },
  fuel: { overpass: ['["amenity"="fuel"]'], nominatim: "fuel", labelEn: "Fuel station" },
  hotel: {
    overpass: ['["tourism"~"^(hotel|hostel|guest_house|motel)$"]'],
    nominatim: "hotel",
    labelEn: "Hotel",
  },
  mosque: {
    overpass: ['["amenity"="place_of_worship"]["religion"="muslim"]'],
    nominatim: "mosque",
    labelEn: "Mosque",
  },
  school: { overpass: ['["amenity"="school"]'], nominatim: "school", labelEn: "School" },
  university: {
    overpass: ['["amenity"~"^(university|college)$"]'],
    nominatim: "university",
    labelEn: "University",
  },
  shop: {
    overpass: ['["shop"~"^(mall|department_store|clothes|shoes|electronics|general|variety_store|gift|cosmetics)$"]'],
    nominatim: "shop",
    labelEn: "Shop",
  },
  car_repair: {
    overpass: ['["shop"~"^(car_repair|tyres)$"]', '["craft"="car_repair"]'],
    nominatim: "car repair",
    labelEn: "Car service",
  },
  mobile_phone: {
    overpass: ['["shop"~"^(mobile_phone|telecommunication)$"]'],
    nominatim: "mobile phone shop",
    labelEn: "Phone shop",
  },
  park: { overpass: ['["leisure"~"^(park|garden)$"]'], nominatim: "park", labelEn: "Park" },
  marketplace: {
    overpass: ['["amenity"="marketplace"]'],
    nominatim: "bazaar",
    labelEn: "Bazaar",
  },
  airport: {
    overpass: ['["aeroway"="aerodrome"]["iata"]', '["aeroway"="aerodrome"]["aerodrome:type"~"international|public"]'],
    nominatim: "airport",
    labelEn: "Airport",
    // Big-city airports sit 30–45 km from the centre (Sheremetyevo, Heathrow, JFK…).
    radii: [45_000, 100_000, 200_000],
  },
  station: {
    overpass: ['["railway"~"^(station|halt)$"]'],
    nominatim: "railway station",
    labelEn: "Railway station",
    radii: [5_000, 20_000, 60_000],
  },
  bus_stop: {
    overpass: ['["highway"="bus_stop"]', '["amenity"="bus_station"]'],
    nominatim: "bus station",
    labelEn: "Bus / marshrutka stop",
    radii: [800, 2_000, 5_000],
  },
  attraction: {
    overpass: ['["tourism"~"^(attraction|museum|viewpoint)$"]'],
    nominatim: "attraction",
    labelEn: "Attraction",
  },
  poi: {
    overpass: [
      '["amenity"~"^(restaurant|fast_food|cafe|pharmacy|bank|atm|fuel|hospital|clinic|marketplace)$"]["name"]',
      '["shop"~"^(supermarket|convenience|mall|department_store)$"]["name"]',
      '["tourism"~"^(hotel|attraction|museum)$"]["name"]',
    ],
    nominatim: "restaurant",
    labelEn: "Place",
    radii: [600, 1_500, 4_000],
  },
};

export const DEFAULT_RADII = [1_500, 4_000, 10_000, 20_000];

/** Ordered: specific before generic (ATM before bank, phone shop before shop…). */
const CATEGORY_PATTERNS: { key: MapCategoryKey; re: RegExp }[] = [
  { key: "pharmacy", re: wordRe("аптек|pharmac|дорухон|дорхон|doruxon|dorxon|dorukhon") },
  {
    key: "hospital",
    re: wordRe("больниц|госпитал|поликлиник|клиник|травмпункт|hospital|clinic|беморхон|бемористон|шифохон|bemorxon"),
  },
  { key: "airport", re: wordRe("аэропорт|аэровокзал|airport|фурудгоҳ|фурудгох|furudgoh") },
  {
    key: "fuel",
    re: wordRe("заправк|автозаправк|азс|fuel|petrol|gas\\s*station|бензин|сӯзишворӣ|сузишвори|стансияи\\s*сӯзишворӣ|колонк"),
  },
  {
    key: "bus_stop",
    re: wordRe(
      "истгоҳи\\s*(?:автобус|маршрутка|машрутка)|истгохи\\s*(?:автобус|маршрутка|машрутка)|остановк|автовокзал|автостанц|bus\\s*(?:stop|station)",
    ),
  },
  {
    key: "station",
    re: wordRe("вокзал|ж/?д\\s*станц|railway|train\\s*station|истгоҳи\\s*роҳи\\s*оҳан|истгохи\\s*рохи\\s*охан|роҳи\\s*оҳан|рохи\\s*охан|қатора|катора"),
  },
  {
    key: "mobile_phone",
    re: wordRe("магазин\\s*телефон|салон\\s*связ|phone\\s*shop|mobile\\s*shop|мағозаи\\s*телефон|магозаи\\s*телефон|телефонфурӯш|телефонфуруш|мобильн"),
  },
  {
    key: "car_repair",
    re: wordRe("автосервис|avtoservis|car\\s*(?:repair|service)|auto\\s*service|autoservice|таъмири\\s*(?:мошин|автомобил)|устохона|шиномонтаж|вулканизац|сто(?![\\p{L}])"),
  },
  { key: "supermarket", re: wordRe("супермаркет|гипермаркет|минимаркет|supermarket|hypermarket|grocery|продуктов") },
  { key: "atm", re: wordRe("банкомат|bankomat|atm|терминал") },
  { key: "bank", re: wordRe("банк(?!омат)|бонк|bank(?!omat)") },
  { key: "hotel", re: wordRe("гостиниц|отел|hotel|hostel|хостел|меҳмонхон|мехмонхон") },
  { key: "mosque", re: wordRe("мечет|mosque|масҷид|масчид|масджид") },
  { key: "university", re: wordRe("универ|university|донишгоҳ|донишгох|донишкада|институт|college|колледж") },
  { key: "school", re: wordRe("школ|school|мактаб") },
  { key: "restaurant", re: wordRe("ресторан|restaurant|ошхон|oshxon|таомхон|столов|fast\\s*food") },
  { key: "cafe", re: wordRe("кафе(?!др)|caf[eé]|кофейн|coffee|қаҳвахон|кахвахон|чойхон") },
  { key: "marketplace", re: wordRe("рынок|рынк|базар|бозор|bazaar|bazar|market(?![\\p{L}])") },
  { key: "park", re: wordRe("парк(?!ов)|park(?!ing)|боғ(?:и|ҳо)?(?![\\p{L}])|боги(?![\\p{L}])") },
  { key: "attraction", re: wordRe("достопримечат|attraction|ҷойҳои\\s*диданӣ|музей|museum") },
  { key: "shop", re: wordRe("магазин|shop|store|дукон|dukon|мағоза|магоза|savdo|савдо") },
];

const NEARBY_RE = wordRe(
  "рядом|возле|ближайш|поблизости|около\\s+меня|near\\s*(?:me|by)|nearby|closest|nearest|наздик|nazdik|атрофи\\s+ман|гирду\\s*атроф|назди\\s+ман|канори\\s+ман",
);

const ROUTE_RE = wordRe(
  "как\\s+добраться|как\\s+доехать|как\\s+дойти|как\\s+пройти|маршрут|проложи|route|how\\s+(?:do\\s+i\\s+)?get|directions|navigate|чӣ\\s*тавр\\s*(?:равам|расам|биравам)|чи\\s*тавр\\s*(?:равам|расам|биравам)|чӣ\\s*гуна\\s*расам|роҳро\\s*нишон|рохро\\s*нишон|мехоҳам\\s*равам|мехохам\\s*равам|то\\s*расидан",
);

const MODE_PATTERNS: { mode: TravelMode; re: RegExp }[] = [
  { mode: "driving", re: wordRe("бо\\s*мошин|на\\s*машин|на\\s*авто|by\\s*car|drive|driving|такси|taxi") },
  { mode: "cycling", re: wordRe("велосипед|велик|дучарх|bike|bicycle|cycling|by\\s*bike") },
  { mode: "transit", re: wordRe("маршрутк|машрутк|автобус|троллейбус|bus|transit|нақлиёт|наклиёт|общественн") },
  { mode: "walking", re: wordRe("пиёда|пиеда|пешком|on\\s*foot|walk") },
];

const LOCATE_RE = wordRe(
  "мо[её]\\s+местополож|где\\s+я(?![\\p{L}])|my\\s+location|where\\s+am\\s+i|locate\\s+me|ҷойгоҳи\\s+ман|ҷойгиршавии\\s+ман|чойгиршавии\\s+ман|ман\\s+(?:дар\\s+)?куҷо\\s*(?:ям|ҳастам)|ман\\s+(?:дар\\s+)?кучо\\s*(?:ям|хастам)",
);

const FILLER_WORDS = [
    "дар\\s+куҷо\\s+аст",
    "дар\\s+кучо\\s+аст",
    "куҷост",
    "кучост",
    "куҷо",
    "кучо",
    "где\\s+находится",
    "где\\s+найти",
    "где",
    "where\\s+is",
    "where\\s+are",
    "where",
    "ёфт\\s+мешавад",
    "ҳаст",
    "хаст",
    "найди|найти|покажи|find|show(?:\\s+me)?|search",
    "нишон\\s*(?:деҳ|дех|диҳед|дихед)?",
    "ёбед|ёб|ёфта\\s+деҳ",
    "аз\\s+инҷо|аз\\s+инчо|отсюда|from\\s+here",
    "до|to|ба|то|в|in|дар|аз|от|from",
    "please|пожалуйста|лутфан",
    "ман|мне|меня|me|my|барои|для|for",
    "a|an|the|any|some|is|are|there|i|need|want|looking",
    "есть|ли|нужн\\p{L}*|хочу|кадом\\p{L}*|оё|мехоҳам|мехохам|лозим|аст|бошад",
];

const FILLER_RE = new RegExp(
  `(?<![\\p{L}])(?:${FILLER_WORDS.join("|")})(?![\\p{L}])`,
  "giu",
);

/** Global version of a prefix regex that also swallows the rest of the word. */
function wholeWords(re: RegExp): RegExp {
  return new RegExp(`${re.source}[\\p{L}]*`, "giu");
}

const FIND_RE = wordRe(
  "ёб|ёфт|куҷо|кучо|где|найди|найти|покажи|есть\\s+ли|find|show|where|search|нишон|ҳаст|хаст|лозим|нужн|need",
);

function cleanup(text: string): string {
  return text
    .replace(wholeWords(ROUTE_RE), " ")
    .replace(FILLER_RE, " ")
    .replace(/[?!.,;:«»"()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripModes(text: string): string {
  return MODE_PATTERNS.reduce((acc, { re }) => acc.replace(wholeWords(re), " "), text);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function detectTravelMode(text: string): TravelMode | undefined {
  return MODE_PATTERNS.find(({ re }) => re.test(text))?.mode;
}

export function detectCategory(text: string): MapCategoryKey | null {
  return CATEGORY_PATTERNS.find((c) => c.re.test(text))?.key ?? null;
}

const CENTRE_RE = wordRe(
  "сентри|сентр|маркази|марказ|центри|центр(?:е|а)?(?:\\s+города)?|center\\s+of|centre\\s+of|city\\s+cent(?:er|re)|downtown|sentri|sentr",
);

/** Questions *about* a place (history, weather…) are for the AI, not the map. */
const INFO_RE = wordRe(
  "расскажи|рассказ|истори|history|tell\\s+me|about|дар\\s+бораи|погод|ҳаво(?![\\p{L}])|хаво(?![\\p{L}])|weather|населени|аҳолӣ|пойтахт|столиц|capital|валют|виза|visa|чист(?![\\p{L}])|что\\s+такое|what\\s+is|перевед|translate|тарҷума",
);

/** Tajik case/plural suffixes glued to names: "Big Ben-ро", "Apple Store-ҳоро", "Регистонро". */
const HYPHEN_SUFFIX_RE = /[-‐–]\s*(?:ҳоро|хоро|ҳо|хо|ро|ба|и)(?![\p{L}])/giu;
const RO_SUFFIX_RE = /(?<![\p{L}])([\u0400-\u04FF]{4,})ро(?![\p{L}])/gu;

const FILLER_WORD_RE = new RegExp(`^(?:${FILLER_WORDS.join("|")})$`, "iu");

/** Unknown "дар X" words that are map vocabulary, not place names. */
function isReservedWord(word: string): boolean {
  const w = word.trim();
  return (
    Boolean(detectCategory(w)) ||
    NEARBY_RE.test(w) ||
    FILLER_WORD_RE.test(w) ||
    CENTRE_RE.test(w) ||
    MODE_PATTERNS.some(({ re }) => re.test(w))
  );
}

/** The place name left after removing scope, verbs, modes and fillers. */
function cleanQuery(text: string, scoped: boolean): string {
  let t = stripModes(text)
    .replace(wholeWords(ROUTE_RE), " ")
    .replace(wholeWords(NEARBY_RE), " ")
    .replace(wholeWords(DIRECTIONS_Q_RE), " ")
    .replace(wholeWords(DISTANCE_Q_RE), " ")
    .replace(HYPHEN_SUFFIX_RE, "")
    .replace(RO_SUFFIX_RE, "$1");
  if (scoped) t = t.replace(wholeWords(CENTRE_RE), " ");
  return t
    .replace(FILLER_RE, " ")
    .replace(/[?!.,;:«»"()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Apple Store", "Дорухонаи Сомон": a proper name next to the category word means
 * the user wants that named place, not any shop/pharmacy.
 */
function namesAPlace(query: string, category: MapCategoryKey, raw: string): boolean {
  const re = CATEGORY_PATTERNS.find((c) => c.key === category)!.re;
  const leftover = query.replace(wholeWords(re), " ").trim();
  if (!leftover) return false;
  const firstRawWord = raw.trim().split(/\s+/)[0] ?? "";
  return leftover.split(/\s+/).some((w) => {
    if (w.length < 2 || !/^\p{Lu}/u.test(w)) return false;
    // A capital at the start of a Cyrillic sentence is just grammar.
    return !(firstRawWord.startsWith(w) && /^[\u0400-\u04FF]/.test(w));
  });
}

/** "роҳ", "масофа", "km" — distance vocabulary that is not a question by itself. */
const DIST_WORD_RE = wordRe(
  "масофа|роҳ(?![\\p{L}])|роҳи(?![\\p{L}])|рох(?![\\p{L}])|рохи(?![\\p{L}])|расстояни|дорог[аи]|distance|drive\\s+time|km(?![\\p{L}])|км(?![\\p{L}])|километр|kilomet|miles?(?![\\p{L}])",
);

/** Question words left around the two place names of an A→B question. */
const HOW_MUCH_RE = wordRe(
  "чӣ\\s*қадар|чи\\s*кадар|чанд|сколько|как\\s+далеко|how\\s+(?:far|long|many|much)|мерас\\p{L}*|мешавад|мегирад|вақт|вакт|ехать|идти|лететь|займ[её]т|займет|is\\s+it|it\\s+is|does\\s+it\\s+take|take",
);

const A2B_RE = /(?<![\p{L}])(?:аз|от|from)\s+(.+?)\s+(?:то|до|to)\s+(.+)$/iu;
const HERE_RE = /^(?:ин\s*ҷо|инҷо|ин\s*чо|инчо|ман|here|me|отсюда|сюда|меня|я)$/iu;

function endpointOf(side: string): MapEndpoint | null {
  const raw = side.trim();
  if (!raw || raw.length > 80) return null;
  const found = findScope(raw, isReservedWord);
  const query = cleanQuery(
    (found ? found.rest : raw).replace(wholeWords(HOW_MUCH_RE), " ").replace(wholeWords(DIST_WORD_RE), " "),
    Boolean(found?.scope),
  );
  if (!found?.scope && query.length < 2) return null;
  return { query, raw, scope: found?.scope };
}

/** "Аз Душанбе то Хуҷанд чӣ қадар роҳ аст?" / "от Москвы до Казани" / "from Paris to Lyon". */
function parseOriginDestination(raw: string): { origin?: MapEndpoint; destination: MapEndpoint } | null {
  const asksRoute =
    ROUTE_RE.test(raw) || DISTANCE_Q_RE.test(raw) || DIST_WORD_RE.test(raw) || HOW_MUCH_RE.test(raw) || Boolean(detectTravelMode(raw));
  if (!asksRoute) return null;
  const text = stripModes(raw)
    .replace(wholeWords(DISTANCE_Q_RE), " ")
    .replace(wholeWords(ROUTE_RE), " ")
    .replace(/[?!.,;:«»"()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = text.match(A2B_RE);
  if (!m) return null;
  const originText = m[1]!.trim();
  const destination = endpointOf(m[2]!);
  if (!destination) return null;
  if (HERE_RE.test(originText)) return { destination };
  const origin = endpointOf(originText);
  return origin ? { origin, destination } : null;
}

/** "Наздики ман чӣ ҳаст?" / "Что рядом?" / "What's nearby?" — no category named. */
const WHAT_AROUND_RE = wordRe(
  "чӣ\\s*(?:ҳаст|хаст|чиз)|чи\\s*(?:хаст|чиз)|кадом\\s+ҷойҳо|что\\s+(?:есть\\s+)?(?:рядом|поблизости|вокруг|интересн|там)|what'?s\\s+(?:near|around|there)|what\\s+is\\s+(?:near|around|there)|anything\\s+(?:near|around)|places\\s+(?:near|around)",
);

export function detectMapIntent(text: string): MapIntent {
  const raw = text.trim();
  if (!raw || raw.length > 240) return { type: "none" };

  if (LOCATE_RE.test(raw)) return { type: "locate", raw };

  const mode = detectTravelMode(raw);
  if (!INFO_RE.test(raw)) {
    const pair = parseOriginDestination(raw);
    // "Аз ман то фурудгоҳ" = nearest airport from the user → category flow below.
    if (pair && (pair.origin || !detectCategory(pair.destination.query))) {
      return {
        type: "route",
        raw,
        destination: pair.destination.query || undefined,
        scope: pair.destination.scope,
        origin: pair.origin,
        mode,
      };
    }
  }

  const category = detectCategory(raw);
  const found = findScope(raw, isReservedWord);
  const scope = found?.scope;
  const query = cleanQuery(found ? found.rest : raw, Boolean(scope));
  const words = wordCount(raw);
  const info = INFO_RE.test(raw);
  const nearbyWords = NEARBY_RE.test(raw);
  const findWords = FIND_RE.test(raw);
  const routeWords = ROUTE_RE.test(raw) || DISTANCE_Q_RE.test(raw);

  if (category && !info) {
    // Category words inside ordinary sentences ("бизнес-план для кафе") are not map requests.
    const isRequest = nearbyWords || findWords || routeWords || words <= 3 || (Boolean(scope) && words <= 5);
    if (isRequest) {
      if (namesAPlace(query, category, raw)) {
        return routeWords || mode
          ? { type: "route", raw, destination: query, scope, mode }
          : { type: "search", query, raw, category, scope, mode };
      }
      return routeWords || mode
        ? { type: "nearby", category, raw, scope, route: true, mode }
        : { type: "nearby", category, raw, scope };
    }
  }
  if (info) return { type: "none" };

  if (!category && nearbyWords && WHAT_AROUND_RE.test(raw)) {
    return { type: "nearby", category: "poi", raw, scope };
  }

  if (routeWords || mode) {
    return query.length >= 2 || scope
      ? { type: "route", raw, destination: query || undefined, scope, mode }
      : { type: "route", raw, mode };
  }

  if (scope) {
    const mapish = findWords || nearbyWords || MAP_HINT_RE.test(raw) || words <= 4;
    return mapish ? { type: "search", query, raw, scope, mode } : { type: "none" };
  }

  if (MAP_HINT_RE.test(raw) && query.length >= 2) {
    return { type: "search", query, raw, mode };
  }

  return { type: "none" };
}

/** Words that make a short query clearly geographic even without a category. */
const MAP_HINT_RE = wordRe(
  "карт|map|навигац|адрес|суроға|сурога|куҷост|кучост|где\\s+находится|where\\s+is|сентр|марказ|центр|кӯча|куча|улиц|проспект|street|avenue|хиёбон|майдон|площад|square",
);

export function isMapRelatedQuery(text: string): boolean {
  return detectMapIntent(text).type !== "none";
}

// ---------------------------------------------------------------------------
// Follow-up questions about the last map result ("How far?", "How do I go?")
// ---------------------------------------------------------------------------

export type MapFollowUp = {
  kind: "distance" | "directions";
  /** "Бо мошин?" / "Пиёда чанд дақиқа?" — the travel mode asked about. */
  mode?: TravelMode;
  /** Asked for time/arrival ("Чанд дақиқа мерасам?") rather than distance. */
  eta?: boolean;
};

const ETA_Q_RE = wordRe(
  "чанд\\s*(?:дақиқа|дакика|соат|вақт|вакт)|кай\\s+мерас|чӣ\\s*қадар\\s*вақт|чи\\s*кадар\\s*вакт|мерасам|сколько\\s+(?:минут|времени|идти|ехать)|когда\\s+(?:буду|доед|дойд)|how\\s+long|when\\s+(?:will|do)\\s+i\\s+(?:arrive|get)|eta(?![\\p{L}])",
);

/** Verbs/nouns that pad a follow-up without naming a new place. */
const FOLLOWUP_FILLER_RE = wordRe(
  "мерас\\p{L}*|расам|расем|рафтан|меравам|равам|равем|бирав\\p{L}*|рав(?![\\p{L}])|мешавад|мегирад|дорад|дур(?![\\p{L}])|роҳ\\p{L}*|рох\\p{L}*|вақт\\p{L}*|вакт\\p{L}*|дақиқа|дакика|соат|километр|метр|км|идти|ехать|буду|минут\\p{L}*|времени|далеко|будет|займ\\p{L}*|а(?![\\p{L}])|и(?![\\p{L}])|ва(?![\\p{L}])|ҳам|хам|then|and|so|it'?s|take|takes|minutes?|go|get|arrive|бо|на|by",
);

const DISTANCE_Q_RE = wordRe(
  "чӣ\\s*қадар\\s*(?:дур|вақт)|чи\\s*кадар\\s*(?:дур|вакт)|чанд\\s*(?:дур|метр|километр|дақиқа|дакика|вақт|вакт)|то\\s+он\\s+ҷо\\s+чанд|дур\\s*аст|как\\s+далеко|далеко\\s+ли|далеко\\s+от\\s+меня|сколько\\s+(?:идти|ехать|метров|минут|времени|км|до)|how\\s+far|how\\s+long",
);

const DIRECTIONS_Q_RE = wordRe(
  [
    "чӣ\\s*(?:тавр|хел|гуна)\\s+(?:ба\\s+)?(?:(?:он|ин|ҳамин|хамин)\\s*(?:ҷо|чо)й?\\s+)?(?:равам|расам|биравам|равем)",
    "чи\\s*(?:тавр|хел|гуна)\\s+(?:ба\\s+)?(?:(?:он|ин|хамин)\\s*чо)?й?\\s*(?:равам|расам|биравам|равем)",
    "(?:ба\\s+)?(?:ҳамин|хамин|он|ин)\\s*(?:ҷо|чо)й?\\s+(?:рав|бирав|бар|бур)",
    "роҳро\\s*нишон|рохро\\s*нишон|роҳ\\s*нишон|рох\\s*нишон",
    "как\\s+(?:туда\\s+)?(?:дойти|пройти|добраться|доехать|идти)|проложи\\s+маршрут|покажи\\s+(?:маршрут|дорогу)",
    "поехали\\s+туда|пойд[её]м\\s+туда|едем\\s+туда|веди\\s+(?:меня\\s+)?туда|туда\\s+(?:поехали|пойд[её]м|едем)|маршрут\\s+туда",
    "how\\s+do\\s+i\\s+get\\s+there|how\\s+to\\s+get\\s+there|show\\s+(?:me\\s+)?(?:the\\s+)?(?:route|way)|directions|take\\s+me\\s+there|go\\s+there|navigate\\s+(?:there|to\\s+it)|route\\s+(?:there|to\\s+it)|let'?s\\s+go",
  ].join("|"),
);

const THERE_RE = wordRe(
  "ба\\s+(?:он|ҳамин|хамин|ин)\\s*(?:ҷо|чо)й?|(?:он|ҳамин|хамин|ин)\\s*(?:ҷо|чо)й?|онҷо|ончо|инҷо|инчо|туда|там|это\\s+место|сюда|это|эта|этот|there|this\\s+place|that\\s+place|it|он|вай|ин|ҳамин|хамин",
);

/** "near THAT place" (the last map result / the place selected on the map), not near the user. */
const NEAR_THERE_RE = wordRe(
  "наздики\\s+(?:он\\s*(?:ҷо|чо)й?|он(?![\\p{L}])|(?:ин|ҳамин|хамин)\\s*(?:ҷой|чой))|дар\\s+наздикии\\s+(?:он|ҳамин|хамин)|наздикии\\s+(?:он|ҳамин|хамин)|атрофи\\s+(?:он|ҳамин|хамин)|гирду\\s+атрофи\\s+он|назди\\s+он|рядом\\s+с\\s+(?:ним|ней|этим\\s+местом|тем\\s+местом|этой|этим)|рядом\\s+там|там\\s+рядом|поблизости\\s+от\\s+(?:него|неё|нее)|возле\\s+(?:него|неё|нее)|near\\s+(?:there|it|that(?:\\s+place)?|this\\s+place)|around\\s+(?:there|it)|close\\s+to\\s+(?:it|there)",
);

/** "Ин дорухона", "эта аптека", "this pharmacy" — the category word names the selected place. */
const DEMONSTRATIVE_RE = /(?<![\p{L}])(?:ин|ҳамин|хамин|он|этот|эта|это|эту|тот|та|ту|this|that)\s+([\p{L}-]+)/giu;

function stripDemonstratives(text: string): string {
  return text.replace(DEMONSTRATIVE_RE, (m, word: string) => (detectCategory(word) ? " " : m));
}

/** "Наздики он ҷо ресторан ҳаст?" → restaurant around the last result; "…чӣ ҳаст?" → any place. */
export function detectNearThere(text: string): MapCategoryKey | null {
  const raw = text.trim();
  if (!raw || raw.length > 160 || !NEAR_THERE_RE.test(raw)) return null;
  return detectCategory(raw) ?? (WHAT_AROUND_RE.test(raw) ? "poi" : null);
}

/**
 * Detects a follow-up question that refers to the previous map result or the
 * place selected on the map. Returns null when the message names a new
 * place/category (→ new search).
 */
export function detectMapFollowUp(text: string): MapFollowUp | null {
  const raw = text.trim();
  if (!raw || raw.length > 120) return null;
  const t = stripDemonstratives(raw);
  if (detectCategory(t)) return null;
  const mode = detectTravelMode(t);
  const kind: MapFollowUp["kind"] | null = DIRECTIONS_Q_RE.test(t)
    ? "directions"
    : DISTANCE_Q_RE.test(t) || ETA_Q_RE.test(t) || mode
      ? "distance"
      : null;
  if (!kind) return null;
  const rest = cleanup(
    stripModes(
      t
        .replace(wholeWords(DIRECTIONS_Q_RE), " ")
        .replace(wholeWords(DISTANCE_Q_RE), " ")
        .replace(wholeWords(ETA_Q_RE), " ")
        .replace(new RegExp(`${THERE_RE.source}(?![\\p{L}])`, "giu"), " "),
    ).replace(new RegExp(`${FOLLOWUP_FILLER_RE.source}(?![\\p{L}])`, "giu"), " "),
  ).replace(/\s+/g, "");
  if (rest.length > 3) return null;
  return { kind, mode, eta: kind === "distance" && ETA_Q_RE.test(t) };
}
