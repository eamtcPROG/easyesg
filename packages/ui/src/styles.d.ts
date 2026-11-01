/**
 * CSS-module shape for this package's own typecheck. Consumers do not load this file:
 * `apps/web` gets the same declaration from `next-env.d.ts` and `apps/admin` from
 * `vite/client` — each bundler ships its own, which is why this one is not exported.
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
