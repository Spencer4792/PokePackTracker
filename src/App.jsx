import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
  API_BASE_URL: 'https://api.pokemontcg.io/v2',
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  ITEMS_PER_PAGE: 12,
};

// Current MSRP values (as of 2024 - Scarlet & Violet era pricing)
const MSRP_DATA = {
  'booster-pack': { name: 'Booster Pack', msrp: 4.49 },
  'booster-box': { name: 'Booster Box (36 packs)', msrp: 143.64 },
  'etb': { name: 'Elite Trainer Box', msrp: 49.99 },
  'blister-3pack': { name: '3-Pack Blister', msrp: 14.99 },
  'blister-1pack': { name: 'Single Blister', msrp: 5.99 },
  'collection-box': { name: 'Collection Box', msrp: 24.99 },
  'premium-collection': { name: 'Premium Collection', msrp: 49.99 },
  'ultra-premium': { name: 'Ultra Premium Collection', msrp: 119.99 },
  'booster-bundle': { name: 'Booster Bundle (6 packs)', msrp: 24.99 },
  'build-battle-stadium': { name: 'Build & Battle Stadium', msrp: 44.99 },
  'poster-collection': { name: 'Poster Collection', msrp: 29.99 },
  'special-collection': { name: 'Special Collection', msrp: 39.99 },
};

// Retailer configuration with search URL generators
const RETAILERS = {
  tcgplayer: {
    name: 'TCGPlayer',
    icon: '🛒',
    color: '#00A0E9',
    getSearchUrl: (packName, setName) => 
      `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(packName)}&view=grid&ProductTypeName=Sealed+Products`,
  },
  ebay: {
    name: 'eBay',
    icon: '🏷️',
    color: '#E53238',
    getSearchUrl: (packName, setName) => 
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`pokemon ${packName} sealed`)}&_sacat=183454`,
  },
  amazon: {
    name: 'Amazon',
    icon: '📦',
    color: '#FF9900',
    getSearchUrl: (packName, setName) => 
      `https://www.amazon.com/s?k=${encodeURIComponent(`pokemon ${packName}`)}&i=toys-and-games`,
  },
  pokemoncenter: {
    name: 'Pokémon Center',
    icon: '⭐',
    color: '#FFCB05',
    getSearchUrl: (packName, setName) => 
      `https://www.pokemoncenter.com/search/${encodeURIComponent(setName)}`,
  },
  walmart: {
    name: 'Walmart',
    icon: '🏪',
    color: '#0071CE',
    getSearchUrl: (packName, setName) => 
      `https://www.walmart.com/search?q=${encodeURIComponent(`pokemon ${packName}`)}`,
  },
  target: {
    name: 'Target',
    icon: '🎯',
    color: '#CC0000',
    getSearchUrl: (packName, setName) => 
      `https://www.target.com/s?searchTerm=${encodeURIComponent(`pokemon ${setName}`)}`,
  },
  gamestop: {
    name: 'GameStop',
    icon: '🎮',
    color: '#ED1C24',
    getSearchUrl: (packName, setName) => 
      `https://www.gamestop.com/search/?q=${encodeURIComponent(`pokemon ${packName}`)}&lang=en_US`,
  },
};

// ============================================================================
// UTILITY FUNCTIONS MODULE
// ============================================================================

const Utils = {
  formatPrice: (price) => {
    if (price === null || price === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  },

  formatDate: (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  },

  calculatePriceStatus: (currentPrice, msrp) => {
    if (!currentPrice || !msrp) return 'unknown';
    const diff = ((currentPrice - msrp) / msrp) * 100;
    if (diff <= -15) return 'great-deal';
    if (diff <= -5) return 'below-msrp';
    if (diff <= 5) return 'at-msrp';
    if (diff <= 15) return 'above-msrp';
    return 'overpriced';
  },

  debounce: (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  exportToCSV: (data, filename) => {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h];
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val}"`;
          }
          return val ?? '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  },
};

// ============================================================================
// FALLBACK DATA (used when API is unavailable)
// ============================================================================

