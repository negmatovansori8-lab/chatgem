/**
 * Map → Chat: turns what the embedded map REALLY found (places, route,
 * location, errors) into the assistant reply. Pure; tg / ru / en.
 */
import { MODE_WORD, arrivalPhrase, langOf, mapHref, pick, tgIzofat, type Lang } from "@/lib/maps/assist";
import { formatClock, formatDistance, formatDuration } from "@/lib/maps/geo";
import { categoryLabel, categoryPlural } from "@/lib/maps/labels";
import type { MapResult, MapResultBody, MapResultPlace } from "@/lib/maps/map-result";
import type { RouteMetrics, TravelMode } from "@/providers/maps/types";

/** Walking up to 40 min, otherwise driving — the same rule the map uses. */
function bestMetric(p: MapResultPlace): { mode: TravelMode; m: RouteMetrics } | null {
  if (p.walk && p.walk.durationSeconds <= 40 * 60) return { mode: "walking", m: p.walk };
  if (p.drive) return { mode: "driving", m: p.drive };
  if (p.walk) return { mode: "walking", m: p.walk };
  return null;
}

function placeLink(p: MapResultPlace): string {
  const href = mapHref({ to: { lat: p.lat, lng: p.lng, name: p.name, address: p.address } });
  return `[${p.name.replace(/[[\]]/g, "")}](${href})`;
}

function metricText(p: MapResultPlace, lang: Lang): string {
  const best = bestMetric(p);
  if (!best) return "";
  const icon = best.mode === "walking" ? "🚶" : "🚗";
  return `${formatDistance(best.m.distanceMeters, lang)} · ${icon} ${formatDuration(best.m.durationSeconds, lang)}`;
}

function listLines(places: MapResultPlace[], lang: Lang, start = 1): string {
  return places
    .map((p, i) => {
      const metric = metricText(p, lang);
      return `${start + i}. ${placeLink(p)}${metric ? ` — ${metric}` : ""}`;
    })
    .join("\n");
}

function categoryHead(r: Extract<MapResultBody, { kind: "places" }>, lang: Lang): string {
  const category = r.category!;
  const n = r.places.length;
  const label = categoryLabel(category, lang).toLowerCase();
  const plural = categoryPlural(category, lang);
  const scope = r.scope;
  if (scope?.kind === "area") {
    return pick(lang, {
      tg: `Ман дар ${scope.name} ${n} ${label} ёфтам.`,
      ru: `Нашёл в ${scope.name}: ${plural} (${n}).`,
      en: `I found ${n} ${plural} in ${scope.name}.`,
    });
  }
  if (scope?.kind === "around") {
    return pick(lang, {
      tg: `Ман наздики «${scope.name}» ${n} ${label} ёфтам.`,
      ru: `Нашёл рядом с «${scope.name}»: ${plural} (${n}).`,
      en: `I found ${n} ${plural} near “${scope.name}”.`,
    });
  }
  return pick(lang, {
    tg: `Ман ${n} ${tgIzofat(categoryLabel(category, "tg")).toLowerCase()} наздикро ёфтам.`,
    ru: `Нашёл рядом: ${plural} (${n}).`,
    en: `I found ${n} nearby ${plural}.`,
  });
}

function nearestLine(p: MapResultPlace, lang: Lang, nearest: boolean): string {
  const best = bestMetric(p);
  if (!best) return "";
  const dist = formatDistance(best.m.distanceMeters, lang);
  const time = formatDuration(best.m.durationSeconds, lang);
  const walking = best.mode === "walking";
  if (!nearest) {
    return pick(lang, {
      tg: ` «${p.name}» аз шумо ${dist} дур аст, ${walking ? `пиёда тақрибан ${time}` : `бо мошин тақрибан ${time}`}.`,
      ru: ` «${p.name}» — ${dist} от вас, около ${time} ${walking ? "пешком" : "на машине"}.`,
      en: ` “${p.name}” is ${dist} from you — about ${time} ${walking ? "on foot" : "by car"}.`,
    });
  }
  return pick(lang, {
    tg: walking
      ? ` Наздиктаринаш — «${p.name}» — ${dist} дур аст ва тақрибан ${time} пиёда аст.`
      : ` Наздиктаринаш — «${p.name}» — ${dist} дур аст, бо мошин тақрибан ${time}.`,
    ru: ` Ближайшее — «${p.name}»: ${dist}, около ${time} ${walking ? "пешком" : "на машине"}.`,
    en: ` The nearest is “${p.name}”: ${dist}, about ${time} ${walking ? "on foot" : "by car"}.`,
  });
}

