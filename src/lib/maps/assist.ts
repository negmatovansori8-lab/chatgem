/**
 * AI ↔ Map bridge (pure; runs on server for chat and on client for voice).
 * Turns a chat/voice utterance into a short reply + a Maps deep link.
 * Distances/times come ONLY from the MapContext produced by the routing
 * provider, places ONLY from the search provider — nothing is estimated here.
 */
import {
  detectMapFollowUp,
  detectMapIntent,
  detectNearThere,
  type MapCategoryKey,
  type MapFollowUp,
  type MapIntent,
  type MapScope,
} from "@/lib/maps/intent";
import { TRANSIT_EMOJI, categoryLabel, categoryPlural, isCategoryKey } from "@/lib/maps/labels";
import { formatClock, formatDistance, formatDuration } from "@/lib/maps/geo";
import { knownCityIn, localName, suggestedCities } from "@/lib/maps/places-world";
import { isFreshMapContext, type MapContext, type MapContextPlace } from "@/lib/maps/context";
import type { MapAction, MapActionLocation } from "@/lib/maps/map-action";
import type { MapPlace, RouteLeg, TravelMode } from "@/providers/maps/types";

export type MapAssist = {
  kind: "nearby" | "search" | "route" | "locate" | "distance" | "directions" | "clarify";
  /** Plain reply (spoken by voice). */
  reply: string;
  /** Deep link to open, if any. */
  href?: string;
  /** Structured command for the embedded map (always carries `href`). */
  action?: MapAction;
  /** Extra choices (e.g. cities to search in). */
  links?: { label: string; href: string }[];
  /** Parsed intent — lets the server resolve search/route to a real place. */
  intent?: MapIntent;
};

/** Attaches the structured action; `href` stays the single source of truth. */
function withAction(assist: Omit<MapAssist, "action">, action: Omit<MapAction, "href">): MapAssist {
  return assist.href ? { ...assist, action: { ...action, href: assist.href } } : assist;
}

/** "London, GB" — the named place an action applies to. */
function scopeLocation(scope: MapScope | undefined): MapActionLocation | undefined {
  if (!scope) return undefined;
  return scope.countryCode && scope.kind === "city" ? `${scope.query}, ${scope.countryCode.toUpperCase()}` : scope.query;
}

const ADDRESS_RE = /(?<![\p{L}])(?:кӯча|куча|улиц|проспект|хиёбон|street|st\.|avenue|ave\.|road|rd\.|пр-т|ул\.)/iu;

export type Lang = "tg" | "ru" | "en";

export function langOf(locale: string): Lang {
  const l = locale.split("-")[0]?.toLowerCase();
  return l === "ru" ? "ru" : l === "tg" ? "tg" : "en";
}

export function pick(lang: Lang, v: Record<Lang, string>) {
  return v[lang];
}

/**
 * Reply in the language the user actually spoke/typed:
 * Tajik letters → tg, other Cyrillic → ru (or tg when the UI is Tajik), Latin → en.
 */
export function detectReplyLocale(text: string, uiLocale: string): string {
  const ui = langOf(uiLocale);
  if (/[ӣӯқғҳҷ]/i.test(text)) return "tg";
  if (/[а-яё]/i.test(text)) {
    const tajikWords =
      /(?<![\p{L}])(?:ман|дар|наздик\p{L}*|куҷо\p{L}*|кучо\p{L}*|чӣ|чи|ёб\p{L}*|ҳаст|хаст|аст|равам|нишон|дорухон\p{L}*|беморхон\p{L}*|мехмонхон\p{L}*|бонк\p{L}*|мошин|пиёда|пиеда|сентри|маркази)(?![\p{L}])/iu;
    return tajikWords.test(text) ? "tg" : "ru";
  }
  if (/[a-z]/i.test(text)) return ui === "en" ? uiLocale : "en";
  return uiLocale;
}