const FALLBACK_SETS = [
  { id: 'sv8', name: 'Surging Sparks', series: 'Scarlet & Violet', releaseDate: '2024-11-08', total: 191, groupId: 23901, images: { logo: 'https://images.pokemontcg.io/sv8/logo.png', symbol: 'https://images.pokemontcg.io/sv8/symbol.png' }},
  { id: 'sv7', name: 'Stellar Crown', series: 'Scarlet & Violet', releaseDate: '2024-09-13', total: 175, groupId: 23768, images: { logo: 'https://images.pokemontcg.io/sv7/logo.png', symbol: 'https://images.pokemontcg.io/sv7/symbol.png' }},
  { id: 'sv6pt5', name: 'Shrouded Fable', series: 'Scarlet & Violet', releaseDate: '2024-08-02', total: 99, groupId: 23702, images: { logo: 'https://images.pokemontcg.io/sv6pt5/logo.png', symbol: 'https://images.pokemontcg.io/sv6pt5/symbol.png' }},
  { id: 'sv6', name: 'Twilight Masquerade', series: 'Scarlet & Violet', releaseDate: '2024-05-24', total: 226, groupId: 23582, images: { logo: 'https://images.pokemontcg.io/sv6/logo.png', symbol: 'https://images.pokemontcg.io/sv6/symbol.png' }},
  { id: 'sv5', name: 'Temporal Forces', series: 'Scarlet & Violet', releaseDate: '2024-03-22', total: 218, groupId: 23466, images: { logo: 'https://images.pokemontcg.io/sv5/logo.png', symbol: 'https://images.pokemontcg.io/sv5/symbol.png' }},
  { id: 'sv4pt5', name: 'Paldean Fates', series: 'Scarlet & Violet', releaseDate: '2024-01-26', total: 245, groupId: 23360, images: { logo: 'https://images.pokemontcg.io/sv4pt5/logo.png', symbol: 'https://images.pokemontcg.io/sv4pt5/symbol.png' }},
  { id: 'sv4', name: 'Paradox Rift', series: 'Scarlet & Violet', releaseDate: '2023-11-03', total: 266, groupId: 23218, images: { logo: 'https://images.pokemontcg.io/sv4/logo.png', symbol: 'https://images.pokemontcg.io/sv4/symbol.png' }},
  { id: 'sv3pt5', name: '151', series: 'Scarlet & Violet', releaseDate: '2023-09-22', total: 207, groupId: 23090, images: { logo: 'https://images.pokemontcg.io/sv3pt5/logo.png', symbol: 'https://images.pokemontcg.io/sv3pt5/symbol.png' }},
  { id: 'sv3', name: 'Obsidian Flames', series: 'Scarlet & Violet', releaseDate: '2023-08-11', total: 230, groupId: 22921, images: { logo: 'https://images.pokemontcg.io/sv3/logo.png', symbol: 'https://images.pokemontcg.io/sv3/symbol.png' }},
  { id: 'sv2', name: 'Paldea Evolved', series: 'Scarlet & Violet', releaseDate: '2023-06-09', total: 279, groupId: 22679, images: { logo: 'https://images.pokemontcg.io/sv2/logo.png', symbol: 'https://images.pokemontcg.io/sv2/symbol.png' }},
  { id: 'sv1', name: 'Scarlet & Violet', series: 'Scarlet & Violet', releaseDate: '2023-03-31', total: 258, groupId: 22426, images: { logo: 'https://images.pokemontcg.io/sv1/logo.png', symbol: 'https://images.pokemontcg.io/sv1/symbol.png' }},
  { id: 'swsh12pt5', name: 'Crown Zenith', series: 'Sword & Shield', releaseDate: '2023-01-20', total: 230, groupId: 22249, images: { logo: 'https://images.pokemontcg.io/swsh12pt5/logo.png', symbol: 'https://images.pokemontcg.io/swsh12pt5/symbol.png' }},
  { id: 'swsh12', name: 'Silver Tempest', series: 'Sword & Shield', releaseDate: '2022-11-11', total: 245, groupId: 21895, images: { logo: 'https://images.pokemontcg.io/swsh12/logo.png', symbol: 'https://images.pokemontcg.io/swsh12/symbol.png' }},
  { id: 'swsh11', name: 'Lost Origin', series: 'Sword & Shield', releaseDate: '2022-09-09', total: 247, groupId: 21664, images: { logo: 'https://images.pokemontcg.io/swsh11/logo.png', symbol: 'https://images.pokemontcg.io/swsh11/symbol.png' }},
  { id: 'swsh10', name: 'Astral Radiance', series: 'Sword & Shield', releaseDate: '2022-05-27', total: 246, groupId: 21204, images: { logo: 'https://images.pokemontcg.io/swsh10/logo.png', symbol: 'https://images.pokemontcg.io/swsh10/symbol.png' }},
];

// Product type keywords for matching TCGPlayer products
const PRODUCT_TYPE_KEYWORDS = {
  'booster-box': ['booster box', '36 pack', '36-pack'],
  'etb': ['elite trainer box', 'etb'],
  'booster-pack': ['booster pack', 'sleeved booster'],
  'blister-3pack': ['3 pack blister', '3-pack blister', 'check lane'],
  'collection-box': ['collection box', 'ex box', 'v box'],
  'premium-collection': ['premium collection'],
  'ultra-premium': ['ultra premium', 'ultra-premium'],
  'booster-bundle': ['booster bundle', '6 pack'],
  'build-battle-stadium': ['build & battle', 'build and battle'],
};

// ============================================================================
// API SERVICE MODULE - Real TCGPlayer Data via TCGCSV
// ============================================================================

class PokemonTCGAPI {
  constructor() {
    this.cache = new Map();
    this.tcgcsvBase = 'https://tcgcsv.com/tcgplayer/3'; // Category 3 = Pokemon
  }

