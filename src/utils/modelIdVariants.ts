/** BotHub Batch API — отдельные эндпоинты для асинхронной пакетной обработки, не для chat/inference. */
export function isBatchInferenceModelId(name: string): boolean {
  return name.trim().toLowerCase().endsWith(':batch');
}