export function mapHref(params: {
  q?: string;
  cat?: MapCategoryKey;
  to?: { lat: number; lng: number; name?: string; address?: string };
  /** Search around this place instead of the user ("near there"). */
  at?: { lat: number; lng: number; name?: string };
  /** Route from this named place instead of the user ("Аз Душанбе то Хуҷанд"). */
  from?: { lat: number; lng: number; name?: string };
  mode?: TravelMode;
  locate?: boolean;
}): string {
  const sp = new URLSearchParams();
  if (params.from) {
    sp.set("from", `${params.from.lat.toFixed(6)},${params.from.lng.toFixed(6)}`);
    if (params.from.name) sp.set("fromName", params.from.name.slice(0, 120));
  }
  if (params.cat) sp.set("cat", params.cat);
  if (params.at) {
    sp.set("at", `${params.at.lat.toFixed(6)},${params.at.lng.toFixed(6)}`);
    if (params.at.name) sp.set("atName", params.at.name.slice(0, 120));
  }
  if (params.q) sp.set("q", params.q);
  if (params.to) {
    sp.set("to", `${params.to.lat.toFixed(6)},${params.to.lng.toFixed(6)}`);
    if (params.to.name) sp.set("name", params.to.name.slice(0, 120));
    if (params.to.address) sp.set("addr", params.to.address.slice(0, 200));
  }
  if (params.mode) sp.set("mode", params.mode);
  if (params.locate) sp.set("locate", "1");
  const qs = sp.toString();
  return qs ? `/app/maps?${qs}` : "/app/maps";
}

/** Tajik izofat: "Дорухона" → "Дорухонаи", "…сӯзишворӣ" → "…сӯзишвории". */
export function tgIzofat(label: string): string {
  return label.endsWith("ӣ") ? `${label.slice(0, -1)}ии` : `${label}и`;
}

/** "дорухонаҳои" → "дорухонаҳо", "стансияҳои сӯзишвории" → "стансияҳои сӯзишворӣ". */
function tgBarePlural(izofat: string): string {
  if (izofat.endsWith("ии")) return `${izofat.slice(0, -2)}ӣ`;
  return izofat.endsWith("и") ? izofat.slice(0, -1) : izofat;
}

/** Scope name for a reply: Russian keeps the user's own case form ("в Лондоне"). */
function scopeName(scope: MapScope, lang: Lang): string {
  if (lang === "ru" && /[а-яё]/i.test(scope.label)) return scope.label;
  return localName(scope.names, scope.label, lang);
}

/** "Big Ben, London, United Kingdom" — name + locality + country, without repeats. */
export function placeTitle(place: Pick<MapPlace, "name" | "locality" | "country">): string {
  const parts: string[] = [];
  for (const p of [place.name, place.locality, place.country]) {
    const v = p?.trim();
    if (v && !parts.some((x) => x.toLowerCase() === v.toLowerCase())) parts.push(v);
  }
  return parts.join(", ");
}

function targetPlace(ctx: MapContext): { place: MapContextPlace; isNearest: boolean } {
  const idx = ctx.selectedId ? ctx.places.findIndex((p) => p.id === ctx.selectedId) : -1;
  const i = idx >= 0 ? idx : 0;
  return { place: ctx.places[i]!, isNearest: i === 0 };
}

export function arrivalPhrase(lang: Lang, clock: string): string {
  const dated = clock.includes(".");
  return pick(lang, {
    tg: dated ? `тақрибан ${clock}` : `тақрибан соати ${clock}`,
    ru: dated ? `примерно ${clock}` : `примерно в ${clock}`,
    en: dated ? `around ${clock}` : `around ${clock}`,
  });
}

function transitLine(place: MapContextPlace, ctx: MapContext, lang: Lang, far: boolean): string {
  if (place.transit) {
    const lines = (place.transitLines ?? [])
      .map((l) => `${TRANSIT_EMOJI[l.vehicle] ?? "🚌"} ${l.name}`.trim())
      .join(", ");
    const time = formatDuration(place.transit.durationSeconds, lang);
    return pick(lang, {
      tg: ` Бо нақлиёти ҷамъиятӣ: ${time}${lines ? ` (${lines})` : ""}.`,
      ru: ` На общественном транспорте: ${time}${lines ? ` (${lines})` : ""}.`,
      en: ` By public transport: ${time}${lines ? ` (${lines})` : ""}.`,
    });
  }
  if (far && ctx.transitAvailable === false) {
    return pick(lang, {
      tg: " Маълумоти нақлиёти ҷамъиятӣ барои ин маршрут дастрас нест.",
      ru: " Данных об общественном транспорте для этого маршрута нет.",
      en: " Public transport data is not available for this route.",
    });
  }
  return "";
}

export const MODE_WORD: Record<TravelMode, Record<Lang, string>> = {
  walking: { tg: "пиёда", ru: "пешком", en: "on foot" },
  driving: { tg: "бо мошин", ru: "на машине", en: "by car" },
  cycling: { tg: "бо велосипед", ru: "на велосипеде", en: "by bike" },
  transit: { tg: "бо нақлиёти ҷамъиятӣ", ru: "на общественном транспорте", en: "by public transport" },
};