const NEED_LOCATION: Record<Lang, string> = {
  tg: "Барои масофа ва вақт Location Permission лозим аст.",
  ru: "Для расстояния и времени нужно разрешение на геолокацию.",
  en: "Location permission is needed for distance and time.",
};

function categorySummary(r: Extract<MapResultBody, { kind: "places" }>, lang: Lang): string {
  const top = r.places.slice(0, 5);
  const first = top[0]!;
  // Around the user the list is sorted by real route distance; elsewhere it keeps relevance order.
  const head = categoryHead(r, lang) + nearestLine(first, lang, !r.scope);
  const lines = [head, "", listLines(top, lang)];
  if (!r.hasLocation && !bestMetric(first)) lines.push("", NEED_LOCATION[lang]);
  lines.push(
    "",
    pick(lang, {
      tg: "Номи ҷойро пахш кунед ё нависед: «Ба ҳамин ҷо рав».",
      ru: "Нажмите на название или напишите «Проложи маршрут туда».",
      en: "Tap a name or say “Take me there”.",
    }),
  );
  return lines.join("\n");
}

function distanceSentence(p: MapResultPlace, lang: Lang, originName?: string): string {
  const from = originName
    ? pick(lang, { tg: `Аз «${originName}»`, ru: `От «${originName}»`, en: `From “${originName}”` })
    : pick(lang, { tg: "Аз ҷойи ҳозираи шумо", ru: "От вас", en: "From you" });
  const walk = p.walk && p.walk.durationSeconds <= 3 * 3600 ? p.walk : null;
  const road = p.drive ?? p.walk;
  if (!road) return "";
  const parts = [
    walk ? pick(lang, { tg: `пиёда ${formatDuration(walk.durationSeconds, "tg")}`, ru: `пешком ${formatDuration(walk.durationSeconds, "ru")}`, en: `${formatDuration(walk.durationSeconds, "en")} on foot` }) : "",
    p.drive ? pick(lang, { tg: `бо мошин ${formatDuration(p.drive.durationSeconds, "tg")}`, ru: `на машине ${formatDuration(p.drive.durationSeconds, "ru")}`, en: `${formatDuration(p.drive.durationSeconds, "en")} by car` }) : "",
  ].filter(Boolean);
  const dist = formatDistance(road.distanceMeters, lang);
  return pick(lang, {
    tg: `${from} тақрибан ${dist} роҳ аст: ${parts.join(", ")}.`,
    ru: `${from} примерно ${dist} по дороге: ${parts.join(", ")}.`,
    en: `${from} it is about ${dist} by road: ${parts.join(", ")}.`,
  });
}

function placeSummary(r: Extract<MapResultBody, { kind: "places" }>, lang: Lang): string {
  const [first, ...others] = r.places;
  const p = first!;
  const lines = [`📍 **${placeLink(p)}**`];
  if (p.address && p.address !== p.name) {
    lines.push(pick(lang, { tg: `🏠 Суроға: ${p.address}`, ru: `🏠 Адрес: ${p.address}`, en: `🏠 Address: ${p.address}` }));
  }
  const dist = distanceSentence(p, lang, r.originName);
  if (dist) lines.push("", dist);
  else if (!r.hasLocation) lines.push("", NEED_LOCATION[lang]);
  if (others.length) {
    lines.push(
      "",
      pick(lang, { tg: "Натиҷаҳои дигар:", ru: "Другие результаты:", en: "Other results:" }),
      listLines(others.slice(0, 4), lang, 2),
    );
  }
  lines.push(
    "",
    pick(lang, {
      tg: "Пурсед: «Чӣ тавр равам?», «Бо мошин?» ё «Наздики он ресторан ҳаст?»",
      ru: "Спросите: «Как туда добраться?», «А на машине?» или «Есть рядом ресторан?»",
      en: "Ask: “How do I get there?”, “By car?” or “Any restaurant near it?”",
    }),
  );
  return lines.join("\n");
}

