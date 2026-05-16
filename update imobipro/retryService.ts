// src/services/retryService.ts

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true
};

/**
 * Calcular delay com backoff exponencial
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  
  // Clampar ao máximo
  delay = Math.min(delay, config.maxDelayMs);

  // Adicionar jitter (±25%)
  if (config.jitter) {
    const jitterAmount = delay * 0.25;
    delay = delay + (Math.random() - 0.5) * 2 * jitterAmount;
  }

  return Math.round(Math.max(0, delay));
}

/**
 * Fazer retry de uma Promise com exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Se foi a última tentativa, lançar erro
      if (attempt === finalConfig.maxRetries) {
        break;
      }

      // Calcular delay e esperar
      const delay = calculateDelay(attempt, finalConfig);
      console.warn(
        `[Retry] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} failed. Retrying in ${delay}ms...`,
        lastError.message
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `Failed after ${finalConfig.maxRetries + 1} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Hook para fazer retry de requisições HTTP
 */
export function useRetryableHttp(config?: Partial<RetryConfig>) {
  return {
    /**
     * Fazer GET com retry
     */
    async get<T = any>(
      url: string,
      init?: RequestInit
    ): Promise<T> {
      return retryWithBackoff(async () => {
        const response = await fetch(url, { ...init, method: 'GET' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      }, config);
    },

    /**
     * Fazer POST com retry
     */
    async post<T = any>(
      url: string,
      data?: any,
      init?: RequestInit
    ): Promise<T> {
      return retryWithBackoff(async () => {
        const response = await fetch(url, {
          ...init,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...init?.headers
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      }, config);
    },

    /**
     * Fazer requisição genérica com retry
     */
    async fetch<T = any>(
      url: string,
      init?: RequestInit
    ): Promise<T> {
      return retryWithBackoff(async () => {
        const response = await fetch(url, init);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      }, config);
    }
  };
}

/**
 * Wrapper para async functions com retry
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, onRetry } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt, error as Error);
      }

      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw new Error('Retry failed');
}

/**
 * Circuit Breaker para evitar cascata de falhas
 */
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  
  constructor(
    private maxFailures: number = 5,
    private resetTimeoutMs: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Se circuito aberto e timeout passou, tentar half-open
    if (this.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 2) {
          this.state = 'CLOSED';
          this.failureCount = 0;
          this.successCount = 0;
        }
      } else if (this.state === 'CLOSED') {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.maxFailures) {
        this.state = 'OPEN';
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount
    };
  }
}
