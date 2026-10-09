import { CATEGORY_TAGS, type MapCategoryKey } from "@/lib/maps/intent";

/** i18n keys for map amenity categories */
export const CATEGORY_I18N_KEY = Object.fromEntries(
  (Object.keys(CATEGORY_TAGS) as MapCategoryKey[]).map((k) => [k, `maps.cat.${k}`]),
) as Record<MapCategoryKey, string>;

/** Built-in labels (server-safe, no React i18n). */
const TG: Record<MapCategoryKey, string> = {
  pharmacy: "Дорухона",
  hospital: "Беморхона",
  restaurant: "Ресторан",
  cafe: "Кафе",
  supermarket: "Супермаркет",
  bank: "Бонк",
  atm: "Банкомат",
  fuel: "Стансияи сӯзишворӣ",
  hotel: "Меҳмонхона",
  mosque: "Масҷид",
  school: "Мактаб",
  university: "Донишгоҳ",
  shop: "Мағоза",
  car_repair: "Автосервис",
  mobile_phone: "Мағозаи телефон",
  park: "Парк",
  marketplace: "Бозор",
  airport: "Фурудгоҳ",
  station: "Истгоҳи роҳи оҳан",
  bus_stop: "Истгоҳи автобус/маршрутка",
  attraction: "Ҷойи диданӣ",
  poi: "Ҷой",
};

const RU: Record<MapCategoryKey, string> = {
  pharmacy: "Аптека",
  hospital: "Больница",
  restaurant: "Ресторан",
  cafe: "Кафе",
  supermarket: "Супермаркет",
  bank: "Банк",
  atm: "Банкомат",
  fuel: "АЗС",
  hotel: "Гостиница",
  mosque: "Мечеть",
  school: "Школа",
  university: "Университет",
  shop: "Магазин",
  car_repair: "Автосервис",
  mobile_phone: "Салон связи",
  park: "Парк",
  marketplace: "Рынок",
  airport: "Аэропорт",
  station: "Ж/д вокзал",
  bus_stop: "Остановка автобуса/маршрутки",
  attraction: "Достопримечательность",
  poi: "Место",
};

/** "…-ро меҷӯям" / "Ищу ближайшие …" / "looking for nearby …" */
const TG_PLURAL: Record<MapCategoryKey, string> = {
  pharmacy: "дорухонаҳои",
  hospital: "беморхонаҳои",
  restaurant: "ресторанҳои",
  cafe: "кафеҳои",
  supermarket: "супермаркетҳои",
  bank: "бонкҳои",
  atm: "банкоматҳои",
  fuel: "стансияҳои сӯзишвории",
  hotel: "меҳмонхонаҳои",
  mosque: "масҷидҳои",
  school: "мактабҳои",
  university: "донишгоҳҳои",
  shop: "мағозаҳои",
  car_repair: "автосервисҳои",
  mobile_phone: "мағозаҳои телефони",
  park: "паркҳои",
  marketplace: "бозорҳои",
  airport: "фурудгоҳҳои",
  station: "истгоҳҳои роҳи оҳани",
  bus_stop: "истгоҳҳои автобус/маршруткаи",
  attraction: "ҷойҳои диданӣ",
  poi: "ҷойҳои",
};

const RU_PLURAL: Record<MapCategoryKey, string> = {
  pharmacy: "аптеки",
  hospital: "больницы и клиники",
  restaurant: "рестораны",
  cafe: "кафе",
  supermarket: "супермаркеты",
  bank: "банки",
  atm: "банкоматы",
  fuel: "АЗС",
  hotel: "гостиницы",
  mosque: "мечети",
  school: "школы",
  university: "университеты",
  shop: "магазины",
  car_repair: "автосервисы",
  mobile_phone: "салоны связи",
  park: "парки",
  marketplace: "рынки",
  airport: "аэропорты",
  station: "ж/д вокзалы",
  bus_stop: "остановки",
  attraction: "достопримечательности",
  poi: "места",
};

const EN_PLURAL: Record<MapCategoryKey, string> = {
  pharmacy: "pharmacies",
  hospital: "hospitals and clinics",
  restaurant: "restaurants",
  cafe: "cafés",
  supermarket: "supermarkets",
  bank: "banks",
  atm: "ATMs",
  fuel: "fuel stations",
  hotel: "hotels",
  mosque: "mosques",
  school: "schools",
  university: "universities",
  shop: "shops",
  car_repair: "car services",
  mobile_phone: "phone shops",
  park: "parks",
  marketplace: "bazaars",
  airport: "airports",
  station: "railway stations",
  bus_stop: "bus stops",
  attraction: "attractions",
  poi: "places",
};