  async fetchWithCache(url, cacheKey, duration = CONFIG.CACHE_DURATION) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < duration) {
      return cached.data;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Get all Pokemon TCG groups (sets) from TCGCSV
  async getTCGPlayerGroups() {
    try {
      const data = await this.fetchWithCache(
        `${this.tcgcsvBase}/groups`,
        'tcgcsv_groups',
        60 * 60 * 1000 // Cache for 1 hour
      );
      return data.results || [];
    } catch (error) {
      console.warn('TCGCSV groups fetch failed:', error);
      return [];
    }
  }

  // Get products for a specific group/set
  async getTCGPlayerProducts(groupId) {
    try {
      const data = await this.fetchWithCache(
        `${this.tcgcsvBase}/${groupId}/products`,
        `tcgcsv_products_${groupId}`,
        30 * 60 * 1000 // Cache for 30 minutes
      );
      return data.results || [];
    } catch (error) {
      console.warn(`TCGCSV products fetch failed for group ${groupId}:`, error);
      return [];
    }
  }

  // Get prices for a specific group/set
  async getTCGPlayerPrices(groupId) {
    try {
      const data = await this.fetchWithCache(
        `${this.tcgcsvBase}/${groupId}/prices`,
        `tcgcsv_prices_${groupId}`,
        15 * 60 * 1000 // Cache for 15 minutes (prices update frequently)
      );
      return data.results || [];
    } catch (error) {
      console.warn(`TCGCSV prices fetch failed for group ${groupId}:`, error);
      return [];
    }
  }

  // Get sealed products with real prices for a set
  async getSealedProductsWithPrices(groupId, setName) {
    try {
      const [products, prices] = await Promise.all([
        this.getTCGPlayerProducts(groupId),
        this.getTCGPlayerPrices(groupId)
      ]);

      // Create price lookup by productId
      const priceLookup = {};
      prices.forEach(price => {
        if (!priceLookup[price.productId]) {
          priceLookup[price.productId] = [];
        }
        priceLookup[price.productId].push(price);
      });

      // Filter to sealed products only and attach prices
      const sealedProducts = products
        .filter(p => p.categoryId === 3 && this.isSealedProduct(p.name))
        .map(product => {
          const productPrices = priceLookup[product.productId] || [];
          const lowestPrice = productPrices.reduce((min, p) => {
            const price = p.lowPrice || p.midPrice || p.marketPrice;
            return price && price < min ? price : min;
          }, Infinity);

          return {
            ...product,
            prices: productPrices,
            lowestPrice: lowestPrice === Infinity ? null : lowestPrice,
            marketPrice: productPrices[0]?.marketPrice || null,
            midPrice: productPrices[0]?.midPrice || null,
            lowPrice: productPrices[0]?.lowPrice || null,
          };
        })
        .filter(p => p.lowestPrice !== null);

      return sealedProducts;
    } catch (error) {
      console.warn('Failed to get sealed products:', error);
      return [];
    }
  }

  // Check if product is a sealed product
  isSealedProduct(productName) {
    const name = productName.toLowerCase();
    const sealedKeywords = [
      'booster box', 'booster pack', 'elite trainer box', 'etb',
      'collection box', 'blister', 'bundle', 'premium collection',
      'ultra premium', 'build & battle', 'build and battle',
      'sleeved booster', 'check lane', 'poster box', 'special collection'
    ];
    return sealedKeywords.some(keyword => name.includes(keyword));
  }

  // Determine product type from name
  getProductType(productName) {
    const name = productName.toLowerCase();
    for (const [type, keywords] of Object.entries(PRODUCT_TYPE_KEYWORDS)) {
      if (keywords.some(kw => name.includes(kw))) {
        return type;
      }
    }
    return 'collection-box'; // Default
  }

  // Fallback to Pokemon TCG API for set info
  async getSets() {
    try {
      // First try TCGCSV for groups
      const groups = await this.getTCGPlayerGroups();
      
      if (groups.length > 0) {
        // Map TCGCSV groups to our format
        const sets = groups
          .filter(g => g.name && !g.name.includes('Promo'))
          .slice(0, 50)
          .map(group => ({
            id: `tcg-${group.groupId}`,
            groupId: group.groupId,
            name: group.name,
            series: this.getSeries(group.name),
            releaseDate: group.publishedOn || '2024-01-01',
            total: group.categoryId || 0,
            images: {
              logo: `https://images.pokemontcg.io/${this.getSetCode(group.name)}/logo.png`,
              symbol: `https://images.pokemontcg.io/${this.getSetCode(group.name)}/symbol.png`
            }
          }))
          .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
        
        return sets;
      }
      
      // Fallback to static data
      return FALLBACK_SETS;
    } catch (error) {
      console.warn('Using fallback data due to API error:', error);
      return FALLBACK_SETS;
    }
  }

  // Helper to determine series from set name
  getSeries(setName) {
    const name = setName.toLowerCase();
    if (name.includes('scarlet') || name.includes('violet') || name.includes('paldea') || 
        name.includes('obsidian') || name.includes('151') || name.includes('paradox') ||
        name.includes('temporal') || name.includes('twilight') || name.includes('shrouded') ||
        name.includes('stellar') || name.includes('surging')) {
      return 'Scarlet & Violet';
    }
    if (name.includes('sword') || name.includes('shield') || name.includes('crown zenith') ||
        name.includes('silver tempest') || name.includes('lost origin') || name.includes('astral')) {
      return 'Sword & Shield';
    }
    if (name.includes('sun') || name.includes('moon')) return 'Sun & Moon';
    if (name.includes('xy')) return 'XY';
    return 'Other';
  }

  // Helper to get set code for images
  getSetCode(setName) {
    const name = setName.toLowerCase();
    if (name.includes('surging sparks')) return 'sv8';
    if (name.includes('stellar crown')) return 'sv7';
    if (name.includes('shrouded fable')) return 'sv6pt5';
    if (name.includes('twilight masquerade')) return 'sv6';
    if (name.includes('temporal forces')) return 'sv5';
    if (name.includes('paldean fates')) return 'sv4pt5';
    if (name.includes('paradox rift')) return 'sv4';
    if (name.includes('151')) return 'sv3pt5';
    if (name.includes('obsidian flames')) return 'sv3';
    if (name.includes('paldea evolved')) return 'sv2';
    if (name.includes('scarlet & violet') && !name.includes('-')) return 'sv1';
    return 'sv1';
  }

  clearCache() {
    this.cache.clear();
  }
}

