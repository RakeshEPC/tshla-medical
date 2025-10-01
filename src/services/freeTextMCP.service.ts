import { logError, logWarn, logInfo, logDebug } from './logger.service';
interface FreeTextAnalysis {
  currentSituation: string;
  fears: string;
  excitement: string;
  wordCount: number;
  sentimentScore: number;
  keyThemes: string;
}

interface FreeTextResponse {
  id: string;
  sessionId: string;
  currentSituation: string;
  fears: string;
  excitement: string;
  fullResponse: string;
  wordCount: number;
  sentimentScore: number;
  keyThemes: string;
  createdAt: number;
  updatedAt: number;
}

interface SaveFreeTextResult {
  success: boolean;
  responseId: string;
  sessionId: string;
  wordCount: number;
  timestamp: number;
}

interface GetFreeTextResult {
  success: boolean;
  response: FreeTextResponse | null;
}

class FreeTextMCPService {
  private mcpEndpoint = ''; // Disabled - using local storage only

  /**
   * Save free text response to MCP server (with fallback)
   */
  async saveFreeTextResponse(
    sessionId: string,
    freeText: string,
    analysis?: Partial<FreeTextAnalysis>
  ): Promise<SaveFreeTextResult> {
    try {
      logDebug('freeTextMCP', 'Debug message', {});

      const payload = {
        tool: 'save_free_text_response',
        args: {
          sessionId,
          freeText,
          analysis: analysis
            ? {
                currentSituation: analysis.currentSituation || '',
                fears: analysis.fears || '',
                excitement: analysis.excitement || '',
                wordCount: analysis.wordCount || freeText.split(' ').length,
                sentimentScore: analysis.sentimentScore || 0.0,
                keyThemes: analysis.keyThemes || '',
              }
            : undefined,
        },
      };

      const response = await fetch(this.mcpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.status}`);
      }

      const result = await response.json();
      logInfo('freeTextMCP', 'Info message', {});

      return result;
    } catch (error) {
      logWarn('freeTextMCP', 'Warning message', {});

      // Return a mock success response - the important data is already in sessionStorage
      return {
        success: true,
        responseId: `local_${sessionId}_${Date.now()}`,
        sessionId,
        wordCount: freeText.split(' ').filter(word => word.length > 0).length,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get free text response from MCP server (with fallback)
   */
  async getFreeTextResponse(sessionId: string): Promise<GetFreeTextResult> {
    try {
      logDebug('freeTextMCP', 'Debug message', {});

      const payload = {
        tool: 'get_free_text_response',
        args: {
          sessionId,
        },
      };

      const response = await fetch(this.mcpEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.status}`);
      }

      const result = await response.json();
      logInfo('freeTextMCP', 'Info message', {});

      return result;
    } catch (error) {
      logWarn('freeTextMCP', 'Warning message', {});

      // Try to get data from sessionStorage as fallback
      try {
        const storedData = sessionStorage.getItem('pumpDriveFreeText');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          return {
            success: true,
            response: {
              id: `local_${sessionId}`,
              sessionId,
              currentSituation: parsedData.currentSituation || '',
              fears: '',
              excitement: '',
              fullResponse: parsedData.currentSituation || '',
              wordCount:
                parsedData.currentSituation?.split(' ').filter((w: string) => w.length > 0)
                  .length || 0,
              sentimentScore: 0,
              keyThemes: '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          };
        }
      } catch (storageError) {
        logWarn('freeTextMCP', 'Warning message', {});
      }

      return {
        success: false,
        response: null,
      };
    }
  }

  /**
   * Analyze free text for themes, sentiment, and categorization
   */
  analyzeText(text: string): Partial<FreeTextAnalysis> {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Simple sentiment analysis based on keywords
    const positiveWords = [
      'excited',
      'better',
      'improved',
      'freedom',
      'easier',
      'love',
      'good',
      'great',
      'amazing',
      'happy',
    ];
    const negativeWords = [
      'scared',
      'worried',
      'difficult',
      'hard',
      'problem',
      'issue',
      'hate',
      'bad',
      'terrible',
      'afraid',
    ];
    const fearWords = ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'concern', 'fear'];
    const excitementWords = ['excited', 'looking forward', "can't wait", 'thrilled', 'eager'];

    let positiveCount = 0;
    let negativeCount = 0;
    let fearCount = 0;
    let excitementCount = 0;

    const lowerText = text.toLowerCase();

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++;
    });

    fearWords.forEach(word => {
      if (lowerText.includes(word)) fearCount++;
    });

    excitementWords.forEach(word => {
      if (lowerText.includes(word)) excitementCount++;
    });

    // Calculate sentiment score (-1 to 1)
    const sentimentScore =
      positiveCount > 0 || negativeCount > 0
        ? (positiveCount - negativeCount) / (positiveCount + negativeCount)
        : 0;

    // Extract key themes based on common pump-related topics
    const themes = [];
    if (
      lowerText.includes('current') ||
      lowerText.includes('now') ||
      lowerText.includes('currently')
    ) {
      themes.push('current situation');
    }
    if (lowerText.includes('cgm') || lowerText.includes('sensor')) {
      themes.push('CGM/sensors');
    }
    if (lowerText.includes('tube') || lowerText.includes('tubing')) {
      themes.push('tubing concerns');
    }
    if (lowerText.includes('battery') || lowerText.includes('charging')) {
      themes.push('power/battery');
    }
    if (lowerText.includes('control') || lowerText.includes('management')) {
      themes.push('diabetes control');
    }
    if (
      lowerText.includes('exercise') ||
      lowerText.includes('activity') ||
      lowerText.includes('sport')
    ) {
      themes.push('physical activity');
    }

    return {
      wordCount,
      sentimentScore: Math.round(sentimentScore * 100) / 100, // Round to 2 decimal places
      keyThemes: themes.join(', '),
      fears: fearCount > 0 ? 'Mentions fears/concerns' : '',
      excitement: excitementCount > 0 ? 'Expresses excitement' : '',
    };
  }

  /**
   * Generate a session ID for tracking user responses
   */
  generateSessionId(): string {
    return `ft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const freeTextMCPService = new FreeTextMCPService();
export type { FreeTextResponse, FreeTextAnalysis, SaveFreeTextResult, GetFreeTextResult };
