export function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function configCommandError(message: string) {
  return {
    errorCode: "CONFIG_ERROR",
    message,
    suggestedFix: "Check your spana.config.ts for syntax errors or invalid values.",
  };
}
