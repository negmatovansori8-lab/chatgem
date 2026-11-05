/**
 * «Пойтахти чопон чист» is a geography question. The chat model was reading
 * «чопон» as a printer part and drawing a picture instead of naming the city.
 */

type Capital = {
  re: RegExp;
  city: string;
  tg: string;
  ru: string;
  en: string;
};

const CAPITALS: Capital[] = [
  { re: /ҷопон|чопон|япони|япония|(?<![\p{L}])japan(?![\p{L}])/iu, city: "Токио", tg: "Ҷопон", ru: "Японии", en: "Japan" },
  { re: /тоҷикистон|точикистон|таджикистан|tajikistan/iu, city: "Душанбе", tg: "Тоҷикистон", ru: "Таджикистана", en: "Tajikistan" },
  { re: /россия|русия|(?<![\p{L}])russia(?![\p{L}])/iu, city: "Маскав", tg: "Русия", ru: "России", en: "Russia" },
  { re: /амрико|америка|иёлоти\s+муттаҳида|(?<![\p{L}])usa(?![\p{L}])|united\s+states/iu, city: "Вашингтон", tg: "ИМА", ru: "США", en: "the United States" },
  { re: /хитой|китай|(?<![\p{L}])china(?![\p{L}])/iu, city: "Пекин", tg: "Хитой", ru: "Китая", en: "China" },
  { re: /фаронса|франция|(?<![\p{L}])france(?![\p{L}])/iu, city: "Париж", tg: "Фаронса", ru: "Франции", en: "France" },
  { re: /олмон|германия|(?<![\p{L}])germany(?![\p{L}])/iu, city: "Берлин", tg: "Олмон", ru: "Германии", en: "Germany" },
  { re: /англис|британи|(?<![\p{L}])uk(?![\p{L}])|united\s+kingdom|(?<![\p{L}])england(?![\p{L}])/iu, city: "Лондон", tg: "Британияи Кабир", ru: "Великобритании", en: "the United Kingdom" },
  { re: /ҳиндустон|хиндустон|индия|(?<![\p{L}])india(?![\p{L}])/iu, city: "Деҳлии Нав", tg: "Ҳиндустон", ru: "Индии", en: "India" },
  { re: /корея|(?<![\p{L}])korea(?![\p{L}])/iu, city: "Сеул", tg: "Кореяи Ҷанубӣ", ru: "Южной Кореи", en: "South Korea" },
  { re: /эрон|ирон|(?<![\p{L}])iran(?![\p{L}])/iu, city: "Теҳрон", tg: "Эрон", ru: "Ирана", en: "Iran" },
  { re: /узбекистон|узбекистан|uzbekistan/iu, city: "Тошканд", tg: "Ӯзбекистон", ru: "Узбекистана", en: "Uzbekistan" },
  { re: /қазоқистон|казахстан|kazakhstan/iu, city: "Остона", tg: "Қазоқистон", ru: "Казахстана", en: "Kazakhstan" },
  { re: /қирғизистон|кыргызстан|kyrgyzstan/iu, city: "Бишкек", tg: "Қирғизистон", ru: "Кыргызстана", en: "Kyrgyzstan" },
  { re: /афғонистон|афганистон|afghanistan/iu, city: "Кобул", tg: "Афғонистон", ru: "Афганистана", en: "Afghanistan" },
  { re: /туркия|турция|(?<![\p{L}])turkey(?![\p{L}])/iu, city: "Анкара", tg: "Туркия", ru: "Турции", en: "Turkey" },
  { re: /италия|(?<![\p{L}])italy(?![\p{L}])/iu, city: "Рим", tg: "Италия", ru: "Италии", en: "Italy" },
  { re: /испания|(?<![\p{L}])spain(?![\p{L}])/iu, city: "Мадрид", tg: "Испания", ru: "Испании", en: "Spain" },
];

const CAPITAL_Q = /пойтахт|столиц|(?<![\p{L}])capital(?![\p{L}])/iu;
const DRAW_NOW = /сурат\s*соз|тасвир\s*соз|акс\s*соз|нарисуй|логотип\s*соз/iu;

/** A direct sentence, or null when this is not a known capital question. */
export function capitalAnswer(text: string): string | null {
  const t = text.trim();
  if (!t || !CAPITAL_Q.test(t) || DRAW_NOW.test(t)) return null;
  const hit = CAPITALS.find((item) => item.re.test(t));
  if (!hit) return null;
  if (/(?<![\p{L}])(?:capital|what)(?![\p{L}])/iu.test(t)) {
    return `The capital of ${hit.en} is ${hit.city}.`;
  }
  if (/столиц/iu.test(t)) return `Столица ${hit.ru} — ${hit.city}.`;
  return `Пойтахти ${hit.tg} — ${hit.city}.`;
}
