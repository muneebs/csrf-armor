// Next.js CSRF protection package
export { createCsrfMiddleware } from "./middleware.js";
export * from "./client.js";
export * from "./react.js";

export type {
  CsrfConfig,
  CsrfStrategy,
  CookieOptions,
  TokenOptions,
  ValidationResult,
  CsrfProtectResult,
} from "@csrf-armor/core";

export {
  generateSignedToken,
  parseSignedToken,
  signUnsignedToken,
  verifySignedToken,
  generateNonce,
} from "@csrf-armor/core";
