// Vercel serverless entry — re-exports the self-contained Express handler that `ng build`
// bundles into dist/tawasol/server/server.mjs (see src/server.ts). vercel.json's
// functions.api/index.mjs.includeFiles is what makes that dist folder reachable here.
export default async (req, res) => {
  const { reqHandler } = await import('../dist/tawasol/server/server.mjs');
  return reqHandler(req, res);
};
