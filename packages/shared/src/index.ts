/*
 * Public entry point for the shared package.
 *
 * Everything the API and web application must agree upon is re-exported
 * here: entity types, API response shapes, Zod validation schemas and
 * domain constants.
 *
 * Nothing in this package may import Prisma or any server-only dependency.
 * The contents are bundled into the browser, so a database import would
 * either fail the build or leak server code to the client.
 */

export {};