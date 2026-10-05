/**
 * The home page hosts two frames on one route: the landing hero (`/`) and the map explorer
 * (`/?view=map`). The query param is the source of truth for which one is showing — HeroSection
 * reads it on load and keeps it in sync as the visitor moves between them — so a refresh stays on
 * the map, and every "back to the map" control can link straight to it.
 *
 * MAP_HREF is the one canonical destination for all of them (sidebar Home, Back to Home, Explore
 * Other States & UTs); use it rather than spelling the URL out, so they can't drift apart.
 */
export const MAP_VIEW_PARAM = 'view';
export const MAP_VIEW_VALUE = 'map';
export const MAP_HREF = `/?${MAP_VIEW_PARAM}=${MAP_VIEW_VALUE}`;
export const LANDING_HREF = '/';
