/* ══════════════════════════════════════════════════════════════════════
   Canonical roles.

   IMPORTANT: this module governs UI VISIBILITY ONLY. It decides which
   nav items, routes, and buttons a user sees. It is NOT the security
   boundary — a user editing localStorage, React state, or a request
   payload cannot gain real access this way, because every table that
   matters enforces its own authorization via Supabase RLS policies
   (is_super_admin() / is_school_admin() / auth_school_id() / etc.,
   defined in the database) regardless of what the frontend thinks the
   user's role is. See the RLS migrations for the actual enforcement.

   The five roles, stored in the database as lowercase snake_case
   (unchanged from existing data — no migration risk), with 'principal'
   kept as a grandfathered alias for school_admin (the DB helper
   is_school_admin() already treats them the same).
═══════════════════════════════════════════════════════════════════════ */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
  BURSAR: 'bursar',
  TIMETABLER: 'timetabler',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Legacy/alternate spellings seen historically in this codebase
// ('SuperAdmin', 'Admin', 'Principal', etc.) — mapped here once so every
// caller gets a canonical value instead of re-implementing this switch.
const LEGACY_ALIASES: Record<string, Role> = {
  superadmin: ROLES.SUPER_ADMIN,
  admin: ROLES.SCHOOL_ADMIN,
  schooladmin: ROLES.SCHOOL_ADMIN,
  principal: ROLES.SCHOOL_ADMIN,
  teacher: ROLES.TEACHER,
  bursar: ROLES.BURSAR,
  timetabler: ROLES.TIMETABLER,
};

/** Normalizes any historical role spelling to one of the 5 canonical
 * values. Returns null for anything unrecognized rather than guessing. */
export function normalizeRole(raw: string | null | undefined): Role | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[_\s-]/g, '');
  return LEGACY_ALIASES[key] ?? null;
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.SUPER_ADMIN;
}

export function isSchoolAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.SCHOOL_ADMIN;
}

/** Super admin OR school admin — matches the DB's is_admin_or_above(). */
export function isAdminOrAbove(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === ROLES.SUPER_ADMIN || r === ROLES.SCHOOL_ADMIN;
}

export function isBursar(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.BURSAR;
}

export function isTimetabler(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.TIMETABLER;
}

/** Human-readable label for display (badges, headers, etc.). */
export function roleLabel(role: string | null | undefined): string {
  switch (normalizeRole(role)) {
    case ROLES.SUPER_ADMIN: return 'Super Admin';
    case ROLES.SCHOOL_ADMIN: return 'School Admin';
    case ROLES.TEACHER: return 'Teacher';
    case ROLES.BURSAR: return 'Bursar';
    case ROLES.TIMETABLER: return 'Timetabler';
    default: return role || 'Unknown';
  }
}