function lang(locale: string): string {
  return locale.split("-")[0]?.toLowerCase() || "tg";
}

export function categoryLabel(key: MapCategoryKey, locale = "tg"): string {
  const l = lang(locale);
  if (l === "ru") return RU[key];
  if (l === "tg") return TG[key];
  return CATEGORY_TAGS[key].labelEn;
}

export function categoryPlural(key: MapCategoryKey, locale = "tg"): string {
  const l = lang(locale);
  if (l === "ru") return RU_PLURAL[key];
  if (l === "tg") return TG_PLURAL[key];
  return EN_PLURAL[key];
}

/** "Дорухонаи наздиктарин" / "Ближайшие аптеки" / "Nearest pharmacies" */
export function nearestTitle(key: MapCategoryKey, locale = "tg"): string {
  const l = lang(locale);
  if (l === "tg") {
    const label = TG[key];
    return `${label.endsWith("ӣ") ? `${label.slice(0, -1)}ии` : `${label}и`} наздиктарин`;
  }
  if (l === "ru") return `Ближайшие: ${RU_PLURAL[key]}`;
  return `Nearest ${EN_PLURAL[key]}`;
}

const AREA_LABELS: Record<string, { tg: string; ru: string; en: string }> = {
  country: { tg: "Кишвар", ru: "Страна", en: "Country" },
  state: { tg: "Вилоят", ru: "Область", en: "Region" },
  region: { tg: "Вилоят", ru: "Область", en: "Region" },
  province: { tg: "Вилоят", ru: "Провинция", en: "Province" },
  county: { tg: "Ноҳия", ru: "Район", en: "District" },
  district: { tg: "Ноҳия", ru: "Район", en: "District" },
  city_district: { tg: "Ноҳияи шаҳр", ru: "Район города", en: "City district" },
  municipality: { tg: "Ноҳия", ru: "Муниципалитет", en: "Municipality" },
  borough: { tg: "Ноҳия", ru: "Район", en: "Borough" },
  city: { tg: "Шаҳр", ru: "Город", en: "City" },
  town: { tg: "Шаҳрак", ru: "Город", en: "Town" },
  village: { tg: "Деҳа", ru: "Село", en: "Village" },
  hamlet: { tg: "Деҳа", ru: "Посёлок", en: "Hamlet" },
  suburb: { tg: "Маҳалла", ru: "Микрорайон", en: "Neighbourhood" },
  island: { tg: "Ҷазира", ru: "Остров", en: "Island" },
};

/** "state" → "Вилоят" / "Область" / "Region"; null for non-area categories. */
export function areaTypeLabel(type: string | undefined | null, locale = "tg"): string | null {
  const labels = type ? AREA_LABELS[type] : undefined;
  if (!labels) return null;
  const l = lang(locale);
  return l === "ru" ? labels.ru : l === "en" ? labels.en : labels.tg;
}

export function isCategoryKey(v: unknown): v is MapCategoryKey {
  return typeof v === "string" && v in CATEGORY_TAGS;
}

/** If OSM returned a bare English/Russian category word, show it in the UI language. */
export function localizePlaceName(
  name: string,
  locale = "tg",
  categoryHint?: string | null,
): string {
  const raw = name.trim();
  if (!raw) {
    return isCategoryKey(categoryHint) ? categoryLabel(categoryHint, locale) : raw;
  }
  const lower = raw.toLowerCase();
  for (const key of Object.keys(CATEGORY_TAGS) as MapCategoryKey[]) {
    if (
      lower === key ||
      lower === CATEGORY_TAGS[key].labelEn.toLowerCase() ||
      lower === RU[key].toLowerCase()
    ) {
      return categoryLabel(key, locale);
    }
  }
  return raw;
}

export const TRANSIT_EMOJI: Record<string, string> = {
  bus: "🚌",
  metro: "🚇",
  train: "🚆",
  tram: "🚋",
  ferry: "⛴",
  other: "🚐",
};

export function nominatimAcceptLanguage(locale: string): string {
  const l = lang(locale);
  if (l === "tg") return "tg,ru,en";
  if (l === "ru") return "ru,tg,en";
  return `${l},en`;
}
