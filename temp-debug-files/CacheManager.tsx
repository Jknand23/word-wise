import React, { useState, useEffect } from 'react';
import { cacheService, type CacheStats } from '../../services/cacheService';
import { useAuthStore } from '../../store/authStore';

interface CacheManagerProps {
  className?: string;
}

export const CacheManager: React.FC<CacheManagerProps> = ({ className = '' }) => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<CacheStats>({
    totalEntries: 0,
    hitRate: 0,
    tokensSaved: 0,
    avgAccessCount: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStats = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      const cacheStats = await cacheService.getCacheStats(user.uid);
      setStats(cacheStats);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = async () => {
    if (!user?.uid) return;
    
    if (!confirm('Are you sure you want to clear all cached analysis results? This cannot be undone.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await cacheService.clearUserCache(user.uid);
      await loadStats(); // Refresh stats
      alert('Cache cleared successfully!');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearExpiredEntries = async () => {
    setIsLoading(true);
    try {
      const clearedCount = await cacheService.clearExpiredEntries();
      await loadStats(); // Refresh stats
      alert(`Cleared ${clearedCount} expired cache entries.`);
    } catch (error) {
      console.error('Failed to clear expired entries:', error);
      alert('Failed to clear expired entries. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user?.uid]);

  const formatTokensSaved = (tokens: number): string => {
    if (tokens < 1000) return tokens.toString();
    if (tokens < 1000000) return (tokens / 1000).toFixed(1) + 'K';
    return (tokens / 1000000).toFixed(1) + 'M';
  };

  const getPerformanceColor = (hitRate: number) => {
    if (hitRate >= 0.6) return 'text-green-600';
    if (hitRate >= 0.3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEfficiencyEmoji = (hitRate: number) => {
    if (hitRate >= 0.7) return '🎉';
    if (hitRate >= 0.5) return '👍';
    if (hitRate >= 0.3) return '⚠️';
    return '❌';
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Cache Performance Monitor
        </h3>
        <div className="flex gap-2">
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50"
          >
            {isLoading ? '🔄' : '↻'} Refresh
          </button>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-500 mb-4">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Cache Entries</div>
          <div className="text-xl font-bold text-gray-900">
            {stats.totalEntries}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Hit Rate</div>
          <div className={`text-xl font-bold ${getPerformanceColor(stats.hitRate)}`}>
            {(stats.hitRate * 100).toFixed(1)}%
            <span className="ml-1">{getEfficiencyEmoji(stats.hitRate)}</span>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Tokens Saved</div>
          <div className="text-xl font-bold text-green-600">
            {formatTokensSaved(stats.tokensSaved)}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Avg Access</div>
          <div className="text-xl font-bold text-gray-900">
            {stats.avgAccessCount.toFixed(1)}
          </div>
        </div>
      </div>

      {stats.oldestEntry && stats.newestEntry && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Cache Age Range:</strong>
            <br />
            Oldest: {stats.oldestEntry.toLocaleDateString()} at {stats.oldestEntry.toLocaleTimeString()}
            <br />
            Newest: {stats.newestEntry.toLocaleDateString()} at {stats.newestEntry.toLocaleTimeString()}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Performance Insights</h4>
          <div className="text-sm text-yellow-700 space-y-1">
            {stats.hitRate >= 0.6 && (
              <p>✅ Excellent cache performance! You're saving significant processing time.</p>
            )}
            {stats.hitRate >= 0.3 && stats.hitRate < 0.6 && (
              <p>👍 Good cache performance. Cache is providing moderate savings.</p>
            )}
            {stats.hitRate < 0.3 && stats.totalEntries > 5 && (
              <p>⚠️ Low cache hit rate. Consider reviewing your writing patterns.</p>
            )}
            {stats.totalEntries === 0 && (
              <p>ℹ️ No cached entries yet. Cache will build up as you use AI analysis.</p>
            )}
            {stats.tokensSaved > 10000 && (
              <p>🎉 You've saved over {formatTokensSaved(stats.tokensSaved)} tokens through caching!</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={clearExpiredEntries}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 disabled:opacity-50 text-sm"
          >
            🧹 Clear Expired
          </button>
          
          <button
            onClick={clearCache}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50 text-sm"
          >
            🗑️ Clear All Cache
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <details className="group">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            📊 Technical Details
          </summary>
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <p>• Cache entries expire after 24 hours automatically</p>
            <p>• Maximum 1000 entries per user to prevent unlimited growth</p>
            <p>• Hit rate = (entries with access count > 0) / total entries</p>
            <p>• Token savings = estimated tokens saved by cache hits</p>
            <p>• Cache uses content hash + writing goals for key generation</p>
          </div>
        </details>
      </div>
    </div>
  );
}; 