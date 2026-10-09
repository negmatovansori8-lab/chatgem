/**
 * World countries and major cities with TG / RU / EN spellings (incl. Russian
 * case endings: "в Германии", "в Лондоне"). Used only to *recognise* a place
 * scope in text; coordinates always come from the geocoder.
 */
import { TJ_CITIES, wordRe } from "@/lib/maps/places-tj";

export type PlaceNames = { tg: string; ru: string; en: string };

export type WorldCountry = {
  code: string;
  /** Geocoder query (English). */
  query: string;
  names: PlaceNames;
  pattern: string;
  /** Major city ids, used as suggestions when the user names only a country. */
  cities: string[];
};

export type WorldCity = {
  id: string;
  country: string;
  query: string;
  names: PlaceNames;
  pattern: string;
};

/** Right word boundary for short/ambiguous stems. */
const E = "(?![\\p{L}])";

export const WORLD_COUNTRIES: WorldCountry[] = [
  {
    code: "gb",
    query: "United Kingdom",
    names: { tg: "Англия", ru: "Великобритания", en: "United Kingdom" },
    pattern: `англи(?:я|и|ю|ей)${E}|британи|великобритани|подшоҳии\\s+муттаҳида|подшохии\\s+муттахида|england|britain|united\\s+kingdom|uk${E}|шотланди|scotland`,
    cities: ["london", "manchester", "birmingham", "edinburgh"],
  },
  {
    code: "us",
    query: "United States",
    names: { tg: "ИМА", ru: "США", en: "USA" },
    pattern: `иёлоти\\s+муттаҳида|иёлоти\\s+муттахида|има${E}|амрико|америк(?:а|е|и|у)${E}|сша${E}|usa${E}|united\\s+states|america${E}`,
    cities: ["new_york", "los_angeles", "chicago", "washington"],
  },
  {
    code: "ca",
    query: "Canada",
    names: { tg: "Канада", ru: "Канада", en: "Canada" },
    pattern: "канад|canada",
    cities: ["toronto", "vancouver", "montreal"],
  },
  {
    code: "fr",
    query: "France",
    names: { tg: "Фаронса", ru: "Франция", en: "France" },
    pattern: "фаронса|франци|france",
    cities: ["paris", "marseille", "lyon"],
  },
  {
    code: "de",
    query: "Germany",
    names: { tg: "Олмон", ru: "Германия", en: "Germany" },
    pattern: "олмон|германи|germany|deutschland",
    cities: ["berlin", "munich", "hamburg", "frankfurt"],
  },
  {
    code: "it",
    query: "Italy",
    names: { tg: "Италия", ru: "Италия", en: "Italy" },
    pattern: "итали|italy",
    cities: ["rome", "milan", "venice"],
  },
  {
    code: "es",
    query: "Spain",
    names: { tg: "Испания", ru: "Испания", en: "Spain" },
    pattern: "испани|spain",
    cities: ["madrid", "barcelona"],
  },
  {
    code: "ae",
    query: "United Arab Emirates",
    names: { tg: "АМА", ru: "ОАЭ", en: "UAE" },
    pattern: `аморати\\s+муттаҳидаи\\s+араб|амороти\\s+муттаҳидаи\\s+араб|ама${E}|оаэ${E}|эмират|uae${E}|emirates`,
    cities: ["dubai", "abu_dhabi"],
  },
  {
    code: "sa",
    query: "Saudi Arabia",
    names: { tg: "Арабистони Саудӣ", ru: "Саудовская Аравия", en: "Saudi Arabia" },
    pattern: "арабистони\\s+саудӣ|арабистони\\s+сауди|саудовск|saudi",
    cities: ["mecca", "medina", "riyadh", "jeddah"],
  },
  {
    code: "tr",
    query: "Turkey",
    names: { tg: "Туркия", ru: "Турция", en: "Turkey" },
    pattern: "туркия|турци|turkey|türkiye|turkiye",
    cities: ["istanbul", "ankara", "antalya"],
  },
  {
    code: "ru",
    query: "Russia",
    names: { tg: "Русия", ru: "Россия", en: "Russia" },
    pattern: "русия|росси(?:я|и|ю|ей)|russia",
    cities: ["moscow", "saint_petersburg", "kazan", "novosibirsk"],
  },
  {
    code: "cn",
    query: "China",
    names: { tg: "Чин", ru: "Китай", en: "China" },
    pattern: `хитой${E}|чин${E}|кита(?:й|е|я|ю)${E}|china`,
    cities: ["beijing", "shanghai", "guangzhou", "urumqi"],
  },
  {
    code: "jp",
    query: "Japan",
    names: { tg: "Ҷопон", ru: "Япония", en: "Japan" },
    pattern: "ҷопон|чопон|япони|japan",
    cities: ["tokyo", "osaka", "kyoto"],
  },
  {
    code: "kr",
    query: "South Korea",
    names: { tg: "Кореяи Ҷанубӣ", ru: "Южная Корея", en: "South Korea" },
    pattern: "кореяи\\s+ҷанубӣ|кореяи\\s+чануби|южн\\p{L}*\\s+коре|south\\s+korea|коре(?:я|е|и|ю)(?![\\p{L}])|korea",
    cities: ["seoul", "busan"],
  },
  {
    code: "in",
    query: "India",
    names: { tg: "Ҳиндустон", ru: "Индия", en: "India" },
    pattern: `ҳиндустон|хиндустон|инди(?:я|и|ю|ей)${E}|india${E}`,
    cities: ["delhi", "mumbai"],
  },
  {
    code: "pk",
    query: "Pakistan",
    names: { tg: "Покистон", ru: "Пакистан", en: "Pakistan" },
    pattern: "покистон|пакистан|pakistan",
    cities: ["islamabad", "karachi", "lahore"],
  },
  {
    code: "af",
    query: "Afghanistan",
    names: { tg: "Афғонистон", ru: "Афганистан", en: "Afghanistan" },
    pattern: "афғонистон|афгонистон|афганистан|afghanistan",
    cities: ["kabul", "mazar", "herat"],
  },
  {
    code: "tj",
    query: "Tajikistan",
    names: { tg: "Тоҷикистон", ru: "Таджикистан", en: "Tajikistan" },
    pattern: "тоҷикистон|точикистон|таджикистан|tajikistan",
    cities: ["dushanbe", "khujand", "bokhtar", "kulob"],
  },
  {
    code: "uz",
    query: "Uzbekistan",
    names: { tg: "Ӯзбекистон", ru: "Узбекистан", en: "Uzbekistan" },
    pattern: "ӯзбекистон|узбекистон|узбекистан|uzbekistan",
    cities: ["tashkent", "samarkand", "bukhara"],
  },
  {
    code: "kz",
    query: "Kazakhstan",
    names: { tg: "Қазоқистон", ru: "Казахстан", en: "Kazakhstan" },
    pattern: "қазоқистон|казокистон|казахстан|kazakhstan",
    cities: ["almaty", "astana"],
  },
  {
    code: "kg",
    query: "Kyrgyzstan",
    names: { tg: "Қирғизистон", ru: "Кыргызстан", en: "Kyrgyzstan" },
    pattern: "қирғизистон|киргизистон|кыргызстан|киргизи|kyrgyzstan",
    cities: ["bishkek"],
  },
  {
    code: "tm",
    query: "Turkmenistan",
    names: { tg: "Туркманистон", ru: "Туркменистан", en: "Turkmenistan" },
    pattern: "туркманистон|туркменистан|turkmenistan",
    cities: ["ashgabat"],
  },
  {
    code: "ir",
    query: "Iran",
    names: { tg: "Эрон", ru: "Иран", en: "Iran" },
    pattern: `эрон${E}|иран(?:е|а)?${E}|iran${E}`,
    cities: ["tehran", "mashhad", "isfahan"],
  },
  {
    code: "eg",
    query: "Egypt",
    names: { tg: "Миср", ru: "Египет", en: "Egypt" },
    pattern: "миср|египет|египт|egypt",
    cities: ["cairo"],
  },
  {
    code: "qa",
    query: "Qatar",
    names: { tg: "Қатар", ru: "Катар", en: "Qatar" },
    pattern: `қатар${E}|катар(?:е)?${E}|qatar`,
    cities: ["doha"],
  },
  {
    code: "nl",
    query: "Netherlands",
    names: { tg: "Нидерландия", ru: "Нидерланды", en: "Netherlands" },
    pattern: "нидерланд|голланди|holland|netherlands",
    cities: ["amsterdam"],
  },
  {
    code: "ch",
    query: "Switzerland",
    names: { tg: "Швейтсария", ru: "Швейцария", en: "Switzerland" },
    pattern: "швейтсари|швейцари|switzerland",
    cities: ["zurich", "geneva"],
  },
  {
    code: "at",
    query: "Austria",
    names: { tg: "Австрия", ru: "Австрия", en: "Austria" },
    pattern: `австри(?:я|и|ю)${E}|austria`,
    cities: ["vienna"],
  },
  {
    code: "au",
    query: "Australia",
    names: { tg: "Австралия", ru: "Австралия", en: "Australia" },
    pattern: "австрали|australia",
    cities: ["sydney", "melbourne"],
  },
  {
    code: "pl",
    query: "Poland",
    names: { tg: "Лаҳистон", ru: "Польша", en: "Poland" },
    pattern: "лаҳистон|лахистон|польш|poland",
    cities: ["warsaw"],
  },
  {
    code: "ua",
    query: "Ukraine",
    names: { tg: "Украина", ru: "Украина", en: "Ukraine" },
    pattern: `украин(?:а|е|у|ы)${E}|ukraine`,
    cities: ["kyiv"],
  },
  {
    code: "by",
    query: "Belarus",
    names: { tg: "Беларус", ru: "Беларусь", en: "Belarus" },
    pattern: "беларус|белорусси|belarus",
    cities: ["minsk"],
  },
  {
    code: "az",
    query: "Azerbaijan",
    names: { tg: "Озарбойҷон", ru: "Азербайджан", en: "Azerbaijan" },
    pattern: "озарбойҷон|озарбойчон|азербайджан|azerbaijan",
    cities: ["baku"],
  },
  {
    code: "ge",
    query: "Georgia",
    names: { tg: "Гурҷистон", ru: "Грузия", en: "Georgia" },
    pattern: `гурҷистон|гурчистон|грузи(?:я|и|ю)${E}`,
    cities: ["tbilisi"],
  },
  {
    code: "am",
    query: "Armenia",
    names: { tg: "Арманистон", ru: "Армения", en: "Armenia" },
    pattern: `арманистон|армени(?:я|и|ю)${E}|armenia`,
    cities: ["yerevan"],
  },
  {
    code: "iq",
    query: "Iraq",
    names: { tg: "Ироқ", ru: "Ирак", en: "Iraq" },
    pattern: `ироқ${E}|ирак(?:е)?${E}|iraq`,
    cities: [],
  },
  {
    code: "id",
    query: "Indonesia",
    names: { tg: "Индонезия", ru: "Индонезия", en: "Indonesia" },
    pattern: "индонези|indonesia",
    cities: ["jakarta"],
  },
  {
    code: "my",
    query: "Malaysia",
    names: { tg: "Малайзия", ru: "Малайзия", en: "Malaysia" },
    pattern: "малайзи|malaysia",
    cities: ["kuala_lumpur"],
  },
  {
    code: "th",
    query: "Thailand",
    names: { tg: "Таиланд", ru: "Таиланд", en: "Thailand" },
    pattern: "таиланд|thailand",
    cities: ["bangkok"],
  },
  {
    code: "br",
    query: "Brazil",
    names: { tg: "Бразилия", ru: "Бразилия", en: "Brazil" },
    pattern: "бразили|brazil",
    cities: ["rio", "sao_paulo"],
  },
  {
    code: "mx",
    query: "Mexico",
    names: { tg: "Мексика", ru: "Мексика", en: "Mexico" },
    pattern: `мексик|mexico${E}`,
    cities: ["mexico_city"],
  },
  {
    code: "pt",
    query: "Portugal",
    names: { tg: "Португалия", ru: "Португалия", en: "Portugal" },
    pattern: "португали|portugal",
    cities: ["lisbon"],
  },
  {
    code: "gr",
    query: "Greece",
    names: { tg: "Юнон", ru: "Греция", en: "Greece" },
    pattern: `юнон${E}|греци|greece`,
    cities: ["athens"],
  },
  {
    code: "cz",
    query: "Czechia",
    names: { tg: "Чехия", ru: "Чехия", en: "Czechia" },
    pattern: `чехи(?:я|и|ю)${E}|czech`,
    cities: ["prague"],
  },
];

