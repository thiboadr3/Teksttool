export function logInfo(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`[info] ${message}`, details);
    return;
  }
  console.info(`[info] ${message}`);
}

export function logError(message: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[error] ${message}: ${error.message}`);
    return;
  }
  console.error(`[error] ${message}`, error);
}

export function logTiming(name: string, startMs: number): number {
  const elapsed = Date.now() - startMs;
  console.info(`[timing] ${name}`, { elapsedMs: elapsed });
  return elapsed;
}
