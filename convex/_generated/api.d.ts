/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as analytics from "../analytics.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as emailMonitor from "../emailMonitor.js";
import type * as linkedin from "../linkedin.js";
import type * as monitoring from "../monitoring.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  crm: typeof crm;
  crons: typeof crons;
  documents: typeof documents;
  emailMonitor: typeof emailMonitor;
  linkedin: typeof linkedin;
  monitoring: typeof monitoring;
  profiles: typeof profiles;
  seed: typeof seed;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