export const WORLD_CITIES: WorldCity[] = [
  // United Kingdom
  { id: "london", country: "gb", query: "London", names: { tg: "Лондон", ru: "Лондон", en: "London" }, pattern: "лондон|london" },
  { id: "manchester", country: "gb", query: "Manchester", names: { tg: "Манчестер", ru: "Манчестер", en: "Manchester" }, pattern: "манчестер|manchester" },
  { id: "birmingham", country: "gb", query: "Birmingham", names: { tg: "Бирмингем", ru: "Бирмингем", en: "Birmingham" }, pattern: "бирмингем|birmingham" },
  { id: "edinburgh", country: "gb", query: "Edinburgh", names: { tg: "Эдинбург", ru: "Эдинбург", en: "Edinburgh" }, pattern: "эдинбург|edinburgh" },
  // USA
  { id: "new_york", country: "us", query: "New York City", names: { tg: "Ню-Йорк", ru: "Нью-Йорк", en: "New York" }, pattern: "нью[-\\s]?йорк|ню[-\\s]?йорк|new\\s*york|nyc" },
  { id: "los_angeles", country: "us", query: "Los Angeles", names: { tg: "Лос-Анҷелес", ru: "Лос-Анджелес", en: "Los Angeles" }, pattern: "лос[-\\s]?анҷелес|лос[-\\s]?анджелес|los\\s+angeles" },
  { id: "chicago", country: "us", query: "Chicago", names: { tg: "Чикаго", ru: "Чикаго", en: "Chicago" }, pattern: "чикаго|chicago" },
  { id: "washington", country: "us", query: "Washington, D.C.", names: { tg: "Вашингтон", ru: "Вашингтон", en: "Washington" }, pattern: "вашингтон|washington" },
  { id: "san_francisco", country: "us", query: "San Francisco", names: { tg: "Сан-Франсиско", ru: "Сан-Франциско", en: "San Francisco" }, pattern: "сан[-\\s]?франсиско|сан[-\\s]?франциско|san\\s+francisco" },
  { id: "miami", country: "us", query: "Miami", names: { tg: "Майами", ru: "Майами", en: "Miami" }, pattern: "майами|miami" },
  { id: "las_vegas", country: "us", query: "Las Vegas", names: { tg: "Лас-Вегас", ru: "Лас-Вегас", en: "Las Vegas" }, pattern: "лас[-\\s]?вегас|las\\s+vegas" },
  // Canada
  { id: "toronto", country: "ca", query: "Toronto", names: { tg: "Торонто", ru: "Торонто", en: "Toronto" }, pattern: "торонто|toronto" },
  { id: "vancouver", country: "ca", query: "Vancouver", names: { tg: "Ванкувер", ru: "Ванкувер", en: "Vancouver" }, pattern: "ванкувер|vancouver" },
  { id: "montreal", country: "ca", query: "Montreal", names: { tg: "Монреал", ru: "Монреаль", en: "Montreal" }, pattern: "монреал|montreal" },
  // France
  { id: "paris", country: "fr", query: "Paris", names: { tg: "Париж", ru: "Париж", en: "Paris" }, pattern: "париж|paris" },
  { id: "marseille", country: "fr", query: "Marseille", names: { tg: "Марсел", ru: "Марсель", en: "Marseille" }, pattern: "марсел|marseille" },
  { id: "lyon", country: "fr", query: "Lyon", names: { tg: "Лион", ru: "Лион", en: "Lyon" }, pattern: `лион(?:е|а)?${E}|lyon` },
  // Germany
  { id: "berlin", country: "de", query: "Berlin", names: { tg: "Берлин", ru: "Берлин", en: "Berlin" }, pattern: "берлин|berlin" },
  { id: "munich", country: "de", query: "Munich", names: { tg: "Мюнхен", ru: "Мюнхен", en: "Munich" }, pattern: "мюнхен|munich|münchen" },
  { id: "hamburg", country: "de", query: "Hamburg", names: { tg: "Гамбург", ru: "Гамбург", en: "Hamburg" }, pattern: "гамбург|hamburg" },
  { id: "frankfurt", country: "de", query: "Frankfurt am Main", names: { tg: "Франкфурт", ru: "Франкфурт", en: "Frankfurt" }, pattern: "франкфурт|frankfurt" },
  // Italy / Spain
  { id: "rome", country: "it", query: "Rome", names: { tg: "Рим", ru: "Рим", en: "Rome" }, pattern: `рим(?:е|а)?${E}|rome${E}|roma${E}` },
  { id: "milan", country: "it", query: "Milan", names: { tg: "Милан", ru: "Милан", en: "Milan" }, pattern: `милан(?:е|а)?${E}|milan${E}` },
  { id: "venice", country: "it", query: "Venice", names: { tg: "Венетсия", ru: "Венеция", en: "Venice" }, pattern: "венетси|венеци|venice" },
  { id: "madrid", country: "es", query: "Madrid", names: { tg: "Мадрид", ru: "Мадрид", en: "Madrid" }, pattern: "мадрид|madrid" },
  { id: "barcelona", country: "es", query: "Barcelona", names: { tg: "Барселона", ru: "Барселона", en: "Barcelona" }, pattern: "барселон|barcelona" },
  // Gulf
  { id: "dubai", country: "ae", query: "Dubai", names: { tg: "Дубай", ru: "Дубай", en: "Dubai" }, pattern: "дуба(?:й|е|я|ю)|dubai" },
  { id: "abu_dhabi", country: "ae", query: "Abu Dhabi", names: { tg: "Абу-Дабӣ", ru: "Абу-Даби", en: "Abu Dhabi" }, pattern: "абу[-\\s]?даб(?:ӣ|и)|abu\\s+dhabi" },
  { id: "mecca", country: "sa", query: "Mecca", names: { tg: "Макка", ru: "Мекка", en: "Mecca" }, pattern: "макка|мекк|makkah|mecca" },
  { id: "medina", country: "sa", query: "Medina", names: { tg: "Мадина", ru: "Медина", en: "Medina" }, pattern: `мадина${E}|медин(?:а|е|у|ы)${E}|madinah|medina` },
  { id: "riyadh", country: "sa", query: "Riyadh", names: { tg: "Риёз", ru: "Эр-Рияд", en: "Riyadh" }, pattern: "риёз|рияд|riyadh" },
  { id: "jeddah", country: "sa", query: "Jeddah", names: { tg: "Ҷидда", ru: "Джидда", en: "Jeddah" }, pattern: "ҷидда|чидда|джидд|jeddah|jidda" },
  { id: "doha", country: "qa", query: "Doha", names: { tg: "Доҳа", ru: "Доха", en: "Doha" }, pattern: `доҳа${E}|доха${E}|doha` },
  // Turkey
  { id: "istanbul", country: "tr", query: "Istanbul", names: { tg: "Истанбул", ru: "Стамбул", en: "Istanbul" }, pattern: "истанбул|стамбул|istanbul" },
  { id: "ankara", country: "tr", query: "Ankara", names: { tg: "Анкара", ru: "Анкара", en: "Ankara" }, pattern: "анкар|ankara" },
  { id: "antalya", country: "tr", query: "Antalya", names: { tg: "Анталия", ru: "Анталья", en: "Antalya" }, pattern: "анталия|анталь|antalya" },
  // Russia
  { id: "moscow", country: "ru", query: "Moscow", names: { tg: "Маскав", ru: "Москва", en: "Moscow" }, pattern: `маскав|москв(?:а|е|у|ы|ой)${E}|moscow` },
  { id: "saint_petersburg", country: "ru", query: "Saint Petersburg", names: { tg: "Санкт-Петербург", ru: "Санкт-Петербург", en: "Saint Petersburg" }, pattern: `санкт[-\\s]?петербург|петербург|питер${E}|saint\\s+petersburg|st\\.?\\s*petersburg` },
  { id: "kazan", country: "ru", query: "Kazan", names: { tg: "Қазон", ru: "Казань", en: "Kazan" }, pattern: "қазон|казань|казани|kazan" },
  { id: "novosibirsk", country: "ru", query: "Novosibirsk", names: { tg: "Новосибирск", ru: "Новосибирск", en: "Novosibirsk" }, pattern: "новосибирск|novosibirsk" },
  // China / Japan / Korea
  { id: "beijing", country: "cn", query: "Beijing", names: { tg: "Пекин", ru: "Пекин", en: "Beijing" }, pattern: "пекин|beijing" },
  { id: "shanghai", country: "cn", query: "Shanghai", names: { tg: "Шанхай", ru: "Шанхай", en: "Shanghai" }, pattern: "шанха|shanghai" },
  { id: "guangzhou", country: "cn", query: "Guangzhou", names: { tg: "Гуанчжоу", ru: "Гуанчжоу", en: "Guangzhou" }, pattern: "гуанчжоу|guangzhou" },
  { id: "urumqi", country: "cn", query: "Urumqi", names: { tg: "Урумчи", ru: "Урумчи", en: "Urumqi" }, pattern: "урумчи|urumqi" },
  { id: "hong_kong", country: "hk", query: "Hong Kong", names: { tg: "Гонконг", ru: "Гонконг", en: "Hong Kong" }, pattern: "гонконг|hong\\s*kong" },
  { id: "tokyo", country: "jp", query: "Tokyo", names: { tg: "Токио", ru: "Токио", en: "Tokyo" }, pattern: "токио|tokyo" },
  { id: "osaka", country: "jp", query: "Osaka", names: { tg: "Осака", ru: "Осака", en: "Osaka" }, pattern: "осак|osaka" },
  { id: "kyoto", country: "jp", query: "Kyoto", names: { tg: "Киото", ru: "Киото", en: "Kyoto" }, pattern: "киото|kyoto" },
  { id: "seoul", country: "kr", query: "Seoul", names: { tg: "Сеул", ru: "Сеул", en: "Seoul" }, pattern: "сеул|seoul" },
  { id: "busan", country: "kr", query: "Busan", names: { tg: "Пусан", ru: "Пусан", en: "Busan" }, pattern: "пусан|busan" },
  // South Asia
  { id: "delhi", country: "in", query: "New Delhi", names: { tg: "Деҳлӣ", ru: "Дели", en: "Delhi" }, pattern: `деҳлӣ|дехли|дели${E}|delhi` },
  { id: "mumbai", country: "in", query: "Mumbai", names: { tg: "Мумбай", ru: "Мумбаи", en: "Mumbai" }, pattern: "мумба|mumbai" },
  { id: "islamabad", country: "pk", query: "Islamabad", names: { tg: "Исломобод", ru: "Исламабад", en: "Islamabad" }, pattern: "исломобод|исламабад|islamabad" },
  { id: "karachi", country: "pk", query: "Karachi", names: { tg: "Карочӣ", ru: "Карачи", en: "Karachi" }, pattern: "кароч|карачи|karachi" },
  { id: "lahore", country: "pk", query: "Lahore", names: { tg: "Лоҳур", ru: "Лахор", en: "Lahore" }, pattern: "лоҳур|лохур|лахор|lahore" },
  { id: "kabul", country: "af", query: "Kabul", names: { tg: "Кобул", ru: "Кабул", en: "Kabul" }, pattern: "кобул|кабул|kabul" },
  { id: "mazar", country: "af", query: "Mazar-i-Sharif", names: { tg: "Мазори Шариф", ru: "Мазари-Шариф", en: "Mazar-i-Sharif" }, pattern: "мазори\\s+шариф|мазари[-\\s]?шариф|mazar" },
  { id: "herat", country: "af", query: "Herat", names: { tg: "Ҳирот", ru: "Герат", en: "Herat" }, pattern: "ҳирот|хирот|герат|herat" },
  // Central Asia & neighbours
  { id: "dushanbe", country: "tj", query: "Dushanbe", names: { tg: "Душанбе", ru: "Душанбе", en: "Dushanbe" }, pattern: "душанбе|dushanbe" },
  { id: "khujand", country: "tj", query: "Khujand", names: { tg: "Хуҷанд", ru: "Худжанд", en: "Khujand" }, pattern: "хуҷанд|худжанд|хучанд|khujand" },
  { id: "bokhtar", country: "tj", query: "Bokhtar", names: { tg: "Бохтар", ru: "Бохтар", en: "Bokhtar" }, pattern: "бохтар|bokhtar" },
  { id: "kulob", country: "tj", query: "Kulob", names: { tg: "Кӯлоб", ru: "Куляб", en: "Kulob" }, pattern: "кӯлоб|кулоб|куляб|kulob" },
  { id: "tashkent", country: "uz", query: "Tashkent", names: { tg: "Тошкент", ru: "Ташкент", en: "Tashkent" }, pattern: "тошкент|ташкент|tashkent" },
  { id: "samarkand", country: "uz", query: "Samarkand", names: { tg: "Самарқанд", ru: "Самарканд", en: "Samarkand" }, pattern: "самарқанд|самарканд|samarkand|samarqand" },
  { id: "bukhara", country: "uz", query: "Bukhara", names: { tg: "Бухоро", ru: "Бухара", en: "Bukhara" }, pattern: "бухоро|бухар|bukhara" },
  { id: "almaty", country: "kz", query: "Almaty", names: { tg: "Алмаато", ru: "Алматы", en: "Almaty" }, pattern: "алмаато|алматы|алма-ат|almaty" },
  { id: "astana", country: "kz", query: "Astana", names: { tg: "Остона", ru: "Астана", en: "Astana" }, pattern: "остона|астан|astana" },
  { id: "bishkek", country: "kg", query: "Bishkek", names: { tg: "Бишкек", ru: "Бишкек", en: "Bishkek" }, pattern: "бишкек|bishkek" },
  { id: "ashgabat", country: "tm", query: "Ashgabat", names: { tg: "Ашқобод", ru: "Ашхабад", en: "Ashgabat" }, pattern: "ашқобод|ашкобод|ашхабад|ашгабат|ashgabat" },
  { id: "tehran", country: "ir", query: "Tehran", names: { tg: "Теҳрон", ru: "Тегеран", en: "Tehran" }, pattern: "теҳрон|техрон|тегеран|tehran" },
  { id: "mashhad", country: "ir", query: "Mashhad", names: { tg: "Машҳад", ru: "Мешхед", en: "Mashhad" }, pattern: "машҳад|машхад|мешхед|mashhad" },
  { id: "isfahan", country: "ir", query: "Isfahan", names: { tg: "Исфаҳон", ru: "Исфахан", en: "Isfahan" }, pattern: "исфаҳон|исфахон|исфахан|isfahan" },
  { id: "baku", country: "az", query: "Baku", names: { tg: "Боку", ru: "Баку", en: "Baku" }, pattern: `боку${E}|баку${E}|baku` },
  { id: "tbilisi", country: "ge", query: "Tbilisi", names: { tg: "Тбилиси", ru: "Тбилиси", en: "Tbilisi" }, pattern: "тбилиси|tbilisi" },
  { id: "yerevan", country: "am", query: "Yerevan", names: { tg: "Ереван", ru: "Ереван", en: "Yerevan" }, pattern: "ереван|yerevan" },
  // Europe
  { id: "amsterdam", country: "nl", query: "Amsterdam", names: { tg: "Амстердам", ru: "Амстердам", en: "Amsterdam" }, pattern: "амстердам|amsterdam" },
  { id: "zurich", country: "ch", query: "Zurich", names: { tg: "Сюрих", ru: "Цюрих", en: "Zurich" }, pattern: "сюрих|цюрих|zurich|zürich" },
  { id: "geneva", country: "ch", query: "Geneva", names: { tg: "Женева", ru: "Женева", en: "Geneva" }, pattern: "женев|geneva" },
  { id: "vienna", country: "at", query: "Vienna", names: { tg: "Вена", ru: "Вена", en: "Vienna" }, pattern: `вен(?:а|е|у|ы)${E}|vienna|wien` },
  { id: "warsaw", country: "pl", query: "Warsaw", names: { tg: "Варшава", ru: "Варшава", en: "Warsaw" }, pattern: "варшав|warsaw" },
  { id: "kyiv", country: "ua", query: "Kyiv", names: { tg: "Киев", ru: "Киев", en: "Kyiv" }, pattern: "киев|кийив|kyiv|kiev" },
  { id: "minsk", country: "by", query: "Minsk", names: { tg: "Минск", ru: "Минск", en: "Minsk" }, pattern: "минск|minsk" },
  { id: "lisbon", country: "pt", query: "Lisbon", names: { tg: "Лиссабон", ru: "Лиссабон", en: "Lisbon" }, pattern: "лиссабон|lisbon" },
  { id: "athens", country: "gr", query: "Athens", names: { tg: "Афина", ru: "Афины", en: "Athens" }, pattern: "афин|athens" },
  { id: "prague", country: "cz", query: "Prague", names: { tg: "Прага", ru: "Прага", en: "Prague" }, pattern: `праг(?:а|е|и|у)${E}|prague` },
  // Elsewhere
  { id: "cairo", country: "eg", query: "Cairo", names: { tg: "Қоҳира", ru: "Каир", en: "Cairo" }, pattern: "қоҳира|кохира|каир|cairo" },
  { id: "sydney", country: "au", query: "Sydney", names: { tg: "Сидней", ru: "Сидней", en: "Sydney" }, pattern: "сидне|sydney" },
  { id: "melbourne", country: "au", query: "Melbourne", names: { tg: "Мелбурн", ru: "Мельбурн", en: "Melbourne" }, pattern: "мелбурн|мельбурн|melbourne" },
  { id: "jakarta", country: "id", query: "Jakarta", names: { tg: "Ҷакарта", ru: "Джакарта", en: "Jakarta" }, pattern: "ҷакарта|джакарт|jakarta" },
  { id: "kuala_lumpur", country: "my", query: "Kuala Lumpur", names: { tg: "Куала-Лумпур", ru: "Куала-Лумпур", en: "Kuala Lumpur" }, pattern: "куала[-\\s]?лумпур|kuala\\s+lumpur" },
  { id: "bangkok", country: "th", query: "Bangkok", names: { tg: "Бангкок", ru: "Бангкок", en: "Bangkok" }, pattern: "бангкок|bangkok" },
  { id: "singapore", country: "sg", query: "Singapore", names: { tg: "Сингапур", ru: "Сингапур", en: "Singapore" }, pattern: "сингапур|singapore" },
  { id: "rio", country: "br", query: "Rio de Janeiro", names: { tg: "Рио-де-Жанейро", ru: "Рио-де-Жанейро", en: "Rio de Janeiro" }, pattern: "рио[-\\s]?де[-\\s]?жанейро|rio\\s+de\\s+janeiro" },
  { id: "sao_paulo", country: "br", query: "São Paulo", names: { tg: "Сан-Паулу", ru: "Сан-Паулу", en: "São Paulo" }, pattern: "сан[-\\s]?паулу|s[aã]o\\s+paulo" },
  { id: "mexico_city", country: "mx", query: "Mexico City", names: { tg: "Мехико", ru: "Мехико", en: "Mexico City" }, pattern: "мехико|mexico\\s+city" },
];