function routeSummary(r: Extract<MapResultBody, { kind: "route" }>, lang: Lang, now: Date): string {
  const dist = formatDistance(r.distanceMeters, lang);
  const time = formatDuration(r.durationSeconds, lang);
  const arrive = arrivalPhrase(lang, formatClock(r.durationSeconds, now));
  const word = MODE_WORD[r.mode][lang];
  const name = r.place.name;
  const route = r.originName
    ? pick(lang, { tg: `Роҳ аз «${r.originName}» то «${name}»`, ru: `Маршрут от «${r.originName}» до «${name}»`, en: `Route from “${r.originName}” to “${name}”` })
    : pick(lang, { tg: `Роҳ то «${name}»`, ru: `Маршрут до «${name}»`, en: `Route to “${name}”` });
  return pick(lang, {
    tg: `🧭 ${route} ${word}: ${dist}, тақрибан ${time}. Агар ҳозир равед, ${arrive} мерасед.`,
    ru: `🧭 ${route} ${word}: ${dist}, около ${time}. Если выйти сейчас, будете ${arrive}.`,
    en: `🧭 ${route} ${word}: ${dist}, about ${time}. Leave now and you'll arrive ${arrive}.`,
  });
}

function locateSummary(r: Extract<MapResultBody, { kind: "locate" }>, lang: Lang): string {
  if (r.approximate) {
    const where = r.address
      ? pick(lang, {
          tg: `📍 Шумо тахминан дар ${r.address} ҳастед (аз рӯи интернет, дақиқӣ дар сатҳи шаҳр).`,
          ru: `📍 Вы примерно здесь: ${r.address} (по интернет-подключению, точность до города).`,
          en: `📍 You are approximately in ${r.address} (from your network, city-level accuracy).`,
        })
      : pick(lang, {
          tg: "📍 Ҷойи тахминии шумо дар харита нишон дода шуд (аз рӯи интернет).",
          ru: "📍 Ваше примерное местоположение показано на карте (по интернет-подключению).",
          en: "📍 Your approximate location is shown on the map (from your network).",
        });
    return `${where}\n\n${pick(lang, {
      tg: "Барои ҷойи дақиқ Location-ро дар браузер иҷозат диҳед. 🔒 Ҷойгиршавии шумо нигоҳ дошта намешавад.",
      ru: "Для точного местоположения разрешите геолокацию в браузере. 🔒 Ваше местоположение не сохраняется.",
      en: "Allow Location in your browser for a precise position. 🔒 Your location is not stored.",
    })}`;
  }
  const accuracy =
    r.accuracyMeters && r.accuracyMeters < 5_000
      ? pick(lang, {
          tg: ` (дақиқӣ ±${Math.round(r.accuracyMeters)} м)`,
          ru: ` (точность ±${Math.round(r.accuracyMeters)} м)`,
          en: ` (accuracy ±${Math.round(r.accuracyMeters)} m)`,
        })
      : "";
  const head = r.address
    ? pick(lang, {
        tg: `📍 Шумо ҳоло дар ин ҷо ҳастед: ${r.address}${accuracy}.`,
        ru: `📍 Вы сейчас здесь: ${r.address}${accuracy}.`,
        en: `📍 You are here now: ${r.address}${accuracy}.`,
      })
    : pick(lang, {
        tg: `📍 Шумо ҳоло дар ин ҷо ҳастед${accuracy}. Ҷойи шумо дар харита нишон дода шуд.`,
        ru: `📍 Вы сейчас здесь${accuracy}. Ваше местоположение показано на карте.`,
        en: `📍 You are here now${accuracy}. Your location is shown on the map.`,
      });
  return `${head}\n\n${pick(lang, {
    tg: "🔒 Ҷойгиршавии шумо нигоҳ дошта намешавад.",
    ru: "🔒 Ваше местоположение не сохраняется.",
    en: "🔒 Your location is not stored.",
  })}`;
}

