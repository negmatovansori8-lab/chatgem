/**
 * Tajikistan cities/towns with TG / RU / EN spellings (incl. no-diacritic
 * variants typed on Russian keyboards or produced by speech-to-text).
 */
export type TjCity = { id: string; query: string; pattern: string };

export const TJ_CITIES: TjCity[] = [
  { id: "dushanbe", query: "Dushanbe, Tajikistan", pattern: "душанбе|dushanbe" },
  { id: "khujand", query: "Khujand, Tajikistan", pattern: "хуҷанд|худжанд|хучанд|хужанд|khujand|khudzhand" },
  { id: "vahdat", query: "Vahdat, Tajikistan", pattern: "ваҳдат|вахдат|vahdat" },
  { id: "hisor", query: "Hisor, Tajikistan", pattern: "ҳисор|хисор|гиссар|hisor|hissar|gissar" },
  { id: "tursunzoda", query: "Tursunzoda, Tajikistan", pattern: "турсунзода|турсунзаде|tursunzoda|tursunzade" },
  { id: "bokhtar", query: "Bokhtar, Tajikistan", pattern: "бохтар|bokhtar|bohtar|курган-?тюбе|қӯрғонтеппа|кургонтеппа" },
  { id: "kulob", query: "Kulob, Tajikistan", pattern: "кӯлоб|кулоб|куляб|kulob|kulyab" },
  { id: "istaravshan", query: "Istaravshan, Tajikistan", pattern: "истаравшан|istaravshan|ура-?тюбе" },
  { id: "panjakent", query: "Panjakent, Tajikistan", pattern: "панҷакент|панчакент|пенджикент|panjakent|penjikent" },
  { id: "rasht", query: "Rasht, Tajikistan", pattern: "рашт|rasht|гарм(?![а-яё])" },
  { id: "khorugh", query: "Khorugh, Tajikistan", pattern: "хоруғ|хоруг|хорог|khorugh|khorog" },
  { id: "isfara", query: "Isfara, Tajikistan", pattern: "исфара|isfara" },
  { id: "konibodom", query: "Konibodom, Tajikistan", pattern: "конибодом|канибадам|konibodom|kanibadam" },
  { id: "guliston", query: "Guliston, Sughd, Tajikistan", pattern: "гулистон|кайраккум|guliston|kayrakkum" },
  { id: "buston", query: "Buston, Tajikistan", pattern: "бӯстон|бустон|чкаловск|buston" },
  { id: "nurek", query: "Norak, Tajikistan", pattern: "норак|нурек|norak|nurek" },
  { id: "danghara", query: "Danghara, Tajikistan", pattern: "данғара|дангара|danghara|dangara" },
  { id: "yovon", query: "Yovon, Tajikistan", pattern: "ёвон|яван|yovon|yavan" },
  { id: "vakhsh", query: "Vakhsh, Tajikistan", pattern: "вахш|vakhsh" },
  { id: "shahrinav", query: "Shahrinav, Tajikistan", pattern: "шаҳринав|шахринав|shahrinav" },
  { id: "rudaki", query: "Rudaki District, Tajikistan", pattern: "рӯдакӣ|рудаки|rudaki" },
  { id: "murghob", query: "Murghob, Tajikistan", pattern: "мурғоб|мургоб|мургаб|murghob|murgab" },
];

const L = "\\p{L}";

export function wordRe(pattern: string): RegExp {
  return new RegExp(`(?<![${L}])(?:${pattern})`, "iu");
}
