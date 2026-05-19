/** Non-blocking kick of full-Greece catalogue build (search / explicit warm only). */
let warmRequested = false;

export function kickMerchantCatalogueWarmClient(): void {
  if (warmRequested) return;
  warmRequested = true;
  void fetch("/api/merchants-geojson?scope=warm", { method: "GET" }).catch(() => undefined);
}
