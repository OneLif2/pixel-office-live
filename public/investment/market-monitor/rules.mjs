// Public thermometer only. These are not the unpublished warning-light rules.
const base = 'https://www.cashmate.hk/market-monitor';
export const RULESET_VERSION = 'public-thermometer-2026-11-07-v1';
export const RULES = Object.freeze([
  { id: 'vix5d', label: 'VIX 五日平均', unit: '點', decimals: 2, direction: 'gte', yellow: 17, red: 25, min: 0, max: 1000, convention: '五個交易日收市值算術平均；原來源及截止時間未釐清。' },
  { id: 'idx50d', label: '指數距 50 日線', unit: '%', decimals: 2, direction: 'lte', yellow: 0, red: -3, min: -100, max: 10000, convention: '指數及均線價格口徑仍需核實，不以 SPY 代替 SPX 而不標示。' },
  { id: 'breadth50', label: '大型股高於 50 日線比例', unit: '%', decimals: 1, direction: 'lte', yellow: 50, red: 30, min: 0, max: 100, convention: '公開說明為市值前 30 隻股票；歷史成分及納入時點未取得。' },
  { id: 'stock52w', label: '大型股平均距 52 週高位', unit: '%', decimals: 2, direction: 'lte', yellow: -12, red: -20, min: -100, max: 0, convention: '前 30 隻股票平均回撤；歷史成分、調整價及高位算法未完整核實。' },
  { id: 'breadth200', label: '大型股高於 200 日線比例', unit: '%', decimals: 1, direction: 'lte', yellow: 60, red: 40, min: 0, max: 100, convention: '與 50 日廣度使用同一已驗證成分表；不是約 2,500 股升跌家數。' },
  { id: 'trend50200', label: '標普 50 日線距 200 日線', unit: '%', decimals: 2, direction: 'lte', yellow: 1, red: -2, min: -100, max: 10000, convention: '(SMA50 / SMA200 − 1) × 100；SPX 收市價，均線包括當日。' },
  { id: 'rvol21', label: '標普 21 日實現波幅', unit: '%', decimals: 1, direction: 'gte', yellow: 16, red: 25, min: 0, max: 1000, convention: '報酬定義、標準差自由度及年化因子仍待核實。' },
  { id: 'spx52w', label: '標普距 52 週高位', unit: '%', decimals: 2, direction: 'lte', yellow: -4, red: -10, min: -100, max: 0, convention: '52 週窗口和收市／日內高位口徑仍待核實。' },
].map(rule => Object.freeze({ ...rule, sourceUrl: base })));
