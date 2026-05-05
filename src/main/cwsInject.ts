/**
 * Compiles the CWS inject content script from TypeScript to JS
 * by stripping types at runtime using ts-blank-space.
 * The source is inlined at build time via Vite's ?raw import.
 */
import tsBlankSpaceModule from "ts-blank-space";
import contentSource from "./cwsInject.content.ts?raw";

// Handle CJS interop - ts-blank-space exports as ESM default
const tsBlankSpace =
  typeof tsBlankSpaceModule === "function"
    ? tsBlankSpaceModule
    : (tsBlankSpaceModule as any).default;

const stripped = tsBlankSpace(contentSource).replace(
  /^export\s*\{\s*\}\s*;?\s*/gm,
  "",
);

export const CWS_INJECT_SCRIPT = stripped + "\nvoid(0);";
