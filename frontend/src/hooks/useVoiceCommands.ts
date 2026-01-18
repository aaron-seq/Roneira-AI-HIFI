/**
 * useVoiceCommands Hook
 * 
 * Web Speech API integration for voice command processing.
 * Handles speech recognition and command parsing.
 * 
 * @author Roneira AI
 * @version 2026
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceState } from '../components/voice/VoiceCommandButton';

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: () => void;
  onend: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onspeechend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface VoiceCommand {
  intent: 'show_ticker' | 'portfolio_value' | 'show_predictions' | 'add_stock' | 'remove_stock' | 'navigate' | 'unknown';
  entities: {
    ticker?: string;
    shares?: number;
    price?: number;
    destination?: string;
  };
  rawText: string;
  confidence: number;
}

interface UseVoiceCommandsOptions {
  onCommand?: (command: VoiceCommand) => void;
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
}

interface UseVoiceCommandsReturn {
  state: VoiceState;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  isSupported: boolean;
  lastCommand: VoiceCommand | null;
}

// Common ticker aliases for fuzzy matching
const tickerAliases: Record<string, string> = {
  'apple': 'AAPL',
  'google': 'GOOGL',
  'alphabet': 'GOOGL',
  'microsoft': 'MSFT',
  'amazon': 'AMZN',
  'tesla': 'TSLA',
  'nvidia': 'NVDA',
  'meta': 'META',
  'facebook': 'META',
  'netflix': 'NFLX',
  'reliance': 'RELIANCE',
  'tata': 'TCS',
  'infosys': 'INFY',
  'hdfc': 'HDFCBANK',
  'icici': 'ICICIBANK',
};

// Parse command from transcript
const parseCommand = (transcript: string): VoiceCommand => {
  const text = transcript.toLowerCase().trim();
  
  // Default result
  const result: VoiceCommand = {
    intent: 'unknown',
    entities: {},
    rawText: transcript,
    confidence: 0,
  };

  // Show ticker command
  // "show me AAPL", "open apple", "go to tesla"
  const showTickerPatterns = [
    /(?:show|open|go to|display|view)\s+(?:me\s+)?(?:the\s+)?(\w+)/i,
    /what(?:'s| is)\s+(\w+)\s+(?:price|stock|trading at)/i,
    /(\w+)\s+(?:stock|price|chart)/i,
  ];

  for (const pattern of showTickerPatterns) {
    const match = text.match(pattern);
    if (match) {
      const tickerOrName = match[1].toUpperCase();
      result.intent = 'show_ticker';
      result.entities.ticker = tickerAliases[match[1].toLowerCase()] || tickerOrName;
      result.confidence = 0.8;
      return result;
    }
  }

  // Portfolio value command
  // "what's my portfolio value", "show portfolio", "my total value"
  if (/(?:portfolio|total)\s+(?:value|worth|amount)|my\s+(?:portfolio|holdings|investments)/i.test(text)) {
    result.intent = 'portfolio_value';
    result.confidence = 0.9;
    return result;
  }

  // Show predictions command
  // "show predictions for AAPL", "predict tesla", "forecast for google"
  const predictionPatterns = [
    /(?:show|get|display)\s+(?:predictions?|forecast)\s+(?:for\s+)?(\w+)/i,
    /predict(?:ions?)?\s+(?:for\s+)?(\w+)/i,
    /forecast\s+(?:for\s+)?(\w+)/i,
  ];

  for (const pattern of predictionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const tickerOrName = match[1].toUpperCase();
      result.intent = 'show_predictions';
      result.entities.ticker = tickerAliases[match[1].toLowerCase()] || tickerOrName;
      result.confidence = 0.8;
      return result;
    }
  }

  // Add stock command
  // "add 10 shares of AAPL", "buy 5 tesla at 200"
  const addStockPattern = /(?:add|buy)\s+(\d+)\s+(?:shares?\s+(?:of\s+)?)?(\w+)(?:\s+at\s+(\d+(?:\.\d+)?))?/i;
  const addMatch = text.match(addStockPattern);
  if (addMatch) {
    result.intent = 'add_stock';
    result.entities.shares = parseInt(addMatch[1], 10);
    result.entities.ticker = tickerAliases[addMatch[2].toLowerCase()] || addMatch[2].toUpperCase();
    if (addMatch[3]) {
      result.entities.price = parseFloat(addMatch[3]);
    }
    result.confidence = 0.85;
    return result;
  }

  // Navigation commands
  // "go to dashboard", "open settings", "show news"
  const navPatterns = [
    /(?:go to|open|show|navigate to)\s+(?:the\s+)?(\w+)/i,
  ];

  const destinations = ['dashboard', 'portfolio', 'analysis', 'predictions', 'news', 'settings'];
  for (const pattern of navPatterns) {
    const match = text.match(pattern);
    if (match && destinations.includes(match[1].toLowerCase())) {
      result.intent = 'navigate';
      result.entities.destination = match[1].toLowerCase();
      result.confidence = 0.9;
      return result;
    }
  }

  return result;
};

export const useVoiceCommands = (options: UseVoiceCommandsOptions = {}): UseVoiceCommandsReturn => {
  const {
    onCommand,
    onTranscript,
    onError,
    language = 'en-US',
    continuous = false,
  } = options;

  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check if Speech Recognition is supported
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      setTranscript('');
    };

    recognition.onend = () => {
      setState('idle');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);
      onTranscript?.(currentTranscript);

      if (finalTranscript) {
        setState('processing');
        const command = parseCommand(finalTranscript);
        setLastCommand(command);
        onCommand?.(command);
        
        // Reset to idle after processing
        setTimeout(() => setState('idle'), 1000);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setState('error');
      onError?.(event.error);
      
      // Reset to idle after showing error
      setTimeout(() => setState('idle'), 2000);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported, language, continuous, onCommand, onTranscript, onError]);

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      onError?.('Speech recognition not supported');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      // Already started - ignore
    }
  }, [isSupported, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle') {
      startListening();
    }
  }, [state, startListening, stopListening]);

  return {
    state,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    isSupported,
    lastCommand,
  };
};

export default useVoiceCommands;
