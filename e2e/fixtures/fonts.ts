import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Material Icons font the production build links from Google Fonts, vendored here (Apache 2.0,
 * fonts.gstatic.com/s/materialicons/v145/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2) so specs can serve it
 * without the network. Without it every `<mat-icon>` renders its ligature name ("favorite_border")
 * as plain text, which changes the layout and makes axe report each icon button's text as a
 * label/name mismatch: axe recognises icon-ligature text only when the icon font is loaded.
 * The text fonts (Cairo, IBM Plex) stay blocked; they only change glyph shapes.
 */
export const MATERIAL_ICONS_PATH = '/s/materialicons/';
export const MATERIAL_ICONS_WOFF2 = readFileSync(join(__dirname, 'fonts', 'material-icons.woff2'));
