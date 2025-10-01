export function who(req: Request): { id: string; name?: string; email?: string } | null {
  try {
    const h: any = (req as any).headers;

    // Check for session ID in headers (set by middleware)
    const sessionId = h?.get?.('x-session-id');
    if (sessionId) {
      // In production, this would validate against session store
      // For now, return a placeholder
      return {
        id: sessionId.substring(0, 8),
        name: 'Authenticated User',
        email: 'user@tshla.ai',
      };
    }

    // No valid session
    return null;
  } catch {
    return null;
  }
}
