/** Plain-ASCII, hyphenated identifier for a state name, used in the /state/[name] URL instead of
 * the raw name. Every state name here is just letters and spaces, so this is lossless and
 * type-independent, no encoding is ever needed for the URL segment itself, which sidesteps a
 * `next dev` + `output: export` bug where the dev server matches the raw (percent-encoded)
 * request path against a static param's un-encoded, delimiter-escaped pathname (they can never be
 * equal whenever the segment contains a space), see generateStaticParams in
 * app/state/[name]/page.tsx. */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
