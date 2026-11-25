// Validación de las rutas del registro de sesión (compartida por el servidor de desarrollo y las pruebas).
// Solo se admite «carpeta/archivo» con caracteres seguros: ni rutas anidadas ni «..» (la misma regla que desktop/main.cjs).
// Sin dependencias (ni Vite ni DOM) para poder usarse desde vite.config.ts y desde un test puro.
export const SESSION_REL_RE = /^[0-9A-Za-z_-]{1,40}\/[0-9A-Za-z._-]{1,80}$/;

/** true si `rel` es una ruta relativa de sesión aceptable: «carpeta/archivo», sin escapes. */
export function sessionRelOk(rel: unknown): rel is string {
  if (typeof rel !== "string" || !SESSION_REL_RE.test(rel)) return false;
  const file = rel.slice(rel.indexOf("/") + 1);
  return file !== "." && file !== "..";
}