export type MapScope = {
  kind: "country" | "city" | "auto";
  /** Geocoder query (English when known from the gazetteer). */
  query: string;
  countryCode?: string;
  /** As the user wrote it — reused in replies ("дар Лондон", "в Германии"). */
  label: string;
  /** Gazetteer names (absent for "auto" scopes). */
  names?: PlaceNames;
};

type Entry = { re: RegExp; pattern: string };

function compile(pattern: string): Entry {
  return { re: wordRe(pattern), pattern };
}

const CITY_ENTRIES = WORLD_CITIES.map((c) => ({ city: c, ...compile(c.pattern) }));
const TJ_ENTRIES = TJ_CITIES.map((c) => ({ city: c, ...compile(c.pattern) }));
const COUNTRY_ENTRIES = WORLD_COUNTRIES.map((c) => ({ country: c, ...compile(c.pattern) }));
const COUNTRY_BY_CODE = new Map(WORLD_COUNTRIES.map((c) => [c.code, c]));
const CITY_BY_ID = new Map(WORLD_CITIES.map((c) => [c.id, c]));

function firstMatch<T extends Entry>(entries: T[], text: string): { entry: T; index: number; text: string } | null {
  let best: { entry: T; index: number; text: string } | null = null;
  for (const entry of entries) {
    const m = entry.re.exec(text);
    if (m && (!best || m.index < best.index)) best = { entry, index: m.index, text: m[0] };
  }
  return best;
}

