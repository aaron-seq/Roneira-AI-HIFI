/**
 * Application Configuration
 *
 * Centralized configuration for the frontend application
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

export class ApplicationConfiguration {
  public readonly apiBaseUrl: string;
  public readonly appName: string;
  public readonly appVersion: string;
  public readonly isDevelopment: boolean;
  public readonly wsEndpoint: string;

  constructor() {
    this.isDevelopment = import.meta.env.MODE === "development";

    this.apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      (this.isDevelopment
        ? "http://localhost:3001"
        : "https://api.roneira-hifi.com");

    this.wsEndpoint =
      import.meta.env.VITE_WS_ENDPOINT ||
      (this.isDevelopment
        ? "ws://localhost:3001"
        : "wss://api.roneira-hifi.com");

    this.appName = import.meta.env.VITE_APP_NAME || "Roneira AI HIFI";
    this.appVersion = import.meta.env.VITE_APP_VERSION || "2.0.0";
  }

  public getFullApiUrl(endpoint: string): string {
    return `${this.apiBaseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  }
}