function placeHref(ctx: MapContext, place: MapContextPlace, mode?: TravelMode): string {
  return mapHref({
    to: { lat: place.lat, lng: place.lng, name: place.name, address: place.address },
    from: ctx.origin,
    mode,
  });
}

function distanceAction(ctx: MapContext, follow: MapFollowUp, report?: MapAction["report"]): Omit<MapAction, "href"> {
  return {
    type: follow.eta ? "MAP_ETA" : "MAP_DISTANCE",
    destination: "selected_place",
    origin: ctx.origin?.name ?? "current",
    mode: follow.mode,
    report,
  };
}

/** "Бо мошин?" / "Пиёда чанд дақиқа?" — answer for that travel mode only. */
function modeDistanceReply(ctx: MapContext, locale: string, now: Date, follow: MapFollowUp, mode: TravelMode): MapAssist {
  const lang = langOf(locale);
  const { place } = targetPlace(ctx);
  const href = placeHref(ctx, place, mode);
  const word = MODE_WORD[mode];
  const metrics =
    mode === "walking" ? place.walk : mode === "driving" ? place.drive : mode === "transit" ? place.transit : null;
  const from = ctx.origin
    ? pick(lang, { tg: `Аз «${ctx.origin.name}» то`, ru: `От «${ctx.origin.name}» до`, en: `From “${ctx.origin.name}” to` })
    : pick(lang, { tg: "То", ru: "До", en: "To" });

  if (metrics) {
    const dist = formatDistance(metrics.distanceMeters, lang);
    const time = formatDuration(metrics.durationSeconds, lang);
    const arrive = arrivalPhrase(lang, formatClock(metrics.durationSeconds, now, ctx.tzOffsetMinutes));
    const lines =
      mode === "transit" && place.transitLines?.length
        ? ` — ${place.transitLines.map((l) => `${TRANSIT_EMOJI[l.vehicle] ?? "🚌"} ${l.name}`.trim()).join(", ")}`
        : "";
    return withAction(
      {
        kind: "distance",
        href,
        reply: pick(lang, {
          tg: `${from} «${place.name}» ${word.tg} тақрибан ${time} (${dist})${lines}. Агар ҳозир равед, ${arrive} мерасед.`,
          ru: `${from} «${place.name}» ${word.ru} около ${time} (${dist})${lines}. Если выйти сейчас, будете ${arrive}.`,
          en: `${from} “${place.name}” ${word.en}: about ${time} (${dist})${lines}. Leave now and you'll arrive ${arrive}.`,
        }),
      },
      distanceAction(ctx, follow),
    );
  }
  if (mode === "transit" && ctx.transitAvailable === false) {
    return withAction(
      {
        kind: "distance",
        href,
        reply: pick(lang, {
          tg: `Маълумоти нақлиёти ҷамъиятӣ то «${place.name}» дастрас нест. Пиёда ё бо мошинро пурсед.`,
          ru: `Данных об общественном транспорте до «${place.name}» нет. Спросите про пешком или на машине.`,
          en: `Public transport data to “${place.name}” is not available. Ask about walking or driving.`,
        }),
      },
      distanceAction(ctx, follow),
    );
  }
  // Not measured yet (cycling, or no location when the list was built): the map routes and reports back.
  return withAction(
    {
      kind: "distance",
      href,
      reply: pick(lang, {
        tg: `Роҳро то «${place.name}» ${word.tg} дар харита ҳисоб мекунам.`,
        ru: `Считаю маршрут до «${place.name}» ${word.ru} на карте.`,
        en: `Calculating the route to “${place.name}” ${word.en} on the map.`,
      }),
    },
    distanceAction(ctx, follow, "route"),
  );
}