/** Word right after "дар / в / in" that looks like a proper place name. */
const UNKNOWN_SCOPE_RE =
  /(?<![\p{L}])(?:дар|в|во|in)\s+(\p{Lu}[\p{L}'’]{2,}(?:[-\s]\p{Lu}[\p{L}'’]+)?)/u;

export type ScopeMatch = {
  scope: MapScope;
  /** The text with the scope phrase (and its preposition) removed. */
  rest: string;
};

/** The matched place name as typed, completed to the end of the word ("Лондоне", "New York"). */
function labelOf(text: string, index: number, matched: string): string {
  const tail = /^[\p{L}]*/u.exec(text.slice(index + matched.length))?.[0] ?? "";
  const name = text.slice(index, index + matched.length) + tail;
  return name ? name[0]!.toUpperCase() + name.slice(1) : name;
}

/** Removes the place name (whole inflected word) together with its preposition. */
function strip(text: string, patterns: string[]): string {
  let out = text;
  for (const p of patterns) {
    out = out.replace(
      new RegExp(`(?<![\\p{L}])(?:(?:дар|в|во|in)\\s+)?(?:${p})[\\p{L}]*(?:[-‐]и(?![\\p{L}]))?`, "giu"),
      " ",
    );
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Finds a city or country the user scoped the request to.
 * A city wins over a country ("Лондон, Англия" → London, gb).
 * `isReserved` rejects unknown words that are actually map vocabulary.
 */
export function findScope(text: string, isReserved: (word: string) => boolean = () => false): ScopeMatch | null {
  const city = firstMatch(CITY_ENTRIES, text);
  const tjCity = city ? null : firstMatch(TJ_ENTRIES, text);
  const country = firstMatch(COUNTRY_ENTRIES, text);

  if (city) {
    const c = city.entry.city;
    const patterns = [city.entry.pattern, ...(country ? [country.entry.pattern] : [])];
    return {
      scope: { kind: "city", query: c.query, countryCode: c.country, label: labelOf(text, city.index, city.text), names: c.names },
      rest: strip(text, patterns),
    };
  }
  if (tjCity) {
    const c = tjCity.entry.city;
    return {
      scope: { kind: "city", query: c.query, countryCode: "tj", label: labelOf(text, tjCity.index, tjCity.text) },
      rest: strip(text, [tjCity.entry.pattern]),
    };
  }
  if (country) {
    const c = country.entry.country;
    return {
      scope: { kind: "country", query: c.query, countryCode: c.code, label: labelOf(text, country.index, country.text), names: c.names },
      rest: strip(text, [country.entry.pattern]),
    };
  }

  const m = UNKNOWN_SCOPE_RE.exec(text);
  if (m?.[1] && !isReserved(m[1])) {
    const word = m[1];
    return {
      scope: { kind: "auto", query: word, label: word },
      rest: text.replace(m[0], " ").replace(/\s+/g, " ").trim(),
    };
  }
  return null;
}

export function countryByCode(code: string | undefined): WorldCountry | undefined {
  return code ? COUNTRY_BY_CODE.get(code.toLowerCase()) : undefined;
}

export function localName(names: PlaceNames | undefined, fallback: string, locale: string): string {
  if (!names) return fallback;
  const l = locale.split("-")[0]?.toLowerCase();
  return l === "ru" ? names.ru : l === "en" ? names.en : names.tg;
}

/**
 * Well-known city named in a provider address of that country. The right-most
 * match wins: addresses run street → city ("London Road, …, Manchester").
 */
export function knownCityIn(address: string | undefined, countryCode: string): WorldCity | undefined {
  if (!address) return undefined;
  const code = countryCode.toLowerCase();
  let best: { city: WorldCity; index: number } | undefined;
  for (const entry of CITY_ENTRIES) {
    if (entry.city.country !== code) continue;
    for (const m of address.matchAll(new RegExp(entry.re.source, "giu"))) {
      if (!best || m.index > best.index) best = { city: entry.city, index: m.index };
    }
  }
  return best?.city;
}

/** Suggested cities for a country-only request, in the reply language. */
export function suggestedCities(countryCode: string | undefined, locale: string): { id: string; name: string }[] {
  const country = countryByCode(countryCode);
  if (!country) return [];
  return country.cities
    .map((id) => CITY_BY_ID.get(id))
    .filter((c): c is WorldCity => Boolean(c))
    .map((c) => ({ id: c.id, name: localName(c.names, c.query, locale) }));
}
