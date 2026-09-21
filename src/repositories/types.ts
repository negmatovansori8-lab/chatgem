/**
 * Repository layer placeholder.
 * Concrete Prisma repositories are implemented as features unlock.
 */
export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