function distanceReply(ctx: MapContext, locale: string, now: Date, follow: MapFollowUp): MapAssist {
  if (follow.mode) return modeDistanceReply(ctx, locale, now, follow, follow.mode);
  const lang = langOf(locale);
  const { place, isNearest } = targetPlace(ctx);
  const href = placeHref(ctx, place);
  const action = distanceAction(ctx, follow);
  const fromYou = ctx.origin
    ? { tg: `аз «${ctx.origin.name}»`, ru: `от «${ctx.origin.name}»`, en: `from “${ctx.origin.name}”` }
    : { tg: "аз ҷойи ҳозираи шумо", ru: "от вас", en: "from you" };
  const category = isCategoryKey(ctx.category) ? ctx.category : null;
  const subject =
    category && isNearest
      ? pick(lang, {
          tg: `${tgIzofat(categoryLabel(category, "tg"))} наздиктарин — «${place.name}» —`,
          ru: `Ближайшая точка «${categoryLabel(category, "ru")}» — «${place.name}» —`,
          en: `The nearest ${categoryLabel(category, "en").toLowerCase()}, “${place.name}”, is`,
        })
      : pick(lang, { tg: `«${place.name}»`, ru: `«${place.name}»`, en: `“${place.name}” is` });

  const { walk, drive } = place;
  const tz = ctx.tzOffsetMinutes;

  // Long trips: lead with the car, walking time only for completeness.
  if (drive && (!walk || walk.durationSeconds > 3 * 3600)) {
    const walkPart = walk
      ? pick(lang, {
          tg: ` Пиёда: ${formatDuration(walk.durationSeconds, "tg")}.`,
          ru: ` Пешком: ${formatDuration(walk.durationSeconds, "ru")}.`,
          en: ` On foot: ${formatDuration(walk.durationSeconds, "en")}.`,
        })
      : "";
    const dist = formatDistance(drive.distanceMeters, lang);
    const time = formatDuration(drive.durationSeconds, lang);
    const arrive = arrivalPhrase(lang, formatClock(drive.durationSeconds, now, tz));
    return withAction(
      {
        kind: "distance",
        href,
        reply:
          pick(lang, {
            tg: `${subject} ${fromYou.tg} бо роҳ тақрибан ${dist} дур аст. Бо мошин тақрибан ${time}; агар ҳозир равед, ${arrive} мерасед.${walkPart}`,
            ru: `${subject} примерно в ${dist} ${fromYou.ru} по дороге. На машине около ${time}; если выехать сейчас, будете ${arrive}.${walkPart}`,
            en: `${subject} about ${dist} ${fromYou.en} by road. By car roughly ${time}; leave now and you'll arrive ${arrive}.${walkPart}`,
          }) + transitLine(place, ctx, lang, true),
      },
      action,
    );
  }

  if (walk) {
    const dist = formatDistance(walk.distanceMeters, lang);
    const time = formatDuration(walk.durationSeconds, lang);
    const arrive = arrivalPhrase(lang, formatClock(walk.durationSeconds, now, tz));
    const driveLine = drive
      ? pick(lang, {
          tg: ` Бо мошин: ${formatDuration(drive.durationSeconds, "tg")}.`,
          ru: ` На машине: ${formatDuration(drive.durationSeconds, "ru")}.`,
          en: ` By car: ${formatDuration(drive.durationSeconds, "en")}.`,
        })
      : "";
    return withAction(
      {
        kind: "distance",
        href,
        reply:
          pick(lang, {
            tg: `${subject} тақрибан ${dist} дур аст ва пиёда тақрибан ${time} вақт мегирад. Агар ҳозир равед, ${arrive} мерасед.${driveLine}`,
            ru: `${subject} примерно в ${dist}, пешком около ${time}. Если выйти сейчас, будете ${arrive}.${driveLine}`,
            en: `${subject} about ${dist} away — roughly ${time} on foot. Leave now and you'll arrive ${arrive}.${driveLine}`,
          }) + transitLine(place, ctx, lang, walk.durationSeconds > 30 * 60),
      },
      action,
    );
  }

  // No metrics yet (location was off): the map asks for location, routes and reports back.
  return withAction(
    {
      kind: "distance",
      href,
      reply: pick(lang, {
        tg: `Масофа то «${place.name}» ${fromYou.tg} ҳоло ҳисоб нашудааст. Дар харита роҳи воқеиро ҳисоб мекунам — барои ин Location Permission лозим аст.`,
        ru: `Расстояние до «${place.name}» ${fromYou.ru} ещё не рассчитано. Считаю реальный маршрут на карте — для этого нужно разрешение на геолокацию.`,
        en: `The distance to “${place.name}” ${fromYou.en} hasn't been calculated yet. I'm routing it on the map — this needs location permission.`,
      }),
    },
    { ...action, report: "route" },
  );
}

function directionsReply(ctx: MapContext, locale: string, mode?: TravelMode): MapAssist {
  const lang = langOf(locale);
  const { place } = targetPlace(ctx);
  const far = Boolean(
    (place.walk && place.walk.durationSeconds > 3 * 3600) || (!place.walk && place.drive && place.drive.distanceMeters > 5_000),
  );
  const m = mode ?? (far ? "driving" : "walking");
  return withAction(
    {
      kind: "directions",
      href: placeHref(ctx, place, m),
      reply: pick(lang, {
        tg: `Хуб. Роҳро то «${place.name}» ${MODE_WORD[m].tg} дар харита нишон медиҳам.`,
        ru: `Хорошо. Показываю маршрут до «${place.name}» ${MODE_WORD[m].ru} на карте.`,
        en: `OK. Showing the route to “${place.name}” ${MODE_WORD[m].en} on the map.`,
      }),
    },
    { type: "MAP_ROUTE", destination: "selected_place", origin: ctx.origin?.name ?? "current", mode: m, report: "route" },
  );
}

