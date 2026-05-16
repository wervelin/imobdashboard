// src/services/googleCalendarCache.ts

interface CacheConfig {
  ttl: number; // segundos
  prefix: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 300, // 5 minutos
  prefix: 'gcal:'
};

/**
 * Serviço de cache para Google Calendar
 * Reduz rate limit ao manter em cache eventos frequentes
 */
export class GoogleCalendarCacheService {
  private static instance: GoogleCalendarCacheService;
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private config: CacheConfig;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<CacheConfig>): GoogleCalendarCacheService {
    if (!GoogleCalendarCacheService.instance) {
      GoogleCalendarCacheService.instance = new GoogleCalendarCacheService(config);
    }
    return GoogleCalendarCacheService.instance;
  }

  /**
   * Gerar chave de cache
   */
  private generateKey(
    calendarId: string,
    operation: string,
    params: Record<string, any> = {}
  ): string {
    const paramStr = JSON.stringify(params);
    return `${this.config.prefix}${calendarId}:${operation}:${paramStr}`;
  }

  /**
   * Obter do cache
   */
  get<T = any>(
    calendarId: string,
    operation: string,
    params?: Record<string, any>
  ): T | null {
    const key = this.generateKey(calendarId, operation, params);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Verificar expiração
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Salvar no cache
   */
  set(
    calendarId: string,
    operation: string,
    data: any,
    ttl?: number,
    params?: Record<string, any>
  ): void {
    const key = this.generateKey(calendarId, operation, params);
    const expiresIn = (ttl || this.config.ttl) * 1000;
    
    this.cache.set(key, {
      data,
      expires: Date.now() + expiresIn
    });
  }

  /**
   * Limpar cache
   */
  clear(calendarId?: string, operation?: string): void {
    if (!calendarId) {
      this.cache.clear();
      return;
    }

    // Limpar chaves que começam com o pattern
    const pattern = `${this.config.prefix}${calendarId}`;
    for (const [key] of this.cache) {
      if (operation) {
        if (key.includes(`${pattern}:${operation}`)) {
          this.cache.delete(key);
        }
      } else {
        if (key.startsWith(pattern)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Tamanho do cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Estatísticas do cache
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; expiresIn: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      expiresIn: Math.max(0, Math.floor((value.expires - Date.now()) / 1000))
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

/**
 * Hook para usar Google Calendar com cache
 */
export function useGoogleCalendarCache(
  calendarCacheTtl: number = 300
) {
  const cacheService = GoogleCalendarCacheService.getInstance({
    ttl: calendarCacheTtl
  });

  return {
    /**
     * Obter eventos com cache
     */
    async getEventsWithCache(
      calendarId: string,
      params: Record<string, any>,
      fetchFn: () => Promise<any>
    ) {
      // Tentar cache primeiro
      const cached = cacheService.get(calendarId, 'getEvents', params);
      if (cached) {
        return cached;
      }

      // Se não tiver cache, buscar e guardar
      try {
        const events = await fetchFn();
        cacheService.set(calendarId, 'getEvents', events, calendarCacheTtl, params);
        return events;
      } catch (error) {
        // Se falhar, retornar cache expirado se existir
        const staleCache = cacheService.get(calendarId, 'getEvents', params);
        if (staleCache) {
          console.warn('Using stale cache due to API error');
          return staleCache;
        }
        throw error;
      }
    },

    /**
     * Obter disponibilidade com cache
     */
    async getAvailabilityWithCache(
      calendarId: string,
      params: Record<string, any>,
      fetchFn: () => Promise<any>
    ) {
      const cached = cacheService.get(calendarId, 'getAvailability', params);
      if (cached) {
        return cached;
      }

      const availability = await fetchFn();
      cacheService.set(calendarId, 'getAvailability', availability, calendarCacheTtl, params);
      return availability;
    },

    /**
     * Invalidar cache após atualização
     */
    invalidateCache(calendarId: string, operation?: string) {
      cacheService.clear(calendarId, operation);
    },

    /**
     * Ver estatísticas
     */
    getStats() {
      return cacheService.getStats();
    }
  };
}
