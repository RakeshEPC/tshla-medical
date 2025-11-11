export const endpoints = {
  // FIXED: Using correct unified API endpoint (deployed on Azure Container Apps)
  // Previous URL 'tshla-backend-api.azurewebsites.net' does not exist
  openapi: 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/openapi.json',
  recommendPump: 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/pumpdrive/recommend',
  // legacy (unused, but kept for reference)
  recommend: 'https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/recommend',
};