/** "Наздики он ҷо ресторан ҳаст?" — search around the last map result / the selected place. */
function nearThereReply(category: MapCategoryKey, ctx: MapContext, locale: string): MapAssist {
  const lang = langOf(locale);
  const { place } = targetPlace(ctx);
  const tgPlural = categoryPlural(category, "tg");
  return withAction(
    {
      kind: "nearby",
      href: mapHref({ cat: category, at: { lat: place.lat, lng: place.lng, name: place.name } }),
      reply: pick(lang, {
        tg: `Албатта. ${tgPlural[0]!.toUpperCase()}${tgPlural.slice(1)} наздики «${place.name}»-ро меҷӯям.`,
        ru: `Конечно. Ищу ${categoryPlural(category, "ru")} рядом с «${place.name}».`,
        en: `Sure. Looking for ${categoryPlural(category, "en")} near “${place.name}”.`,
      }),
    },
    { type: "MAP_NEARBY_SEARCH", category, location: "selected_place", report: "places" },
  );
}

/** Country named + "nearby": ask whether "near me" or which city in that country. */
function clarifyCountryNearby(intent: Extract<MapIntent, { type: "nearby" }>, scope: MapScope, lang: Lang): MapAssist {
  const country = scopeName(scope, lang);
  const plural = categoryPlural(intent.category, lang);
  const label = categoryLabel(intent.category, lang);
  const cities = suggestedCities(scope.countryCode, lang);
  const examples = cities.map((c) => c.name).join(", ");
  const links = [
    ...cities.map((c) => ({ label: `📍 ${c.name}`, href: mapHref({ q: `${label} ${c.name}` }) })),
    {
      label: pick(lang, { tg: "📍 Наздики ҷойи ҳозираи ман", ru: "📍 Рядом со мной", en: "📍 Near my location" }),
      href: mapHref({ cat: intent.category }),
    },
  ];
  const cityPart = examples
    ? pick(lang, {
        tg: ` Агар дар ${country} бошад, дар кадом шаҳр — масалан: ${examples}?`,
        ru: ` Если в ${country} — в каком городе, например: ${examples}?`,
        en: ` If in ${country}, which city — e.g. ${examples}?`,
      })
    : pick(lang, {
        tg: ` Агар дар ${country} бошад, номи шаҳрро нависед.`,
        ru: ` Если в ${country} — напишите город.`,
        en: ` If in ${country}, tell me the city.`,
      });
  return {
    kind: "clarify",
    intent,
    links,
    reply:
      pick(lang, {
        tg: `Аниқ кунед, лутфан: ${plural} наздики ҷойи ҳозираи худатонро ёбам ё дар ${country}?`,
        ru: `Уточните, пожалуйста: искать ${plural} рядом с вами или в ${country}?`,
        en: `Just to check: should I look for ${plural} near your current location, or in ${country}?`,
      }) + cityPart,
  };
}

