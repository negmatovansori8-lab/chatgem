import { z } from "zod";

/**
 * Snapshot of the last map result, shared Map → Chat/Voice so follow-ups like
 * "How far is it?" are answered from REAL routing data.
 * Contains destinations + route metrics only — never the user's coordinates.
 */
const metricsSchema = z.object({
  distanceMeters: z.number().nonnegative().max(20_000_000),
  durationSeconds: z.number().nonnegative().max(10_000_000),
});

export const mapContextSchema = z.object({
  category: z.string().max(40).optional(),
  query: z.string().max(240).optional(),
  selectedId: z.string().max(160).optional(),
  /** Metrics were measured from this named start ("Аз Душанбе …"), not from the user. */
  origin: z
    .object({
      name: z.string().max(200),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  places: z
    .array(
      z.object({
        id: z.string().max(160),
        name: z.string().max(200),
        address: z.string().max(400).optional(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        walk: metricsSchema.nullable().optional(),
        drive: metricsSchema.nullable().optional(),
        /** Real public-transport leg, only when the transit provider returned one. */
        transit: metricsSchema.nullable().optional(),
        transitLines: z
          .array(z.object({ vehicle: z.string().max(10), name: z.string().max(40) }))
          .max(8)
          .optional(),
      }),
    )
    .max(5),
  /** False when no public-transport data source is configured. */
  transitAvailable: z.boolean().optional(),
  /** When metrics were computed (ms epoch). */
  updatedAt: z.number(),
  /** Client `Date#getTimezoneOffset()` so the server can print local arrival clocks. */
  tzOffsetMinutes: z.number().min(-900).max(900).optional(),
});

export type MapContext = z.infer<typeof mapContextSchema>;
export type MapContextPlace = MapContext["places"][number];

export const MAP_CONTEXT_TTL_MS = 30 * 60_000;

export function isFreshMapContext(ctx: MapContext | null | undefined, now = Date.now()): ctx is MapContext {
  return Boolean(ctx && ctx.places.length && now - ctx.updatedAt < MAP_CONTEXT_TTL_MS);
}
