/**
 * Voice Service
 * 
 * NLP processing and response generation for voice commands.
 * Provides text-to-speech feedback for voice interactions.
 * 
 * @author Roneira AI
 * @version 2026
 */

import { VoiceCommand } from '../hooks/useVoiceCommands';

interface VoiceResponse {
  text: string;
  speak: boolean;
  action?: 'navigate' | 'display' | 'confirm' | 'error';
}

/**
 * Generate a spoken response for a voice command
 */
export const generateResponse = (command: VoiceCommand, context?: Record<string, unknown>): VoiceResponse => {
  switch (command.intent) {
    case 'show_ticker':
      return {
        text: `Showing ${command.entities.ticker}`,
        speak: true,
        action: 'navigate',
      };

    case 'portfolio_value':
      const value = context?.portfolioValue as number;
      if (value !== undefined) {
        return {
          text: `Your portfolio value is ${formatCurrency(value)}`,
          speak: true,
          action: 'display',
        };
      }
      return {
        text: 'Opening portfolio dashboard',
        speak: true,
        action: 'navigate',
      };

    case 'show_predictions':
      return {
        text: `Showing predictions for ${command.entities.ticker}`,
        speak: true,
        action: 'navigate',
      };

    case 'add_stock':
      const { ticker, shares, price } = command.entities;
      if (ticker && shares) {
        const priceText = price ? ` at ${formatCurrency(price)}` : '';
        return {
          text: `Adding ${shares} shares of ${ticker}${priceText}`,
          speak: true,
          action: 'confirm',
        };
      }
      return {
        text: 'Please specify the ticker and number of shares',
        speak: true,
        action: 'error',
      };

    case 'navigate':
      return {
        text: `Opening ${command.entities.destination}`,
        speak: true,
        action: 'navigate',
      };

    case 'unknown':
    default:
      return {
        text: "I didn't understand that command. Try saying 'show me AAPL' or 'what's my portfolio value'",
        speak: true,
        action: 'error',
      };
  }
};

/**
 * Speak text using Web Speech API
 */
export const speak = (text: string, options?: SpeechSynthesisUtterance): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure utterance
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    // Apply custom options
    if (options) {
      Object.assign(utterance, options);
    }

    // Select a good voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural')
    ) || voices.find(v => v.lang.startsWith('en'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error));

    window.speechSynthesis.speak(utterance);
  });
};

/**
 * Format currency value for speech
 */
const formatCurrency = (value: number): string => {
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(2)} crore rupees`;
  }
  if (value >= 100000) {
    return `${(value / 100000).toFixed(2)} lakh rupees`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)} thousand rupees`;
  }
  return `${Math.round(value)} rupees`;
};

/**
 * Get suggestions based on partial input
 */
export const getSuggestions = (partialText: string): string[] => {
  const suggestions: string[] = [];
  const text = partialText.toLowerCase();

  if (text.includes('show') || text.includes('open')) {
    suggestions.push('show me AAPL', 'show portfolio', 'show predictions');
  }
  if (text.includes('what') || text.includes('my')) {
    suggestions.push("what's my portfolio value", 'what is TSLA trading at');
  }
  if (text.includes('add') || text.includes('buy')) {
    suggestions.push('add 10 shares of AAPL', 'buy 5 shares of TSLA');
  }
  if (text.includes('go') || text.includes('navigate')) {
    suggestions.push('go to dashboard', 'go to settings', 'go to portfolio');
  }
  if (text.includes('predict') || text.includes('forecast')) {
    suggestions.push('predict AAPL', 'show predictions for TSLA');
  }

  // Default suggestions if no match
  if (suggestions.length === 0) {
    suggestions.push(
      'show me AAPL',
      "what's my portfolio value",
      'add 10 shares of TSLA',
      'show predictions for GOOGL'
    );
  }

  return suggestions.slice(0, 4);
};

/**
 * Voice command rate limiter
 */
class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests: number = 10, timeWindowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.timeWindow);
    
    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }
    
    this.timestamps.push(now);
    return true;
  }

  getTimeUntilReset(): number {
    if (this.timestamps.length === 0) return 0;
    const oldestTimestamp = Math.min(...this.timestamps);
    return Math.max(0, this.timeWindow - (Date.now() - oldestTimestamp));
  }
}

export const voiceCommandRateLimiter = new RateLimiter(10, 60000);

export default {
  generateResponse,
  speak,
  getSuggestions,
  voiceCommandRateLimiter,
};