function intentReply(intent: MapIntent, locale: string): MapAssist | null {
  const lang = langOf(locale);
  switch (intent.type) {
    case "nearby": {
      const scope = intent.scope;
      if (scope?.kind === "country" && scope.countryCode !== "tj") {
        return clarifyCountryNearby(intent, scope, lang);
      }
      if (scope) {
        const where = scopeName(scope, lang);
        return withAction(
          {
            kind: "nearby",
            intent,
            href: mapHref({ q: intent.raw }),
            reply: pick(lang, {
              tg: `Албатта. Ман ${tgBarePlural(categoryPlural(intent.category, "tg"))}ро дар ${where} меҷӯям.`,
              ru: `Конечно. Ищу ${categoryPlural(intent.category, "ru")} в ${where}.`,
              en: `Sure. I'm looking for ${categoryPlural(intent.category, "en")} in ${where}.`,
            }),
          },
          { type: "MAP_CATEGORY", category: intent.category, location: scopeLocation(scope), report: "places" },
        );
      }
      if (intent.route) {
        // "Ба фурудгоҳ чӣ тавр равам?" — nearest one, then the real route to it.
        const label = categoryLabel(intent.category, lang);
        return withAction(
          {
            kind: "route",
            intent,
            href: mapHref({ cat: intent.category, mode: intent.mode }),
            reply: pick(lang, {
              tg: `Албатта. ${tgIzofat(label)} наздиктаринро меёбам ва роҳ, масофа ва вақти расиданро ҳисоб мекунам.`,
              ru: `Конечно. Найду ближайший вариант («${label}») и рассчитаю маршрут, расстояние и время прибытия.`,
              en: `Sure. I'll find the nearest ${label.toLowerCase()} and calculate the route, distance and arrival time.`,
            }),
          },
          {
            type: "MAP_ROUTE",
            category: intent.category,
            origin: "current",
            destination: `nearest ${categoryLabel(intent.category, "en").toLowerCase()}`,
            mode: intent.mode,
            report: "route",
          },
        );
      }
      return withAction(
        {
          kind: "nearby",
          intent,
          href: mapHref({ cat: intent.category }),
          reply: pick(lang, {
            tg: `Албатта. Ман ${categoryPlural(intent.category, "tg")} наздикро меҷӯям.`,
            ru: `Конечно. Ищу ближайшие ${categoryPlural(intent.category, "ru")}.`,
            en: `Sure. I'm looking for nearby ${categoryPlural(intent.category, "en")}.`,
          }),
        },
        { type: "MAP_NEARBY_SEARCH", category: intent.category, location: "current", report: "places" },
      );
    }
    case "search":
      return withAction(
        {
          kind: "search",
          intent,
          href: mapHref({ q: intent.raw, mode: intent.mode }),
          reply: pick(lang, {
            tg: "Албатта. Ҷойро дар харита меёбам ва масофа, роҳ ва вақти расиданро ҳисоб мекунам.",
            ru: "Конечно. Найду место на карте и рассчитаю расстояние, маршрут и время прибытия.",
            en: "Sure. I'll find the place on the map and calculate the distance, route and arrival time.",
          }),
        },
        searchAction(intent),
      );
    case "route":
      if (!intent.destination && !intent.scope) {
        return {
          kind: "clarify",
          reply: pick(lang, {
            tg: "Ба куҷо рафтан мехоҳед? Номи ҷой ё суроғаро нависед, масалан: «Сентри Душанбе куҷост?»",
            ru: "Куда вы хотите поехать? Напишите название места или адрес, например: «Где центр Душанбе?»",
            en: "Where would you like to go? Type a place or address, e.g. “Where is Dushanbe centre?”",
          }),
        };
      }
      return withAction(
        {
          kind: "route",
          intent,
          href: mapHref({ q: intent.raw, mode: intent.mode }),
          reply: pick(lang, {
            tg: "Албатта. Роҳ ва вақти расиданро дар харита ҳисоб мекунам.",
            ru: "Конечно. Построю маршрут и рассчитаю время прибытия на карте.",
            en: "Sure. I'll build the route and calculate the arrival time on the map.",
          }),
        },
        {
          type: "MAP_ROUTE",
          origin: intent.origin ? intent.origin.query || scopeLocation(intent.origin.scope) : "current",
          destination: intent.destination || scopeLocation(intent.scope),
          mode: intent.mode,
          // Unresolved A→B falls back to a search for the destination.
          report: intent.origin ? "places" : "route",
        },
      );
    case "locate":
      return withAction(
        {
          kind: "locate",
          intent,
          href: mapHref({ locate: true }),
          reply: pick(lang, {
            tg: "Харитаро мекушоям. Ҷойи шумо танҳо бо иҷозати шумо нишон дода мешавад.",
            ru: "Открываю карту. Ваше местоположение показывается только с вашего разрешения.",
            en: "Opening the map. Your location is shown only with your permission.",
          }),
        },
        { type: "MAP_CURRENT_LOCATION", location: "current", report: "locate" },
      );
    default:
      return null;
  }
}

function searchAction(intent: Extract<MapIntent, { type: "search" | "route" }>): Omit<MapAction, "href"> {
  const query = intent.type === "search" ? intent.query : (intent.destination ?? "");
  const location = scopeLocation(intent.scope);
  if (intent.type === "route") {
    return { type: "MAP_ROUTE", origin: "current", destination: query || location, mode: intent.mode, report: "route" };
  }
  if (!query && intent.scope) {
    return {
      type: intent.scope.kind === "country" ? "MAP_COUNTRY_SEARCH" : "MAP_CITY_SEARCH",
      query: intent.scope.label,
      location,
      report: "places",
    };
  }
  return {
    type: ADDRESS_RE.test(query) ? "MAP_ADDRESS" : "MAP_SEARCH_PLACE",
    query,
    category: intent.category,
    location: location ?? "current",
    mode: intent.mode,
    report: "places",
  };
}