function errorSummary(r: Extract<MapResultBody, { kind: "error" }>, lang: Lang): string {
  if (r.source === "location") {
    if (r.code === "permission_denied") {
      return pick(lang, {
        tg: "Барои ёфтани ҷойҳои наздики шумо Location Permission лозим аст.",
        ru: "Чтобы найти места рядом с вами, нужно разрешение на геолокацию (Location Permission).",
        en: "Location Permission is needed to find places near you.",
      });
    }
    if (r.code === "insecure_context") {
      return pick(lang, {
        tg: "Муайян кардани ҷойгиршавӣ танҳо дар пайвасти бехатар (HTTPS) кор мекунад.",
        ru: "Геолокация работает только по защищённому соединению (HTTPS).",
        en: "Location only works over a secure connection (HTTPS).",
      });
    }
    return pick(lang, {
      tg: "Ҷойгиршавии шуморо муайян карда натавонистам. GPS-ро санҷед ва дубора кӯшиш кунед.",
      ru: "Не удалось определить ваше местоположение. Проверьте GPS и попробуйте ещё раз.",
      en: "I couldn't determine your location. Check GPS and try again.",
    });
  }
  if (r.code === "place_not_found") {
    return pick(lang, {
      tg: "Ман ин ҷойро пайдо карда натавонистам. Лутфан номи шаҳр ё ҷойро дақиқтар нависед.",
      ru: "Я не смог найти это место. Пожалуйста, напишите название города или места точнее.",
      en: "I couldn't find this place. Please write the city or place name more precisely.",
    });
  }
  if (r.code === "route_not_found") {
    return pick(lang, {
      tg: "Роҳ то ин ҷой ёфт нашуд. Намуди дигари ҳаракатро санҷед.",
      ru: "Маршрут до этого места не найден. Попробуйте другой способ передвижения.",
      en: "No route to this place was found. Try another travel mode.",
    });
  }
  if (r.code === "transit_unavailable") {
    return pick(lang, {
      tg: "Маълумоти нақлиёти ҷамъиятӣ барои ин маршрут дастрас нест.",
      ru: "Данных об общественном транспорте для этого маршрута нет.",
      en: "Public transport data is not available for this route.",
    });
  }
  if (r.code === "offline") {
    return pick(lang, {
      tg: "Интернет пайваст нест. Пайвастро санҷед ва дубора кӯшиш кунед.",
      ru: "Нет подключения к интернету. Проверьте соединение и попробуйте снова.",
      en: "You're offline. Check your connection and try again.",
    });
  }
  return pick(lang, {
    tg: "Хадамоти харита ҳоло ҷавоб намедиҳад. Лутфан каме баъдтар дубора кӯшиш кунед.",
    ru: "Картографический сервис сейчас не отвечает. Попробуйте чуть позже.",
    en: "The map service isn't responding right now. Please try again shortly.",
  });
}

/** Chat reply for a finished map command; `href` re-opens the same view. */
export function mapResultMarkdown(result: MapResult, locale: string, opts: { now?: Date; href?: string } = {}): string {
  const lang = langOf(locale);
  const now = opts.now ?? new Date();
  let body: string;
  switch (result.kind) {
    case "places":
      body = !result.places.length
        ? errorSummary({ kind: "error", code: "place_not_found", source: "search" }, lang)
        : result.category
          ? categorySummary(result, lang)
          : placeSummary(result, lang);
      break;
    case "route":
      body = routeSummary(result, lang, now);
      break;
    case "locate":
      body = locateSummary(result, lang);
      break;
    default:
      return errorSummary(result, lang);
  }
  if (!opts.href) return body;
  const label = pick(lang, { tg: "🗺 Дар харита кушоед", ru: "🗺 Открыть на карте", en: "🗺 Open on Map" });
  return `${body}\n\n[${label}](${opts.href})`;
}
