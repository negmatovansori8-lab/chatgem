const fs = require("fs");
const path = require("path");

const rtl = new Set(["ar", "fa", "ur", "he", "ps", "sd", "yi", "dv", "ku", "ckb", "ug"]);

const langs = [
  ["aa", "Afar", "Afar"], ["ab", "Abkhazian", "Аҧсуа"], ["af", "Afrikaans", "Afrikaans"], ["ak", "Akan", "Akan"],
  ["am", "Amharic", "አማርኛ"], ["an", "Aragonese", "Aragonés"], ["ar", "Arabic", "العربية"], ["as", "Assamese", "অসমীয়া"],
  ["av", "Avaric", "Авар"], ["ay", "Aymara", "Aymar"], ["az", "Azerbaijani", "Azərbaycan"], ["ba", "Bashkir", "Башҡорт"],
  ["be", "Belarusian", "Беларуская"], ["bg", "Bulgarian", "Български"], ["bh", "Bihari", "भोजपुरी"], ["bi", "Bislama", "Bislama"],
  ["bm", "Bambara", "Bamanankan"], ["bn", "Bengali", "বাংলা"], ["bo", "Tibetan", "བོད་ཡིག"], ["br", "Breton", "Brezhoneg"],
  ["bs", "Bosnian", "Bosanski"], ["ca", "Catalan", "Català"], ["ce", "Chechen", "Нохчийн"], ["ch", "Chamorro", "Chamoru"],
  ["co", "Corsican", "Corsu"], ["cr", "Cree", "ᓀᐦᐃᔭᐍᐏᐣ"], ["cs", "Czech", "Čeština"], ["cu", "Church Slavic", "Словѣньскъ"],
  ["cv", "Chuvash", "Чӑваш"], ["cy", "Welsh", "Cymraeg"], ["da", "Danish", "Dansk"], ["de", "German", "Deutsch"],
  ["dv", "Divehi", "ދިވެހި"], ["dz", "Dzongkha", "རྫོང་ཁ"], ["ee", "Ewe", "Eʋegbe"], ["el", "Greek", "Ελληνικά"],
  ["en", "English", "English"], ["eo", "Esperanto", "Esperanto"], ["es", "Spanish", "Español"], ["et", "Estonian", "Eesti"],
  ["eu", "Basque", "Euskara"], ["fa", "Persian", "فارسی"], ["ff", "Fulah", "Fulfulde"], ["fi", "Finnish", "Suomi"],
  ["fj", "Fijian", "Na Vosa Vakaviti"], ["fo", "Faroese", "Føroyskt"], ["fr", "French", "Français"], ["fy", "Western Frisian", "Frysk"],
  ["ga", "Irish", "Gaeilge"], ["gd", "Scottish Gaelic", "Gàidhlig"], ["gl", "Galician", "Galego"], ["gn", "Guarani", "Avañeẽ"],
  ["gu", "Gujarati", "ગુજરાતી"], ["gv", "Manx", "Gaelg"], ["ha", "Hausa", "Hausa"], ["he", "Hebrew", "עברית"],
  ["hi", "Hindi", "हिन्दी"], ["ho", "Hiri Motu", "Hiri Motu"], ["hr", "Croatian", "Hrvatski"], ["ht", "Haitian Creole", "Kreyòl ayisyen"],
  ["hu", "Hungarian", "Magyar"], ["hy", "Armenian", "Հայերեն"], ["hz", "Herero", "Otjiherero"], ["ia", "Interlingua", "Interlingua"],
  ["id", "Indonesian", "Bahasa Indonesia"], ["ie", "Interlingue", "Interlingue"], ["ig", "Igbo", "Igbo"], ["ii", "Sichuan Yi", "ꆈꌠ꒿"],
  ["ik", "Inupiaq", "Iñupiaq"], ["io", "Ido", "Ido"], ["is", "Icelandic", "Íslenska"], ["it", "Italian", "Italiano"],
  ["iu", "Inuktitut", "ᐃᓄᒃᑎᑐᑦ"], ["ja", "Japanese", "日本語"], ["jv", "Javanese", "Basa Jawa"], ["ka", "Georgian", "ქართული"],
  ["kg", "Kongo", "Kikongo"], ["ki", "Kikuyu", "Gĩkũyũ"], ["kj", "Kuanyama", "Kuanyama"], ["kk", "Kazakh", "Қазақша"],
  ["kl", "Kalaallisut", "Kalaallisut"], ["km", "Khmer", "ខ្មែរ"], ["kn", "Kannada", "ಕನ್ನಡ"], ["ko", "Korean", "한국어"],
  ["kr", "Kanuri", "Kanuri"], ["ks", "Kashmiri", "کٲشُر"], ["ku", "Kurdish", "Kurdî"], ["kv", "Komi", "Коми"],
  ["kw", "Cornish", "Kernewek"], ["ky", "Kyrgyz", "Кыргызча"], ["la", "Latin", "Latina"], ["lb", "Luxembourgish", "Lëtzebuergesch"],
  ["lg", "Ganda", "Luganda"], ["li", "Limburgish", "Limburgs"], ["ln", "Lingala", "Lingála"], ["lo", "Lao", "ລາວ"],
  ["lt", "Lithuanian", "Lietuvių"], ["lu", "Luba-Katanga", "Tshiluba"], ["lv", "Latvian", "Latviešu"], ["mg", "Malagasy", "Malagasy"],
  ["mh", "Marshallese", "Kajin M̧ajeļ"], ["mi", "Maori", "Māori"], ["mk", "Macedonian", "Македонски"], ["ml", "Malayalam", "മലയാളം"],
  ["mn", "Mongolian", "Монгол"], ["mr", "Marathi", "मराठी"], ["ms", "Malay", "Bahasa Melayu"], ["mt", "Maltese", "Malti"],
  ["my", "Burmese", "မြန်မာ"], ["na", "Nauru", "Dorerin Naoero"], ["nb", "Norwegian Bokmål", "Norsk bokmål"], ["nd", "North Ndebele", "isiNdebele"],
  ["ne", "Nepali", "नेपाली"], ["ng", "Ndonga", "Owambo"], ["nl", "Dutch", "Nederlands"], ["nn", "Norwegian Nynorsk", "Norsk nynorsk"],
  ["no", "Norwegian", "Norsk"], ["nr", "South Ndebele", "isiNdebele"], ["nv", "Navajo", "Diné bizaad"], ["ny", "Chichewa", "Chichewa"],
  ["oc", "Occitan", "Occitan"], ["oj", "Ojibwa", "ᐊᓂᔑᓈᐯᒧᐎᓐ"], ["om", "Oromo", "Afaan Oromoo"], ["or", "Odia", "ଓଡ଼ିଆ"],
  ["os", "Ossetian", "Ирон"], ["pa", "Punjabi", "ਪੰਜਾਬੀ"], ["pi", "Pali", "पालि"], ["pl", "Polish", "Polski"],
  ["ps", "Pashto", "پښتو"], ["pt", "Portuguese", "Português"], ["qu", "Quechua", "Runa Simi"], ["rm", "Romansh", "Rumantsch"],
  ["rn", "Rundi", "Ikirundi"], ["ro", "Romanian", "Română"], ["ru", "Russian", "Русский"], ["rw", "Kinyarwanda", "Ikinyarwanda"],
  ["sa", "Sanskrit", "संस्कृतम्"], ["sc", "Sardinian", "Sardu"], ["sd", "Sindhi", "سنڌي"], ["se", "Northern Sami", "Davvisámegiella"],
  ["sg", "Sango", "Sängö"], ["si", "Sinhala", "සිංහල"], ["sk", "Slovak", "Slovenčina"], ["sl", "Slovenian", "Slovenščina"],
  ["sm", "Samoan", "Gagana Samoa"], ["sn", "Shona", "chiShona"], ["so", "Somali", "Soomaali"], ["sq", "Albanian", "Shqip"],
  ["sr", "Serbian", "Српски"], ["ss", "Swati", "SiSwati"], ["st", "Southern Sotho", "Sesotho"], ["su", "Sundanese", "Basa Sunda"],
  ["sv", "Swedish", "Svenska"], ["sw", "Swahili", "Kiswahili"], ["ta", "Tamil", "தமிழ்"], ["te", "Telugu", "తెలుగు"],
  ["tg", "Tajik", "Тоҷикӣ"], ["th", "Thai", "ไทย"], ["ti", "Tigrinya", "ትግርኛ"], ["tk", "Turkmen", "Türkmen"],
  ["tl", "Tagalog", "Tagalog"], ["tn", "Tswana", "Setswana"], ["to", "Tonga", "Lea faka-Tonga"], ["tr", "Turkish", "Türkçe"],
  ["ts", "Tsonga", "Xitsonga"], ["tt", "Tatar", "Татар"], ["tw", "Twi", "Twi"], ["ty", "Tahitian", "Reo Tahiti"],
  ["ug", "Uyghur", "ئۇيغۇرچە"], ["uk", "Ukrainian", "Українська"], ["ur", "Urdu", "اردو"], ["uz", "Uzbek", "Oʻzbek"],
  ["ve", "Venda", "Tshivenḓa"], ["vi", "Vietnamese", "Tiếng Việt"], ["vo", "Volapük", "Volapük"], ["wa", "Walloon", "Walon"],
  ["wo", "Wolof", "Wolof"], ["xh", "Xhosa", "isiXhosa"], ["yi", "Yiddish", "ייִדיש"], ["yo", "Yoruba", "Yorùbá"],
  ["za", "Zhuang", "Saɯ cueŋƅ"], ["zh", "Chinese", "中文"], ["zu", "Zulu", "isiZulu"],
  ["ckb", "Central Kurdish", "سۆرانی"], ["fil", "Filipino", "Filipino"], ["haw", "Hawaiian", "ʻŌlelo Hawaiʻi"],
  ["hmn", "Hmong", "Hmoob"], ["ceb", "Cebuano", "Cebuano"], ["arz", "Egyptian Arabic", "مصرى"],
  ["ary", "Moroccan Arabic", "الدارجة"], ["yue", "Cantonese", "粵語"], ["zh-Hans", "Chinese (Simplified)", "简体中文"],
  ["zh-Hant", "Chinese (Traditional)", "繁體中文"], ["pt-BR", "Portuguese (Brazil)", "Português (Brasil)"],
  ["pt-PT", "Portuguese (Portugal)", "Português (Portugal)"], ["es-MX", "Spanish (Mexico)", "Español (México)"],
  ["es-ES", "Spanish (Spain)", "Español (España)"], ["en-GB", "English (UK)", "English (UK)"],
  ["en-US", "English (US)", "English (US)"], ["fr-CA", "French (Canada)", "Français (Canada)"],
  ["nl-BE", "Dutch (Belgium)", "Nederlands (België)"], ["sv-FI", "Swedish (Finland)", "Svenska (Finland)"],
  ["sr-Latn", "Serbian (Latin)", "Srpski"], ["bs-Latn", "Bosnian (Latin)", "Bosanski"],
  ["uz-Latn", "Uzbek (Latin)", "Oʻzbek"], ["uz-Cyrl", "Uzbek (Cyrillic)", "Ўзбек"],
  ["sr-Cyrl", "Serbian (Cyrillic)", "Српски"], ["mni", "Manipuri", "মৈতৈলোন্"], ["mai", "Maithili", "मैथिली"],
  ["sat", "Santali", "ᱥᱟᱱᱛᱟᱲᱤ"], ["gom", "Goan Konkani", "कोंकणी"], ["doi", "Dogri", "डोगरी"],
  ["bho", "Bhojpuri", "भोजपुरी"], ["pcm", "Nigerian Pidgin", "Naijá"], ["tpi", "Tok Pisin", "Tok Pisin"],
  ["ilo", "Ilocano", "Ilokano"], ["war", "Waray", "Winaray"], ["min", "Minangkabau", "Baso Minangkabau"],
];

const items = langs.map(([code, name, native]) => ({
  code,
  name,
  native,
  rtl: rtl.has(String(code).split("-")[0]),
}));

const outDir = path.join("src", "lib", "i18n");
fs.mkdirSync(outDir, { recursive: true });
const content = `/** World locales for NURJAHON AI (${items.length} languages). */
export type WorldLocale = {
  code: string;
  name: string;
  native: string;
  rtl: boolean;
};

export const WORLD_LOCALES: WorldLocale[] = ${JSON.stringify(items, null, 2)} as const;

export const WORLD_LOCALE_CODES = WORLD_LOCALES.map((l) => l.code);

export function getLocaleInfo(code: string): WorldLocale {
  return (
    WORLD_LOCALES.find((l) => l.code === code) ??
    WORLD_LOCALES.find((l) => l.code === "en")!
  );
}

export function isRtlLocale(code: string) {
  return getLocaleInfo(code).rtl;
}
`;
fs.writeFileSync(path.join(outDir, "locales.ts"), content, "utf8");
console.log("Wrote", items.length, "locales");