/** Reply for a place the search provider actually found (chat / voice). */
export function foundPlaceReply(
  place: MapPlace,
  intent: Extract<MapIntent, { type: "search" | "route" }>,
  locale: string,
): MapAssist {
  const lang = langOf(locale);
  // OSM often files landmarks under a borough ("City of Westminster"); prefer the well-known city.
  const city = place.countryCode ? knownCityIn(place.address, place.countryCode) : undefined;
  const title = placeTitle(city ? { ...place, locality: localName(city.names, city.query, lang) } : place);
  const address = place.address && place.address !== title ? place.address : "";
  const addressLine = address
    ? pick(lang, { tg: `\n🏠 Суроға: ${address}`, ru: `\n🏠 Адрес: ${address}`, en: `\n🏠 Address: ${address}` })
    : "";
  const next =
    intent.type === "route"
      ? pick(lang, {
          tg: "\n\nРоҳ, масофа ва вақти расиданро аз ҷойи ҳозираи шумо дар харита ҳисоб мекунам.",
          ru: "\n\nМаршрут, расстояние и время прибытия от вашего местоположения посчитаю на карте.",
          en: "\n\nI'll calculate the route, distance and arrival time from your location on the map.",
        })
      : pick(lang, {
          tg: "\n\nБарои масофа ва роҳ пурсед: «Аз ман чанд дур аст?» ё «Чӣ тавр равам?»",
          ru: "\n\nСпросите «Как далеко от меня?» или «Как туда добраться?» — посчитаю по реальному маршруту.",
          en: "\n\nAsk “How far is it from me?” or “How do I get there?” for the real route.",
        });
  return withAction(
    {
      kind: intent.type,
      intent,
      href: mapHref({
        to: { lat: place.location.lat, lng: place.location.lng, name: place.name, address: place.address },
        mode: intent.mode,
      }),
      reply: `📍 ${title}${addressLine}${next}`,
    },
    searchAction(intent),
  );
}

/** Honest "not found" — no guessed places. */
export function notFoundReply(intent: MapIntent, locale: string): MapAssist {
  const lang = langOf(locale);
  const what =
    intent.type === "search" ? intent.query : intent.type === "route" ? (intent.destination ?? "") : "";
  const scope = "scope" in intent ? intent.scope : undefined;
  const where = scope ? scopeName(scope, lang) : "";
  const tgSubject = what ? `«${what}»${where ? ` (дар ${where})` : ""}-ро` : "ин ҷойро";
  const ruSubject = what ? `«${what}»${where ? ` в ${where}` : ""}` : "это место";
  const enSubject = what ? `“${what}”${where ? ` in ${where}` : ""}` : "this place";
  return {
    kind: "clarify",
    intent,
    reply: pick(lang, {
      tg: `Ман ${tgSubject} пайдо карда натавонистам. Лутфан номи шаҳр ё ҷойро дақиқтар нависед.`,
      ru: `Я не смог найти ${ruSubject}. Пожалуйста, напишите название города или места точнее.`,
      en: `I couldn't find ${enSubject}. Please write the city or place name more precisely.`,
    }),
  };
}

/** Name of one end of an A→B route for the reply ("Душанбе", "Хуҷанд", "Big Ben"). */
function endpointName(query: string | undefined, scope: MapScope | undefined, place: MapPlace, lang: Lang): string {
  return scope && !query ? scopeName(scope, lang) : place.name;
}