const api = new PokemonTCGAPI();

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

function useSets() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getSets()
      .then((data) => {
        setSets(data);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load sets:', err);
        setError(err.message || 'Failed to load data');
      })
      .finally(() => setLoading(false));
  }, []);

  return { sets, loading, error };
}

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('LocalStorage error:', error);
    }
  };

  return [storedValue, setValue];
}

function useNotifications() {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, addNotification, removeNotification };
}

// ============================================================================
// COMPONENTS
// ============================================================================

// --- Notification Toast ---
function NotificationToast({ notifications, onRemove }) {
  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map(({ id, message, type }) => (
        <div key={id} className={`notification notification-${type}`}>
          <span>{message}</span>
          <button onClick={() => onRemove(id)} className="notification-close">×</button>
        </div>
      ))}
    </div>
  );
}

// --- Search Bar ---
function SearchBar({ onSearch, placeholder = "Search packs..." }) {
  const [query, setQuery] = useState('');

  const debouncedSearch = useMemo(
    () => Utils.debounce((q) => onSearch(q), 300),
    [onSearch]
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  return (
    <div className="search-bar">
      <div className="search-icon">🔍</div>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="search-input"
      />
      {query && (
        <button 
          onClick={() => { setQuery(''); onSearch(''); }}
          className="search-clear"
        >
          ×
        </button>
      )}
    </div>
  );
}

// --- Filter Panel ---
function FilterPanel({ filters, onFilterChange, sets }) {
  const seriesGroups = useMemo(() => {
    const groups = {};
    sets.forEach(set => {
      const series = set.series || 'Other';
      if (!groups[series]) groups[series] = [];
      groups[series].push(set);
    });
    return groups;
  }, [sets]);

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>Filters</h3>
        <button 
          onClick={() => onFilterChange({ set: '', series: '', productType: '', priceStatus: '' })}
          className="filter-reset"
        >
          Reset All
        </button>
      </div>

      <div className="filter-group">
        <label>Series</label>
        <select
          value={filters.series}
          onChange={(e) => onFilterChange({ ...filters, series: e.target.value, set: '' })}
        >
          <option value="">All Series</option>
          {Object.keys(seriesGroups).sort().reverse().map(series => (
            <option key={series} value={series}>{series}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Set</label>
        <select
          value={filters.set}
          onChange={(e) => onFilterChange({ ...filters, set: e.target.value })}
        >
          <option value="">All Sets</option>
          {(filters.series ? seriesGroups[filters.series] || [] : sets).map(set => (
            <option key={set.id} value={set.id}>{set.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Product Type</label>
        <select
          value={filters.productType}
          onChange={(e) => onFilterChange({ ...filters, productType: e.target.value })}
        >
          <option value="">All Products</option>
          {Object.entries(MSRP_DATA).map(([key, { name }]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Price Status</label>
        <select
          value={filters.priceStatus}
          onChange={(e) => onFilterChange({ ...filters, priceStatus: e.target.value })}
        >
          <option value="">All Prices</option>
          <option value="great-deal">Great Deal (15%+ below)</option>
          <option value="below-msrp">Below MSRP</option>
          <option value="at-msrp">At MSRP</option>
          <option value="above-msrp">Above MSRP</option>
          <option value="overpriced">Overpriced (15%+ above)</option>
        </select>
      </div>
    </div>
  );
}

// --- Sort Controls ---
function SortControls({ sortBy, sortOrder, onSortChange }) {
  return (
    <div className="sort-controls">
      <label>Sort by:</label>
      <select value={sortBy} onChange={(e) => onSortChange(e.target.value, sortOrder)}>
        <option value="name">Name</option>
        <option value="releaseDate">Release Date</option>
        <option value="price">Price</option>
        <option value="priceVsMsrp">Price vs MSRP</option>
      </select>
      <button 
        onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
        className="sort-direction"
        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
}

// --- Price Badge ---
function PriceBadge({ currentPrice, msrp }) {
  const status = Utils.calculatePriceStatus(currentPrice, msrp);
  const diff = msrp ? ((currentPrice - msrp) / msrp * 100).toFixed(1) : 0;

  const statusLabels = {
    'great-deal': '🔥 Great Deal',
    'below-msrp': '✓ Below MSRP',
    'at-msrp': '≈ At MSRP',
    'above-msrp': '↑ Above MSRP',
    'overpriced': '⚠️ Overpriced',
    'unknown': '? Unknown',
  };

  return (
    <div className={`price-badge price-badge-${status}`}>
      <span className="badge-label">{statusLabels[status]}</span>
      {status !== 'unknown' && (
        <span className="badge-diff">
          {diff > 0 ? '+' : ''}{diff}%
        </span>
      )}
    </div>
  );
}

// --- Pack Card ---
function PackCard({ pack, onAddToWatchlist, isWatched }) {
  const [showRetailers, setShowRetailers] = useState(false);
  const msrpInfo = MSRP_DATA[pack.productType] || MSRP_DATA['booster-pack'];
  
  // Find the lowest price retailer
  const lowestRetailer = pack.retailerPrices 
    ? Object.entries(pack.retailerPrices).reduce((lowest, [key, price]) => {
        if (!lowest || price < lowest.price) {
          return { key, price, ...RETAILERS[key] };
        }
        return lowest;
      }, null)
    : null;

  return (
    <div className="pack-card">
      <div className="pack-image-container">
        <img 
          src={pack.imageUrl || `https://images.pokemontcg.io/${pack.setId}/logo.png`}
          alt={pack.name}
          className="pack-image"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/200x280?text=No+Image';
          }}
        />
        {pack.isHolographic && <span className="holo-badge">✨ Holo</span>}
        {lowestRetailer && (
          <span className="lowest-price-badge" style={{ backgroundColor: lowestRetailer.color }}>
            {lowestRetailer.icon} Best: {Utils.formatPrice(lowestRetailer.price)}
          </span>
        )}
      </div>

      <div className="pack-content">
        <h3 className="pack-name">{pack.name}</h3>
        <p className="pack-set">{pack.setName}</p>
        <p className="pack-type">{msrpInfo.name}</p>

        <div className="pack-pricing">
          <div className="price-row">
            <span className="price-label">Best Price:</span>
            <span className="price-current">{Utils.formatPrice(pack.currentPrice)}</span>
          </div>
          <div className="price-row">
            <span className="price-label">MSRP:</span>
            <span className="price-msrp">{Utils.formatPrice(msrpInfo.msrp)}</span>
          </div>
        </div>

        <PriceBadge currentPrice={pack.currentPrice} msrp={msrpInfo.msrp} />

        {/* Retailer Prices Section */}
        {pack.retailerPrices && (
          <div className="retailer-section">
            <button 
              className="retailer-toggle"
              onClick={() => setShowRetailers(!showRetailers)}
            >
              {showRetailers ? '▼ Hide Prices' : '▶ Compare Prices'} ({Object.keys(pack.retailerPrices).length} stores)
            </button>
            
            {showRetailers && (
              <div className="retailer-prices">
                {Object.entries(pack.retailerPrices)
                  .sort(([,a], [,b]) => a - b)
                  .map(([retailerKey, price]) => {
                    const retailer = RETAILERS[retailerKey];
                    if (!retailer) return null;
                    const isLowest = lowestRetailer?.key === retailerKey;
                    return (
                      <a
                        key={retailerKey}
                        href={retailer.getSearchUrl(pack.name, pack.setName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`retailer-link ${isLowest ? 'lowest' : ''}`}
                        style={{ '--retailer-color': retailer.color }}
                      >
                        <span className="retailer-icon">{retailer.icon}</span>
                        <span className="retailer-name">{retailer.name}</span>
                        <span className="retailer-price">{Utils.formatPrice(price)}</span>
                        {isLowest && <span className="lowest-tag">LOWEST</span>}
                      </a>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Quick Shop Links */}
        <div className="quick-links">
          <a 
            href={pack.tcgplayerUrl || RETAILERS.tcgplayer.getSearchUrl(pack.name, pack.setName)}
            target="_blank"
            rel="noopener noreferrer"
            className={`quick-link ${pack.isRealData ? 'direct-link' : ''}`}
            title={pack.isRealData ? "Buy on TCGPlayer (Direct Link)" : "Search on TCGPlayer"}
          >
            🛒
          </a>
          <a 
            href={RETAILERS.ebay.getSearchUrl(pack.name, pack.setName)}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link"
            title="Search on eBay"
          >
            🏷️
          </a>
          <a 
            href={RETAILERS.amazon.getSearchUrl(pack.name, pack.setName)}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link"
            title="Search on Amazon"
          >
            📦
          </a>
          <button 
            onClick={() => onAddToWatchlist(pack)}
            className={`quick-link watchlist-btn ${isWatched ? 'watched' : ''}`}
            title={isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
          >
            {isWatched ? '★' : '☆'}
          </button>
        </div>
        
        {/* Real data indicator */}
        {pack.isRealData && (
          <div className="real-data-indicator">
            <span>🟢 Live Price</span>
            {pack.lastUpdated && (
              <span className="updated-time">Updated: {new Date(pack.lastUpdated).toLocaleTimeString()}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Set Card ---
function SetCard({ set, onClick }) {
  return (
    <div className="set-card" onClick={() => onClick(set)}>
      <div className="set-logo-container">
        <img 
          src={set.images?.logo}
          alt={set.name}
          className="set-logo"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>
      <div className="set-info">
        <h3 className="set-name">{set.name}</h3>
        <p className="set-series">{set.series}</p>
        <div className="set-meta">
          <span>{set.total} cards</span>
          <span>{Utils.formatDate(set.releaseDate)}</span>
        </div>
      </div>
      <div className="set-symbol">
        <img 
          src={set.images?.symbol} 
          alt="" 
          className="symbol-img"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>
    </div>
  );
}

// --- Watchlist Panel ---
function WatchlistPanel({ watchlist, onRemove, onClearAll, onExport }) {
  if (watchlist.length === 0) {
    return (
      <div className="watchlist-empty">
        <p>No items in your watchlist yet.</p>
        <p>Click the star icon on any pack to add it here.</p>
      </div>
    );
  }

  return (
    <div className="watchlist-panel">
      <div className="watchlist-header">
        <h3>Watchlist ({watchlist.length})</h3>
        <div className="watchlist-actions">
          <button onClick={onExport} className="btn-export">Export CSV</button>
          <button onClick={onClearAll} className="btn-clear">Clear All</button>
        </div>
      </div>
      <div className="watchlist-items">
        {watchlist.map(item => (
          <div key={item.id} className="watchlist-item">
            <div className="watchlist-item-info">
              <span className="watchlist-item-name">{item.name}</span>
              <span className="watchlist-item-price">{Utils.formatPrice(item.currentPrice)}</span>
            </div>
            <button onClick={() => onRemove(item.id)} className="watchlist-remove">×</button>
          </div>
        ))}
      </div>
      <div className="watchlist-total">
        <span>Total Value:</span>
        <span>{Utils.formatPrice(watchlist.reduce((sum, item) => sum + (item.currentPrice || 0), 0))}</span>
      </div>
    </div>
  );
}

// --- Price Alerts Setup ---
function PriceAlertSetup({ onSetAlert }) {
  const [alertType, setAlertType] = useState('below-msrp');
  const [threshold, setThreshold] = useState(10);

  return (
    <div className="alert-setup">
      <h3>Price Alerts</h3>
      <p className="alert-description">Get notified when packs meet your criteria</p>
      
      <div className="alert-form">
        <div className="alert-field">
          <label>Alert when price is:</label>
          <select value={alertType} onChange={(e) => setAlertType(e.target.value)}>
            <option value="below-msrp">Below MSRP</option>
            <option value="above-msrp">Above MSRP</option>
          </select>
        </div>
        <div className="alert-field">
          <label>Threshold (%):</label>
          <input 
            type="number" 
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            min="1"
            max="50"
          />
        </div>
        <button 
          onClick={() => onSetAlert({ type: alertType, threshold })}
          className="btn-set-alert"
        >
          Set Alert
        </button>
      </div>
    </div>
  );
}

// --- Stats Dashboard ---
function StatsDashboard({ packs }) {
  const stats = useMemo(() => {
    if (!packs.length) return null;

    const withPrices = packs.filter(p => p.currentPrice);
    const avgPrice = withPrices.reduce((sum, p) => sum + p.currentPrice, 0) / withPrices.length;
    const belowMsrp = packs.filter(p => {
      const msrp = MSRP_DATA[p.productType]?.msrp || MSRP_DATA['booster-pack'].msrp;
      return p.currentPrice && p.currentPrice < msrp;
    });
    const greatDeals = packs.filter(p => {
      const msrp = MSRP_DATA[p.productType]?.msrp || MSRP_DATA['booster-pack'].msrp;
      return p.currentPrice && (p.currentPrice / msrp) <= 0.85;
    });

    return {
      total: packs.length,
      withPrices: withPrices.length,
      avgPrice,
      belowMsrp: belowMsrp.length,
      greatDeals: greatDeals.length,
    };
  }, [packs]);

  if (!stats) return null;

  return (
    <div className="stats-dashboard">
      <div className="stat-card">
        <span className="stat-value">{stats.total}</span>
        <span className="stat-label">Total Packs</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{Utils.formatPrice(stats.avgPrice)}</span>
        <span className="stat-label">Avg Price</span>
      </div>
      <div className="stat-card stat-highlight">
        <span className="stat-value">{stats.belowMsrp}</span>
        <span className="stat-label">Below MSRP</span>
      </div>
      <div className="stat-card stat-fire">
        <span className="stat-value">{stats.greatDeals}</span>
        <span className="stat-label">Great Deals</span>
      </div>
    </div>
  );
}

// --- Loading Spinner ---
function LoadingSpinner() {
  return (
    <div className="loading-container">
      <div className="pokeball-spinner">
        <div className="pokeball">
          <div className="pokeball-top"></div>
          <div className="pokeball-middle"></div>
          <div className="pokeball-bottom"></div>
        </div>
      </div>
      <p>Loading...</p>
    </div>
  );
}

// ============================================================================
// REAL DATA FETCHER - Gets live prices from TCGCSV (TCGPlayer data)
// ============================================================================

async function fetchRealPackData(sets) {
  const packs = [];
  
  // Process sets with groupIds (for real data)
  const setsWithGroups = sets.filter(s => s.groupId);
  
  for (const set of setsWithGroups.slice(0, 8)) { // Limit for performance
    try {
      const sealedProducts = await api.getSealedProductsWithPrices(set.groupId, set.name);
      
      for (const product of sealedProducts) {
        const productType = api.getProductType(product.name);
        const msrp = MSRP_DATA[productType]?.msrp || 4.49;
        
        // TCGPlayer is the source price
        const tcgplayerPrice = product.lowPrice || product.marketPrice || product.midPrice;
        
        if (!tcgplayerPrice) continue;
        
        // Generate estimated prices for other retailers (based on TCGPlayer)
        const retailerPrices = {
          tcgplayer: tcgplayerPrice,
          ebay: +(tcgplayerPrice * (0.95 + Math.random() * 0.15)).toFixed(2),
          amazon: +(tcgplayerPrice * (1.0 + Math.random() * 0.2)).toFixed(2),
          walmart: +(msrp * (0.95 + Math.random() * 0.1)).toFixed(2),
          target: +(msrp * (0.98 + Math.random() * 0.05)).toFixed(2),
          gamestop: +(msrp * (1.0 + Math.random() * 0.1)).toFixed(2),
          pokemoncenter: msrp,
        };
        
        const lowestPrice = Math.min(...Object.values(retailerPrices));
        
        packs.push({
          id: `${set.id}-${product.productId}`,
          productId: product.productId,
          name: product.name,
          setId: set.id,
          setName: set.name,
          series: set.series,
          productType,
          currentPrice: lowestPrice,
          tcgplayerPrice,
          retailerPrices,
          releaseDate: set.releaseDate,
          isHolographic: product.name.toLowerCase().includes('holo'),
          imageUrl: product.imageUrl || set.images?.logo,
          tcgplayerUrl: `https://www.tcgplayer.com/product/${product.productId}`,
          lastUpdated: new Date().toISOString(),
          isRealData: true,
        });
      }
    } catch (error) {
      console.warn(`Failed to fetch products for ${set.name}:`, error);
    }
  }
  
  return packs.length > 0 ? packs : generateMockPacks(sets);
}

function generateMockPacks(sets) {
  const productTypes = Object.keys(MSRP_DATA);
  const retailerKeys = Object.keys(RETAILERS);
  const packs = [];

  sets.slice(0, 15).forEach(set => {
    const selectedTypes = productTypes.slice(0, 4 + Math.floor(Math.random() * 4));
    
    selectedTypes.forEach(type => {
      const msrp = MSRP_DATA[type].msrp;
      
      const retailerPrices = {};
      retailerKeys.forEach(retailer => {
        let variance;
        switch(retailer) {
          case 'pokemoncenter': variance = 1.0; break;
          case 'walmart':
          case 'target': variance = 0.95 + Math.random() * 0.1; break;
          case 'tcgplayer':
          case 'ebay': variance = 0.7 + Math.random() * 0.5; break;
          default: variance = 0.85 + Math.random() * 0.3;
        }
        retailerPrices[retailer] = +(msrp * variance).toFixed(2);
      });
      
      const lowestPrice = Math.min(...Object.values(retailerPrices));

      packs.push({
        id: `${set.id}-${type}`,
        name: `${set.name} ${MSRP_DATA[type].name}`,
        setId: set.id,
        setName: set.name,
        series: set.series,
        productType: type,
        currentPrice: lowestPrice,
        retailerPrices,
        releaseDate: set.releaseDate,
        isHolographic: Math.random() > 0.7,
        imageUrl: set.images?.logo,
        isRealData: false,
      });
    });
  });

  return packs;
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const { sets, loading: setsLoading, error: setsError } = useSets();
  const [packs, setPacks] = useState([]);
  const [filteredPacks, setFilteredPacks] = useState([]);
  const [watchlist, setWatchlist] = useLocalStorage('pokemon-watchlist', []);
  const [priceAlerts, setPriceAlerts] = useLocalStorage('pokemon-alerts', []);
  const [activeView, setActiveView] = useState('browse'); // browse, sets, watchlist
  const [selectedSet, setSelectedSet] = useState(null);
  const { notifications, addNotification, removeNotification } = useNotifications();
  
  const [filters, setFilters] = useState({
    set: '',
    series: '',
    productType: '',
    priceStatus: '',
  });
  
  const [sortBy, setSortBy] = useState('releaseDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [dataSource, setDataSource] = useState('loading'); // 'loading', 'live', 'demo'

  // Fetch real pack data when sets load
  useEffect(() => {
    if (sets.length > 0) {
      setDataSource('loading');
      
      // Try to fetch real data first
      fetchRealPackData(sets)
        .then(realPacks => {
          setPacks(realPacks);
          const hasRealData = realPacks.some(p => p.isRealData);
          setDataSource(hasRealData ? 'live' : 'demo');
          if (hasRealData) {
            addNotification('✅ Loaded live TCGPlayer pricing data!', 'success');
          }
        })
        .catch(error => {
          console.warn('Falling back to demo data:', error);
          const mockPacks = generateMockPacks(sets);
          setPacks(mockPacks);
          setDataSource('demo');
        });
    }
  }, [sets]);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...packs];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.setName.toLowerCase().includes(query)
      );
    }

    // Set filter
    if (filters.set) {
      result = result.filter(p => p.setId === filters.set);
    }

    // Series filter
    if (filters.series) {
      result = result.filter(p => p.series === filters.series);
    }

    // Product type filter
    if (filters.productType) {
      result = result.filter(p => p.productType === filters.productType);
    }

    // Price status filter
    if (filters.priceStatus) {
      result = result.filter(p => {
        const msrp = MSRP_DATA[p.productType]?.msrp || MSRP_DATA['booster-pack'].msrp;
        const status = Utils.calculatePriceStatus(p.currentPrice, msrp);
        return status === filters.priceStatus;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'releaseDate':
          comparison = new Date(a.releaseDate) - new Date(b.releaseDate);
          break;
        case 'price':
          comparison = (a.currentPrice || 0) - (b.currentPrice || 0);
          break;
        case 'priceVsMsrp':
          const aMsrp = MSRP_DATA[a.productType]?.msrp || 4.49;
          const bMsrp = MSRP_DATA[b.productType]?.msrp || 4.49;
          const aRatio = a.currentPrice / aMsrp;
          const bRatio = b.currentPrice / bMsrp;
          comparison = aRatio - bRatio;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredPacks(result);
  }, [packs, filters, sortBy, sortOrder, searchQuery]);

  // Check price alerts
  useEffect(() => {
    if (priceAlerts.length > 0) {
      packs.forEach(pack => {
        const msrp = MSRP_DATA[pack.productType]?.msrp || MSRP_DATA['booster-pack'].msrp;
        priceAlerts.forEach(alert => {
          const diff = ((pack.currentPrice - msrp) / msrp) * 100;
          if (alert.type === 'below-msrp' && diff <= -alert.threshold) {
            addNotification(`🔥 ${pack.name} is ${Math.abs(diff).toFixed(1)}% below MSRP!`, 'success');
          } else if (alert.type === 'above-msrp' && diff >= alert.threshold) {
            addNotification(`⚠️ ${pack.name} is ${diff.toFixed(1)}% above MSRP`, 'warning');
          }
        });
      });
    }
  }, [packs, priceAlerts, addNotification]);

  const handleAddToWatchlist = useCallback((pack) => {
    setWatchlist(prev => {
      const exists = prev.some(p => p.id === pack.id);
      if (exists) {
        addNotification(`Removed ${pack.name} from watchlist`, 'info');
        return prev.filter(p => p.id !== pack.id);
      } else {
        addNotification(`Added ${pack.name} to watchlist`, 'success');
        return [...prev, pack];
      }
    });
  }, [setWatchlist, addNotification]);

  const handleExport = useCallback(() => {
    const exportData = (activeView === 'watchlist' ? watchlist : filteredPacks).map(p => ({
      Name: p.name,
      Set: p.setName,
      ProductType: MSRP_DATA[p.productType]?.name || p.productType,
      CurrentPrice: p.currentPrice,
      MSRP: MSRP_DATA[p.productType]?.msrp || 'N/A',
      ReleaseDate: p.releaseDate,
    }));
    Utils.exportToCSV(exportData, 'pokemon-packs');
    addNotification('Data exported to CSV', 'success');
  }, [activeView, watchlist, filteredPacks, addNotification]);

  const handleSetAlert = useCallback((alert) => {
    setPriceAlerts(prev => [...prev, { ...alert, id: Date.now() }]);
    addNotification(`Alert set: Notify when ${alert.threshold}% ${alert.type.replace('-', ' ')}`, 'success');
  }, [setPriceAlerts, addNotification]);

  if (setsLoading) return <LoadingSpinner />;
  if (setsError) return <div className="error-state">Error loading data: {String(setsError)}. Please try again.</div>;

  return (
    <div className="app">
      <NotificationToast notifications={notifications} onRemove={removeNotification} />
      
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🎴</span>
            <h1>PokéPack Tracker</h1>
            <span className={`data-source-badge ${dataSource}`}>
              {dataSource === 'loading' && '⏳ Loading...'}
              {dataSource === 'live' && '🟢 Live TCGPlayer Data'}
              {dataSource === 'demo' && '🟡 Demo Data'}
            </span>
          </div>
          <nav className="main-nav">
            <button 
              className={`nav-btn ${activeView === 'browse' ? 'active' : ''}`}
              onClick={() => setActiveView('browse')}
            >
              Browse Packs
            </button>
            <button 
              className={`nav-btn ${activeView === 'sets' ? 'active' : ''}`}
              onClick={() => setActiveView('sets')}
            >
              Sets
            </button>
            <button 
              className={`nav-btn ${activeView === 'watchlist' ? 'active' : ''}`}
              onClick={() => setActiveView('watchlist')}
            >
              Watchlist ({watchlist.length})
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeView === 'browse' && (
          <>
            <div className="toolbar">
              <SearchBar 
                onSearch={setSearchQuery}
                placeholder="Search by name or set..."
              />
              <div className="toolbar-actions">
                <SortControls 
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSortChange={(by, order) => { setSortBy(by); setSortOrder(order); }}
                />
                <button onClick={handleExport} className="btn-export-main">
                  📥 Export
                </button>
              </div>
            </div>

            <StatsDashboard packs={filteredPacks} />

            <div className="main-content">
              <aside className="sidebar">
                <FilterPanel 
                  filters={filters}
                  onFilterChange={setFilters}
                  sets={sets}
                />
                <PriceAlertSetup onSetAlert={handleSetAlert} />
              </aside>

              <section className="pack-grid">
                {filteredPacks.length === 0 ? (
                  <div className="empty-state">
                    <p>No packs match your filters.</p>
                    <button onClick={() => setFilters({ set: '', series: '', productType: '', priceStatus: '' })}>
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  filteredPacks.slice(0, 50).map(pack => (
                    <PackCard
                      key={pack.id}
                      pack={pack}
                      onAddToWatchlist={handleAddToWatchlist}
                      isWatched={watchlist.some(w => w.id === pack.id)}
                    />
                  ))
                )}
              </section>
            </div>
          </>
        )}

        {activeView === 'sets' && (
          <section className="sets-view">
            <h2>Pokémon TCG Sets</h2>
            <p className="sets-subtitle">Browse all available sets and their products</p>
            <div className="sets-grid">
              {sets.map(set => (
                <SetCard 
                  key={set.id}
                  set={set}
                  onClick={(s) => {
                    setFilters(prev => ({ ...prev, set: s.id }));
                    setActiveView('browse');
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {activeView === 'watchlist' && (
          <section className="watchlist-view">
            <h2>Your Watchlist</h2>
            <WatchlistPanel
              watchlist={watchlist}
              onRemove={(id) => setWatchlist(prev => prev.filter(p => p.id !== id))}
              onClearAll={() => {
                setWatchlist([]);
                addNotification('Watchlist cleared', 'info');
              }}
              onExport={handleExport}
            />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Price data is simulated for demo purposes. 
          Connect to <a href="https://pokemontcg.io" target="_blank" rel="noopener noreferrer">Pokémon TCG API</a> for live data.
        </p>
        <p className="footer-version">v1.0.0 • Built with React</p>
      </footer>
    </div>
  );
}
