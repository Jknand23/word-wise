// Centralized Logging Utility for WordWise AI
// Controls console output levels and reduces spam during development

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silent';

interface LogConfig {
  level: LogLevel;
  enablePerformanceMetrics: boolean;
  enableDifferentialAnalysis: boolean;
  enableCacheLogging: boolean;
  enableDebouncing: boolean;
  enableTestSuites: boolean;
}

class Logger {
  private config: LogConfig = {
    // Default to minimal logging in production, more verbose in development
    level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
    enablePerformanceMetrics: process.env.NODE_ENV === 'development',
    enableDifferentialAnalysis: false, // Disabled by default - too verbose
    enableCacheLogging: false,
    enableDebouncing: false,
    enableTestSuites: process.env.NODE_ENV === 'development'
  };

  private levels: Record<LogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    verbose: 5
  };

  constructor() {
    // Allow override via URL parameters in development
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      // Enable debug logging with ?debug=true
      if (params.get('debug') === 'true') {
        this.config.level = 'debug';
        this.config.enableDifferentialAnalysis = true;
        this.config.enableCacheLogging = true;
        this.config.enableDebouncing = true;
      }
      
      // Enable verbose logging with ?verbose=true
      if (params.get('verbose') === 'true') {
        this.config.level = 'verbose';
        this.config.enableDifferentialAnalysis = true;
        this.config.enableCacheLogging = true;
        this.config.enableDebouncing = true;
        this.config.enablePerformanceMetrics = true;
      }
      
      // Disable all logging with ?silent=true
      if (params.get('silent') === 'true') {
        this.config.level = 'silent';
        this.config.enablePerformanceMetrics = false;
        this.config.enableDifferentialAnalysis = false;
        this.config.enableCacheLogging = false;
        this.config.enableDebouncing = false;
        this.config.enableTestSuites = false;
      }
    }
  }

  private shouldLog(level: LogLevel, category?: string): boolean {
    if (this.levels[this.config.level] < this.levels[level]) {
      return false;
    }

    // Category-specific filtering
    if (category === 'differential' && !this.config.enableDifferentialAnalysis) {
      return false;
    }
    if (category === 'cache' && !this.config.enableCacheLogging) {
      return false;
    }
    if (category === 'debounce' && !this.config.enableDebouncing) {
      return false;
    }
    if (category === 'performance' && !this.config.enablePerformanceMetrics) {
      return false;
    }
    if (category === 'test' && !this.config.enableTestSuites) {
      return false;
    }

    return true;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`🚨 [ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ [WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`ℹ️ [INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`🐛 [DEBUG] ${message}`, ...args);
    }
  }

  verbose(message: string, ...args: any[]): void {
    if (this.shouldLog('verbose')) {
      console.log(`🔍 [VERBOSE] ${message}`, ...args);
    }
  }

  // Category-specific loggers
  differential(message: string, ...args: any[]): void {
    if (this.shouldLog('debug', 'differential')) {
      console.log(`🔍 [DIFFERENTIAL] ${message}`, ...args);
    }
  }

  cache(message: string, ...args: any[]): void {
    if (this.shouldLog('debug', 'cache')) {
      console.log(`💾 [CACHE] ${message}`, ...args);
    }
  }

  performance(message: string, ...args: any[]): void {
    if (this.shouldLog('info', 'performance')) {
      console.log(`📊 [PERFORMANCE] ${message}`, ...args);
    }
  }

  debounce(message: string, ...args: any[]): void {
    if (this.shouldLog('debug', 'debounce')) {
      console.log(`⚡ [DEBOUNCE] ${message}`, ...args);
    }
  }

  test(message: string, ...args: any[]): void {
    if (this.shouldLog('info', 'test')) {
      console.log(`🧪 [TEST] ${message}`, ...args);
    }
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  enableCategory(category: keyof Omit<LogConfig, 'level'>): void {
    this.config[category] = true;
  }

  disableCategory(category: keyof Omit<LogConfig, 'level'>): void {
    this.config[category] = false;
  }

  getCurrentConfig(): LogConfig {
    return { ...this.config };
  }

  // Development helpers
  showConfig(): void {
    if (process.env.NODE_ENV === 'development') {
      console.table(this.config);
      console.log('💡 To control logging, add URL parameters:');
      console.log('   ?debug=true    - Enable debug logging');
      console.log('   ?verbose=true  - Enable all logging');
      console.log('   ?silent=true   - Disable all logging');
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Development convenience - expose to window for debugging
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).logger = logger;
} 