/** "Аз Душанбе то Хуҷанд чӣ қадар роҳ аст?" — both ends geocoded, route from the routing provider. */
export function pointToPointReply(input: {
  from: MapPlace;
  to: MapPlace;
  leg: RouteLeg;
  intent: Extract<MapIntent, { type: "route" }>;
  locale: string;
  now?: Date;
  tzOffsetMinutes?: number;
}): MapAssist {
  const { from, to, leg, intent } = input;
  const lang = langOf(input.locale);
  const a = endpointName(intent.origin?.query, intent.origin?.scope, from, lang);
  const b = endpointName(intent.destination, intent.scope, to, lang);
  const href = mapHref({
    from: { lat: from.location.lat, lng: from.location.lng, name: a },
    to: { lat: to.location.lat, lng: to.location.lng, name: b, address: to.address },
    mode: leg.mode,
  });
  const action: Omit<MapAction, "href"> = { type: "MAP_ROUTE", origin: a, destination: b, mode: leg.mode };
  if (!leg.available) {
    return withAction(
      {
        kind: "route",
        intent,
        href,
        reply: pick(lang, {
          tg: `Роҳ аз ${a} то ${b} ${MODE_WORD[leg.mode].tg} ёфт нашуд. Намуди дигари ҳаракатро санҷед.`,
          ru: `Маршрут от ${a} до ${b} ${MODE_WORD[leg.mode].ru} не найден. Попробуйте другой способ передвижения.`,
          en: `No route from ${a} to ${b} ${MODE_WORD[leg.mode].en} was found. Try another travel mode.`,
        }),
      },
      action,
    );
  }
  const dist = formatDistance(leg.distanceMeters, lang);
  const time = formatDuration(leg.durationSeconds, lang);
  const arrive = arrivalPhrase(lang, formatClock(leg.durationSeconds, input.now ?? new Date(), input.tzOffsetMinutes));
  return withAction(
    {
      kind: "route",
      intent,
      href,
      reply: pick(lang, {
        tg: `Аз ${a} то ${b} ${MODE_WORD[leg.mode].tg} тақрибан ${dist} роҳ аст ва тақрибан ${time} вақт мегирад. Агар ҳозир равед, ${arrive} мерасед.`,
        ru: `От ${a} до ${b} ${MODE_WORD[leg.mode].ru} примерно ${dist}, в пути около ${time}. Если выехать сейчас, будете ${arrive}.`,
        en: `From ${a} to ${b} ${MODE_WORD[leg.mode].en} is about ${dist} — roughly ${time}. Leave now and you'll arrive ${arrive}.`,
      }),
    },
    action,
  );
}

export function buildMapAssist(input: {
  text: string;
  locale: string;
  context?: MapContext | null;
  now?: Date;
}): MapAssist | null {
  const text = input.text.trim();
  if (!text) return null;
  const now = input.now ?? new Date();

  const nearThere = detectNearThere(text);
  if (nearThere) {
    return isFreshMapContext(input.context, now.getTime())
      ? nearThereReply(nearThere, input.context, input.locale)
      : {
          kind: "clarify",
          reply: pick(langOf(input.locale), {
            tg: "Аввал ҷойро ёбем — масалан: «Сентри Душанбе куҷост?». Баъд ҷойҳои наздики онро меҷӯям.",
            ru: "Сначала найдём место — например: «Где центр Душанбе?». Потом поищу рядом с ним.",
            en: "Let's find the place first — e.g. “Where is Dushanbe centre?” — then I'll search around it.",
          }),
        };
  }

  const followUp = detectMapFollowUp(text);
  if (followUp && isFreshMapContext(input.context, now.getTime())) {
    return followUp.kind === "distance"
      ? distanceReply(input.context, input.locale, now, followUp)
      : directionsReply(input.context, input.locale, followUp.mode);
  }
  // Mode-only ("Бо мошин?") without a place falls through to "Where to?".
  if (followUp?.kind === "distance" && !followUp.mode) {
    // Never let the LLM guess a distance without a real routed result.
    const lang = langOf(input.locale);
    return {
      kind: "clarify",
      reply: pick(lang, {
        tg: "Аввал ҷойро ёбем. Масалан нависед: «Наздики ман дорухона ёб» ё «Дар Лондон Big Ben-ро ёб» — баъд масофа ва вақтро аз рӯи роҳи воқеӣ мегӯям.",
        ru: "Сначала найдём место. Например: «Найди аптеку рядом» или «Найди Биг-Бен в Лондоне» — потом скажу расстояние и время по реальному маршруту.",
        en: "Let's find the place first — e.g. “Find a pharmacy near me” or “Find Big Ben in London” — then I'll tell you the real route distance and time.",
      }),
    };
  }
  return intentReply(detectMapIntent(text), input.locale);
}

/** Markdown for chat: reply + visible links (persisted with the message). */
export function mapAssistMarkdown(assist: MapAssist, locale: string): string {
  const lines = [assist.reply];
  if (assist.links?.length) {
    lines.push("", assist.links.map((l) => `- [${l.label}](${l.href})`).join("\n"));
  }
  if (assist.href) {
    const lang = langOf(locale);
    const label = pick(lang, {
      tg: "🗺 Дар харита кушоед",
      ru: "🗺 Открыть на карте",
      en: "🗺 Open on Map",
    });
    lines.push("", `[${label}](${assist.href})`);
  }
  return lines.join("\n");
}
