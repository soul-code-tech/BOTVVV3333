const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

dotenv.config();

// ==========================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ==========================
let globalState = {
  balance: 100,
  realBalance: null,
  positions: {},
  history: [],
  stats: {
    totalTrades: 0,
    profitableTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalProfit: 0,
    maxDrawdown: 0,
    peakBalance: 100,
    maxLeverageUsed: 1,
    volatilityIndex: 0,
    marketSentiment: 50
  },
  marketMemory: {
    lastTrades: {},
    consecutiveTrades: {},
    volatilityHistory: {},
    fearSentimentHistory: [],
    fundamentalData: {}
  },
  isRunning: true,
  takerFee: 0.0005,
  makerFee: 0.0002,
  maxRiskPerTrade: 0.01,
  maxLeverage: 3,
  // 100+ ликвидных SPOT-монет (без дубликатов)
  watchlist: [
    { symbol: 'BTC-USDT', name: 'bitcoin' },
    { symbol: 'ETH-USDT', name: 'ethereum' },
    { symbol: 'BNB-USDT', name: 'binancecoin' },
    { symbol: 'SOL-USDT', name: 'solana' },
    { symbol: 'XRP-USDT', name: 'ripple' },
    { symbol: 'USDC-USDT', name: 'usd-coin' },
    { symbol: 'ADA-USDT', name: 'cardano' },
    { symbol: 'AVAX-USDT', name: 'avalanche-2' },
    { symbol: 'DOGE-USDT', name: 'dogecoin' },
    { symbol: 'TRX-USDT', name: 'tron' },
    { symbol: 'DOT-USDT', name: 'polkadot' },
    { symbol: 'TON-USDT', name: 'the-open-network' },
    { symbol: 'LINK-USDT', name: 'chainlink' },
    { symbol: 'MATIC-USDT', name: 'polygon' },
    { symbol: 'ICP-USDT', name: 'internet-computer' },
    { symbol: 'SHIB-USDT', name: 'shiba-inu' },
    { symbol: 'APT-USDT', name: 'aptos' },
    { symbol: 'UNI-USDT', name: 'uniswap' },
    { symbol: 'LTC-USDT', name: 'litecoin' },
    { symbol: 'DAI-USDT', name: 'dai' },
    { symbol: 'ARB-USDT', name: 'arbitrum' },
    { symbol: 'OP-USDT', name: 'optimism' },
    { symbol: 'STRK-USDT', name: 'starknet' },
    { symbol: 'INJ-USDT', name: 'injective-protocol' },
    { symbol: 'TIA-USDT', name: 'celestia' },
    { symbol: 'SEI-USDT', name: 'sei-network' },
    { symbol: 'SUI-USDT', name: 'sui' },
    { symbol: 'FET-USDT', name: 'fetch-ai' },
    { symbol: 'RNDR-USDT', name: 'render-token' },
    { symbol: 'IMX-USDT', name: 'immutable-x' },
    { symbol: 'ONDO-USDT', name: 'ondo-finance' },
    { symbol: 'WLD-USDT', name: 'worldcoin' },
    { symbol: 'JUP-USDT', name: 'jupiter-exchange-solana' },
    { symbol: 'ENA-USDT', name: 'ethena' },
    { symbol: 'TAO-USDT', name: 'bittensor' },
    { symbol: 'BONK-USDT', name: 'bonk' },
    { symbol: 'PEPE-USDT', name: 'pepe' },
    { symbol: 'WIF-USDT', name: 'dogwifhat' },
    { symbol: 'AAVE-USDT', name: 'aave' },
    { symbol: 'MKR-USDT', name: 'maker' },
    { symbol: 'COMP-USDT', name: 'compound-governance-token' },
    { symbol: 'SNX-USDT', name: 'synthetix-network-token' },
    { symbol: 'CRV-USDT', name: 'curve-dao-token' },
    { symbol: 'BAL-USDT', name: 'balancer' },
    { symbol: 'GRT-USDT', name: 'the-graph' },
    { symbol: 'SUSHI-USDT', name: 'sushi' },
    { symbol: 'CAKE-USDT', name: 'pancakeswap-token' },
    { symbol: 'GMX-USDT', name: 'gmx' },
    { symbol: 'PENDLE-USDT', name: 'pendle' },
    { symbol: 'FXS-USDT', name: 'frax-share' },
    { symbol: 'LDO-USDT', name: 'lido-dao' },
    { symbol: 'YFI-USDT', name: 'yearn-finance' },
    { symbol: 'AGIX-USDT', name: 'singularitynet' },
    { symbol: 'OCEAN-USDT', name: 'ocean-protocol' },
    { symbol: 'NMR-USDT', name: 'numeraire' },
    { symbol: 'AKT-USDT', name: 'akash-network' },
    { symbol: 'TNSR-USDT', name: 'tensor' },
    { symbol: 'GALA-USDT', name: 'gala' },
    { symbol: 'SAND-USDT', name: 'the-sandbox' },
    { symbol: 'MANA-USDT', name: 'decentraland' },
    { symbol: 'AXS-USDT', name: 'axie-infinity' },
    { symbol: 'ILV-USDT', name: 'illuvium' },
    { symbol: 'MAGIC-USDT', name: 'magic' },
    { symbol: 'FLOKI-USDT', name: 'floki' },
    { symbol: 'BOME-USDT', name: 'book-of-meme' },
    { symbol: 'MOG-USDT', name: 'mog-coin' },
    { symbol: 'PYTH-USDT', name: 'pyth-network' },
    { symbol: 'USDE-USDT', name: 'ethena-usde' },
    { symbol: 'FDUSD-USDT', name: 'first-digital-usd' },
    { symbol: 'TUSD-USDT', name: 'true-usd' },
    { symbol: 'XLM-USDT', name: 'stellar' },
    { symbol: 'ALGO-USDT', name: 'algorand' },
    { symbol: 'VET-USDT', name: 'vechain' },
    { symbol: 'FIL-USDT', name: 'filecoin' },
    { symbol: 'HBAR-USDT', name: 'hedera-hashgraph' },
    { symbol: 'FLOW-USDT', name: 'flow' },
    { symbol: 'NEAR-USDT', name: 'near' },
    { symbol: 'KAVA-USDT', name: 'kava' },
    { symbol: 'CHZ-USDT', name: 'chiliz' },
    { symbol: 'MINA-USDT', name: 'mina-protocol' },
    { symbol: 'EGLD-USDT', name: 'multiversx' },
    { symbol: 'THETA-USDT', name: 'theta-token' },
    { symbol: 'ZIL-USDT', name: 'zilliqa' },
    { symbol: 'QTUM-USDT', name: 'qtum' },
    { symbol: 'RVN-USDT', name: 'ravencoin' },
    { symbol: 'DGB-USDT', name: 'digibyte' },
    { symbol: 'SC-USDT', name: 'siacoin' },
    { symbol: 'ANKR-USDT', name: 'ankr' },
    { symbol: 'BTT-USDT', name: 'bittorrent' },
    { symbol: 'ROSE-USDT', name: 'oasis-network' },
    { symbol: 'IOTA-USDT', name: 'iota' },
    { symbol: 'XMR-USDT', name: 'monero' },
    { symbol: 'ZEC-USDT', name: 'zcash' },
    { symbol: 'DASH-USDT', name: 'dash' },
    { symbol: 'KSM-USDT', name: 'kusama' },
    { symbol: 'OSMO-USDT', name: 'osmosis' },
    { symbol: 'DYDX-USDT', name: 'dydx' },
    { symbol: 'BLUR-USDT', name: 'blur' },
    { symbol: 'ORDI-USDT', name: 'ordi' },
    { symbol: 'ARKM-USDT', name: 'arkham' },
    { symbol: 'NOT-USDT', name: 'notcoin' },
    { symbol: 'JASMY-USDT', name: 'jasmycoin' },
    { symbol: '1INCH-USDT', name: '1inch' },
    { symbol: 'MASK-USDT', name: 'mask-network' },
    { symbol: 'ENS-USDT', name: 'ethereum-name-service' },
    { symbol: 'APE-USDT', name: 'apecoin' },
    { symbol: 'LUNC-USDT', name: 'terra-luna-2' },
    { symbol: 'RUNE-USDT', name: 'thorchain' },
    { symbol: 'ATOM-USDT', name: 'cosmos' },
    { symbol: 'XTZ-USDT', name: 'tezos' },
    { symbol: 'BCH-USDT', name: 'bitcoin-cash' },
    { symbol: 'ETC-USDT', name: 'ethereum-classic' },
    { symbol: 'ZRX-USDT', name: '0x' },
    { symbol: 'BAT-USDT', name: 'basic-attention-token' },
    { symbol: 'FIL-USDT', name: 'filecoin' },
    { symbol: 'NEAR-USDT', name: 'near' },
    { symbol: 'POLYX-USDT', name: 'polygon' },
    { symbol: 'CELR-USDT', name: 'celer-network' },
    { symbol: 'STX-USDT', name: 'stacks' },
    { symbol: 'QNT-USDT', name: 'quant' },
    { symbol: 'HNT-USDT', name: 'helium' },
    { symbol: 'LRC-USDT', name: 'loopring' },
    { symbol: 'CVC-USDT', name: 'civic' },
    { symbol: 'NKN-USDT', name: 'nkn' },
    { symbol: 'ZKS-USDT', name: 'zk-sync' },
    { symbol: 'RENDER-USDT', name: 'render-token' },
    { symbol: 'IO-STK-USDT', name: 'io-staking' },
    { symbol: 'KAS-USDT', name: 'kaspa' },
    { symbol: 'AR-USDT', name: 'arweave' },
    { symbol: 'SAND-USDT', name: 'the-sandbox' },
    { symbol: 'MANA-USDT', name: 'decentraland' },
    { symbol: 'GALA-USDT', name: 'gala' },
    { symbol: 'AXS-USDT', name: 'axie-infinity' },
    { symbol: 'ILV-USDT', name: 'illuvium' },
    { symbol: 'MAGIC-USDT', name: 'magic' },
    { symbol: 'FLOKI-USDT', name: 'floki' },
    { symbol: 'BOME-USDT', name: 'book-of-meme' },
    { symbol: 'MOG-USDT', name: 'mog-coin' },
    { symbol: 'PYTH-USDT', name: 'pyth-network' },
    { symbol: 'USDE-USDT', name: 'ethena-usde' },
    { symbol: 'FDUSD-USDT', name: 'first-digital-usd' },
    { symbol: 'TUSD-USDT', name: 'true-usd' },
    { symbol: 'XLM-USDT', name: 'stellar' },
    { symbol: 'ALGO-USDT', name: 'algorand' },
    { symbol: 'VET-USDT', name: 'vechain' },
    { symbol: 'FIL-USDT', name: 'filecoin' },
    { symbol: 'HBAR-USDT', name: 'hedera-hashgraph' },
    { symbol: 'FLOW-USDT', name: 'flow' },
    { symbol: 'NEAR-USDT', name: 'near' },
    { symbol: 'KAVA-USDT', name: 'kava' },
    { symbol: 'CHZ-USDT', name: 'chiliz' },
    { symbol: 'MINA-USDT', name: 'mina-protocol' },
    { symbol: 'EGLD-USDT', name: 'multiversx' },
    { symbol: 'THETA-USDT', name: 'theta-token' },
    { symbol: 'ZIL-USDT', name: 'zilliqa' },
    { symbol: 'QTUM-USDT', name: 'qtum' },
    { symbol: 'RVN-USDT', name: 'ravencoin' },
    { symbol: 'DGB-USDT', name: 'digibyte' },
    { symbol: 'SC-USDT', name: 'siacoin' },
    { symbol: 'ANKR-USDT', name: 'ankr' },
    { symbol: 'BTT-USDT', name: 'bittorrent' },
    { symbol: 'ROSE-USDT', name: 'oasis-network' },
    { symbol: 'IOTA-USDT', name: 'iota' },
    { symbol: 'XMR-USDT', name: 'monero' },
    { symbol: 'ZEC-USDT', name: 'zcash' },
    { symbol: 'DASH-USDT', name: 'dash' },
    { symbol: 'KSM-USDT', name: 'kusama' },
    { symbol: 'OSMO-USDT', name: 'osmosis' },
    { symbol: 'DYDX-USDT', name: 'dydx' },
    { symbol: 'BLUR-USDT', name: 'blur' },
    { symbol: 'ORDI-USDT', name: 'ordi' },
    { symbol: 'ARKM-USDT', name: 'arkham' },
    { symbol: 'NOT-USDT', name: 'notcoin' },
    { symbol: 'JASMY-USDT', name: 'jasmycoin' },
    { symbol: '1INCH-USDT', name: '1inch' },
    { symbol: 'MASK-USDT', name: 'mask-network' },
    { symbol: 'ENS-USDT', name: 'ethereum-name-service' },
    { symbol: 'APE-USDT', name: 'apecoin' },
    { symbol: 'LUNC-USDT', name: 'terra-luna-2' },
    { symbol: 'RUNE-USDT', name: 'thorchain' },
    { symbol: 'ATOM-USDT', name: 'cosmos' },
    { symbol: 'XTZ-USDT', name: 'tezos' },
    { symbol: 'BCH-USDT', name: 'bitcoin-cash' },
    { symbol: 'ETC-USDT', name: 'ethereum-classic' },
    { symbol: 'ZRX-USDT', name: '0x' },
    { symbol: 'BAT-USDT', name: 'basic-attention-token' }
  ],
  isRealMode: true,
  tradeMode: 'scalping',
  riskLevel: 'high',
  currentPrices: {},
  fearIndex: 50,
  bingxCache: {},
  fundamentalCache: {},
  lastAnalysis: []
};

globalState.watchlist.forEach(coin => {
  globalState.positions[coin.name] = null;
  globalState.marketMemory.lastTrades[coin.name] = [];
  globalState.marketMemory.consecutiveTrades[coin.name] = 0;
  globalState.marketMemory.volatilityHistory[coin.name] = [];
  globalState.marketMemory.fundamentalData[coin.name] = {
    developerActivity: 50,
    socialSentiment: 50,
    marketCapRank: 100,
    communityGrowth: 0
  };
});

// ==========================
// КОНФИГУРАЦИЯ BINGX API
// ==========================
const BINGX_API_KEY = process.env.BINGX_API_KEY;
const BINGX_SECRET_KEY = process.env.BINGX_SECRET_KEY;
const APP_PASSWORD = process.env.APP_PASSWORD || 'admin123';

// Используем bingx.io как основной — он стабильнее
const BINGX_API_BASE_URL = process.env.BINGX_API_DOMAIN || 'https://open-api.bingx.io';

// ==========================
// ПРОВЕРКА КРИТИЧЕСКИХ ПАРАМЕТРОВ
// ==========================
if (!BINGX_API_KEY || !BINGX_SECRET_KEY) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: API-ключи не заданы!');
  console.error('Пожалуйста, установите переменные окружения BINGX_API_KEY и BINGX_SECRET_KEY');
  process.exit(1);
}

// ==========================
// ФУНКЦИЯ: Подпись запроса для BingX (SPOT)
// ==========================
function signBingXRequest(params) {
  const cleanParams = { ...params };
  delete cleanParams.signature;
  let paramString = "";
  for (const key in cleanParams) {
    if (paramString !== "") paramString += "&";
    if (key === 'timestamp') paramString += `${key}=${cleanParams[key]}`;
    else paramString += `${key}=${encodeURIComponent(cleanParams[key])}`;
  }
  return CryptoJS.HmacSHA256(paramString, BINGX_SECRET_KEY).toString(CryptoJS.enc.Hex);
}

// ==========================
// ФУНКЦИЯ: Получение Fear & Greed Index
// ==========================
async function getFearAndGreedIndex() {
  try {
    const response = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 10000 });
    const value = parseInt(response.data.data[0].value);
    globalState.marketMemory.fearSentimentHistory.push({ value, timestamp: Date.now() });
    if (globalState.marketMemory.fearSentimentHistory.length > 24) globalState.marketMemory.fearSentimentHistory.shift();
    globalState.fearIndex = value;
    globalState.stats.marketSentiment = value;
    return value;
  } catch (e) {
    console.log('⚠️ Не удалось получить индекс страха — используем 50');
    globalState.fearIndex = Math.floor(20 + Math.random() * 60);
    globalState.stats.marketSentiment = globalState.fearIndex;
    return globalState.fearIndex;
  }
}

// ==========================
// ФУНКЦИЯ: Получение серверного времени BingX (СПОТ — КРИТИЧЕСКИ ИСПРАВЛЕНО!)
// ==========================
async function getBingXServerTime() {
  try {
    const response = await axios.get(`${BINGX_API_BASE_URL}/openApi/spot/v2/server/time`, {
      timeout: 10000
    });
    if (response.data.code === 0 && response.data.data && response.data.data.serverTime) {
      return response.data.data.serverTime;
    } else {
      console.error('❌ Ошибка получения серверного времени:', response.data.msg || 'Нет данных');
      return Date.now();
    }
  } catch (error) {
    console.error('❌ Ошибка получения серверного времени:', error.message);
    return Date.now();
  }
}

// ==========================
// ФУНКЦИЯ: Получение реального баланса (SPOT)
// ==========================
async function getBingXRealBalance() {
  try {
    console.log('🔍 [БАЛАНС] Запрос реального баланса...');
    const timestamp = Date.now();
    const params = { timestamp, recvWindow: 5000 };
    const signature = signBingXRequest(params);
    const url = `${BINGX_API_BASE_URL}/openApi/spot/v2/account/balance?timestamp=${timestamp}&recvWindow=5000&signature=${signature}`;
    console.log('🌐 [БАЛАНС] Отправляю запрос:', url);
    const response = await axios.get(url, { headers: { 'X-BX-APIKEY': BINGX_API_KEY }, timeout: 10000 });
    if (response.data.code === 0 && Array.isArray(response.data.data.balances)) {
      const usdt = response.data.data.balances.find(b => b.asset === 'USDT');
      if (usdt) {
        const balance = parseFloat(usdt.free);
        console.log(`💰 Баланс: $${balance.toFixed(2)}`);
        return balance;
      }
    }
    console.error('❌ Не найден баланс USDT. Ответ от BingX:', JSON.stringify(response.data));
    return null;
  } catch (error) {
    console.error('❌ Ошибка получения баланса:', error.message);
    return null;
  }
}

// ==========================
// ФУНКЦИЯ: Получение исторических свечей (SPOT)
// ==========================
async function getBingXSpotHistory(symbol, interval = '1h', limit = 100) {
  try {
    const serverTime = await getBingXServerTime();
    const timestamp = serverTime;
    const params = { symbol, interval, limit, timestamp, recvWindow: 5000 };
    const signature = signBingXRequest(params);
    const url = `${BINGX_API_BASE_URL}/openApi/spot/v2/market/klines?symbol=${params.symbol}&interval=${params.interval}&limit=${params.limit}&timestamp=${params.timestamp}&recvWindow=5000&signature=${signature}`;
    const response = await axios.get(url, { headers: { 'X-BX-APIKEY': BINGX_API_KEY }, timeout: 10000 });
    if (response.data.code === 0 && Array.isArray(response.data.data)) {
      return response.data.data.map(candle => ({
        time: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));
    }
    console.error(`❌ Ошибка для ${symbol}:`, response.data.msg);
    return [];
  } catch (error) {
    console.error(`❌ Ошибка получения истории для ${symbol}:`, error.message);
    return [];
  }
}

// ==========================
// ФУНКЦИЯ: Получение текущих цен (SPOT)
// ==========================
async function getCurrentPrices() {
  const prices = {};
  const serverTime = await getBingXServerTime();
  for (const coin of globalState.watchlist) {
    const params = { symbol: coin.symbol, timestamp: serverTime, recvWindow: 5000 };
    const signature = signBingXRequest(params);
    const url = `${BINGX_API_BASE_URL}/openApi/spot/v2/market/ticker?symbol=${params.symbol}&timestamp=${params.timestamp}&recvWindow=5000&signature=${signature}`;
    try {
      const response = await axios.get(url, { headers: { 'X-BX-APIKEY': BINGX_API_KEY }, timeout: 10000 });
      if (response.data.code === 0 && response.data.data && response.data.data.price) {
        prices[coin.name] = parseFloat(response.data.data.price);
        console.log(`✅ Цена для ${coin.symbol}: $${prices[coin.name]}`);
      } else {
        console.error(`❌ Ошибка для ${coin.symbol}:`, response.data.msg);
      }
    } catch (error) {
      console.error(`❌ Не удалось получить цену для ${coin.symbol}:`, error.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  globalState.currentPrices = prices;
  return prices;
}

// ==========================
// ФУНКЦИЯ: Размещение ордера (SPOT)
// ==========================
async function placeBingXSpotOrder(symbol, side, type, quantity, price = null) {
  try {
    const serverTime = await getBingXServerTime();
    const timestamp = serverTime;
    const params = {
      symbol: symbol,
      side,
      type,
      quantity: quantity.toFixed(6),
      timestamp,
      recvWindow: 5000
    };
    if (price && type === 'LIMIT') params.price = price.toFixed(8);
    const signature = signBingXRequest(params);
    let url = `${BINGX_API_BASE_URL}/openApi/spot/v2/trade/order?symbol=${params.symbol}&side=${params.side}&type=${params.type}&quantity=${params.quantity}&timestamp=${params.timestamp}&recvWindow=5000&signature=${signature}`;
    if (price && type === 'LIMIT') url += `&price=${price.toFixed(8)}`;
    const response = await axios.post(url, null, {
      headers: { 'X-BX-APIKEY': BINGX_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000
    });
    if (response.data.code === 0) {
      console.log(`✅ УСПЕШНЫЙ ОРДЕР: ${side} ${quantity} ${symbol}`);
      return response.data.data;
    } else {
      console.error(`❌ ОШИБКА ОРДЕРА:`, response.data.msg);
      return null;
    }
  } catch (error) {
    console.error(`💥 Ошибка при размещении ордера:`, error.message);
    return null;
  }
}

// ==========================
// ФУНКЦИЯ: Открытие позиции (SPOT)
// ==========================
async function openSpotTrade(coin, direction, size, price) {
  const symbol = coin.symbol;
  const side = direction === 'LONG' ? 'BUY' : 'SELL';
  console.log(`🌐 Отправка ${direction} ордера на BingX SPOT: ${size} ${symbol}`);

  if (globalState.isRealMode) {
    const result = await placeBingXSpotOrder(symbol, side, 'MARKET', size);
    if (result) {
      const fee = size * price * globalState.takerFee;
      const trade = {
        coin: coin.name,
        type: direction,
        size,
        entryPrice: price,
        currentPrice: price,
        fee,
        timestamp: new Date().toLocaleString(),
        status: 'OPEN',
        riskScore: calculateRiskScore(coin.name)
      };
      globalState.history.push(trade);
      globalState.positions[coin.name] = trade;
      globalState.stats.totalTrades++;
      console.log(`✅ УСПЕШНО: ${direction} ${size} ${coin.name}`);
      return true;
    }
    return false;
  } else {
    const cost = size * price;
    const fee = cost * globalState.takerFee;
    if (cost + fee > globalState.balance * globalState.maxRiskPerTrade) {
      console.log(`❌ Риск превышает ${globalState.maxRiskPerTrade * 100}% от депозита`);
      return false;
    }
    globalState.balance -= fee;
    const trade = {
      coin: coin.name,
      type: direction,
      size,
      entryPrice: price,
      currentPrice: price,
      fee,
      timestamp: new Date().toLocaleString(),
      status: 'OPEN',
      riskScore: calculateRiskScore(coin.name)
    };
    globalState.history.push(trade);
    globalState.positions[coin.name] = trade;
    globalState.stats.totalTrades++;
    console.log(`✅ ДЕМО: ${direction} ${size} ${coin.name}`);
    return true;
  }
}

// ==========================
// ФУНКЦИЯ: Расчет рисковой оценки
// ==========================
function calculateRiskScore(coin) {
  const fundamentalData = globalState.marketMemory.fundamentalData[coin];
  const volatility = globalState.marketMemory.volatilityHistory[coin][globalState.marketMemory.volatilityHistory[coin].length - 1] || 0.02;
  let riskScore = 50;
  if (volatility > 0.05) riskScore += 20;
  if (volatility < 0.02) riskScore -= 10;
  if (fundamentalData) {
    if (fundamentalData.marketCapRank <= 10) riskScore -= 15;
    else if (fundamentalData.marketCapRank > 50) riskScore += 10;
    if (fundamentalData.developerActivity > 70) riskScore -= 10;
    else if (fundamentalData.developerActivity < 30) riskScore += 15;
    if (fundamentalData.socialSentiment > 70) riskScore -= 5;
    else if (fundamentalData.socialSentiment < 30) riskScore += 10;
    if (fundamentalData.communityGrowth > 0.1) riskScore -= 5;
    else if (fundamentalData.communityGrowth < -0.1) riskScore += 10;
  }
  if (globalState.fearIndex < 30) riskScore -= 15;
  else if (globalState.fearIndex > 70) riskScore += 15;
  return Math.max(0, Math.min(100, riskScore));
}

// ==========================
// ФУНКЦИЯ: Получение фундаментальных данных
// ==========================
async function getFundamentalData(coin) {
  const now = Date.now();
  const cacheKey = coin.name;
  const cacheDuration = 3600000;
  if (globalState.fundamentalCache[cacheKey] && now - globalState.fundamentalCache[cacheKey].timestamp < cacheDuration) {
    console.log(`💾 Кэш для ${coin.name}`);
    return globalState.fundamentalCache[cacheKey].data;
  }
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coin.name}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: true,
        developer_data: true,
        sparkline: false
      },
      timeout: 10000
    });
    const data = response.data;
    const fundamentalData = {
      developerActivity: data.developer_data?.commits_30d || 50,
      socialSentiment: data.market_data?.sentiment_votes_up_percentage || 50,
      marketCapRank: data.market_cap_rank || 100,
      communityGrowth: data.community_data?.reddit_subscribers_7d_change_pct || 0,
      totalSupply: data.market_data?.total_supply || null,
      circulatingSupply: data.market_data?.circulating_supply || null
    };
    globalState.marketMemory.fundamentalData[coin.name] = fundamentalData;
    globalState.fundamentalCache[cacheKey] = { fundamentalData, timestamp: now };
    console.log(`✅ Фундаментальные данные для ${coin.name} обновлены`);
    await new Promise(r => setTimeout(r, 2000));
    return fundamentalData;
  } catch (error) {
    console.error(`❌ Ошибка получения фундаментальных данных для ${coin.name}:`, error.message);
    if (globalState.fundamentalCache[cacheKey]) return globalState.fundamentalCache[cacheKey].data;
    return {
      developerActivity: 50,
      socialSentiment: 50,
      marketCapRank: 100,
      communityGrowth: 0
    };
  }
}

// ==========================
// ФУНКЦИЯ: Расчет технических индикаторов
// ==========================
function calculateTechnicalIndicators(candles) {
  if (candles.length < 20) return null;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const sma20 = closes.slice(-20).reduce((sum, p) => sum + p, 0) / 20;
  const ema12 = calculateEMA(closes.slice(-12), 12);
  const ema26 = calculateEMA(closes.slice(-26), 26);
  const rsi14 = calculateRSI(closes.slice(-15));
  const macd = ema12 - ema26;
  const signalLine = calculateEMA([macd], 9);
  const stdDev = Math.sqrt(closes.slice(-20).reduce((sum, p) => sum + Math.pow(p - sma20, 2), 0) / 20);
  const upperBand = sma20 + (2 * stdDev);
  const lowerBand = sma20 - (2 * stdDev);
  const recentHigh = Math.max(...highs.slice(-14));
  const recentLow = Math.min(...lows.slice(-14));
  const currentClose = closes[closes.length - 1];
  const stochastic = ((currentClose - recentLow) / (recentHigh - recentLow)) * 100;
  const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
  const volumeRatio = volumes[volumes.length - 1] / avgVolume;

  return {
    sma20, ema12, ema26, rsi14, macd, signalLine,
    upperBand, lowerBand, stochastic, volumeRatio,
    currentPrice: currentClose
  };
}

function calculateEMA(prices, period) {
  if (prices.length === 0) return 0;
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  return ema;
}

function calculateRSI(prices) {
  if (prices.length < 2) return 50;
  let gains = 0, losses = 0, count = 0;
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i-1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
    count++;
  }
  const avgGain = gains / count;
  const avgLoss = losses / count;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ==========================
// ФУНКЦИЯ: Расширенный анализ рынка
// ==========================
function analyzeMarketAdvanced(candles, coinName, fundamentalData) {
  if (candles.length < 50) return null;
  const indicators = calculateTechnicalIndicators(candles);
  if (!indicators) return null;
  const currentPrice = indicators.currentPrice;
  let buySignals = 0, sellSignals = 0;
  const reasoning = [];

  if (currentPrice > indicators.sma20) { buySignals++; reasoning.push("📈 Цена выше SMA20"); }
  else { sellSignals++; reasoning.push("📉 Цена ниже SMA20"); }

  if (indicators.macd > indicators.signalLine) { buySignals++; reasoning.push("📊 MACD выше сигнальной линии"); }
  else { sellSignals++; reasoning.push("📊 MACD ниже сигнальной линии"); }

  if (indicators.rsi14 < 30) { buySignals++; reasoning.push("🟢 RSI < 30 — перепроданность"); }
  else if (indicators.rsi14 > 70) { sellSignals++; reasoning.push("🔴 RSI > 70 — перекупленность"); }

  if (currentPrice < indicators.lowerBand) { buySignals++; reasoning.push("🎯 Цена ниже нижней полосы Боллинджера"); }
  else if (currentPrice > indicators.upperBand) { sellSignals++; reasoning.push("🎯 Цена выше верхней полосы Боллинджера"); }

  if (indicators.stochastic < 20) { buySignals++; reasoning.push("🎲 Стохастик < 20"); }
  else if (indicators.stochastic > 80) { sellSignals++; reasoning.push("🎲 Стохастик > 80"); }

  if (indicators.volumeRatio > 1.5) {
    if (currentPrice > candles[candles.length - 2].close) { buySignals++; reasoning.push("🔊 Высокий объем подтверждает восходящее движение"); }
    else { sellSignals++; reasoning.push("🔊 Высокий объем подтверждает нисходящее движение"); }
  }

  if (fundamentalData) {
    if (fundamentalData.marketCapRank <= 10) { buySignals += 0.5; reasoning.push("💎 Топ-10 по капитализации"); }
    if (fundamentalData.developerActivity > 70) { buySignals += 0.5; reasoning.push("👨‍💻 Активные разработчики"); }
    if (fundamentalData.socialSentiment > 70) { buySignals += 0.3; reasoning.push("💬 Позитивные настроения"); }
    if (fundamentalData.communityGrowth > 0.1) { buySignals += 0.3; reasoning.push("👥 Рост сообщества"); }
  }

  if (globalState.fearIndex < 30) { buySignals += 0.5; reasoning.push("😌 Индекс страха низкий"); }
  else if (globalState.fearIndex > 70) { sellSignals += 0.5; reasoning.push("😱 Индекс страха высокий"); }

  const direction = buySignals > sellSignals ? 'LONG' : 'SHORT';
  const confidence = Math.abs(buySignals - sellSignals) / (buySignals + sellSignals + 1);

  return {
    coin: coinName,
    currentPrice,
    signal: { direction, confidence, reasoning },
    indicators: {
      rsi: indicators.rsi14.toFixed(2),
      macd: indicators.macd.toFixed(4),
      stochastic: indicators.stochastic.toFixed(2),
      volumeRatio: indicators.volumeRatio.toFixed(2)
    }
  };
}

// ==========================
// ФУНКЦИЯ: Принудительное обновление баланса
// ==========================
async function forceUpdateRealBalance() {
  console.log('🔄 [БАЛАНС] Принудительное обновление...');
  const balance = await getBingXRealBalance();
  if (balance !== null) {
    globalState.realBalance = balance;
    console.log(`✅ [БАЛАНС] Обновлён: $${balance.toFixed(2)}`);
  }
  return balance;
}

// ==========================
// ФУНКЦИЯ: Переключение режима
// ==========================
function toggleMode() {
  globalState.isRealMode = !globalState.isRealMode;
  console.log(`🔄 Режим переключён на: ${globalState.isRealMode ? 'РЕАЛЬНЫЙ' : 'ДЕМО'}`);
  if (globalState.isRealMode) forceUpdateRealBalance();
  return globalState.isRealMode;
}

// ==========================
// ФУНКЦИЯ: Переключение торгового режима
// ==========================
function toggleTradeMode() {
  const modes = ['scalping', 'adaptive'];
  const currentIndex = modes.indexOf(globalState.tradeMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  globalState.tradeMode = modes[nextIndex];
  console.log(`⚡ Торговый режим переключён на: ${globalState.tradeMode}`);
  return globalState.tradeMode;
}

// ==========================
// ФУНКЦИЯ: Установка уровня риска
// ==========================
function setRiskLevel(level) {
  globalState.riskLevel = level;
  switch(level) {
    case 'recommended':
      globalState.maxRiskPerTrade = 0.01;
      globalState.maxLeverage = 3;
      console.log('📉 Установлен СТАНДАРТНЫЙ уровень риска: 1%, плечо 3x');
      break;
    case 'medium':
      globalState.maxRiskPerTrade = 0.02;
      globalState.maxLeverage = 5;
      console.log('⚖️ Установлен СРЕДНИЙ уровень риска: 2%, плечо 5x');
      break;
    case 'high':
      globalState.maxRiskPerTrade = 0.05;
      globalState.maxLeverage = 10;
      console.log('🚀 Установлен ВЫСОКИЙ уровень риска: 5%, плечо 10x');
      break;
  }
  return globalState.riskLevel;
}

// ==========================
// HTTP-сервер
// ==========================
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function authenticate(req, res, next) {
  if (req.path === '/login' || req.path === '/favicon.ico') return next();
  if (req.cookies.authToken) return next();
  res.redirect('/login');
}
app.use(authenticate);

app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head><meta charset="UTF-8"><title>Вход в систему</title>
    <style>body{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.login-form{background:white;padding:40px;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.1);text-align:center;width:100%;max-width:450px}input{width:100%;padding:15px;margin:15px 0;border:2px solid #e0e0e0;border-radius:8px;font-size:16px}button{width:100%;padding:15px;background:#3498db;color:white;border:none;border-radius:8px;cursor:pointer;font-size:18px;font-weight:bold}button:hover{background:#2980b9}h2{color:#2c3e50;margin-bottom:30px;font-size:28px}.logo{margin-bottom:30px;color:#3498db;font-size:36px;font-weight:bold}</style></head>
    <body><div class="login-form"><div class="logo">Философ Рынка</div><h2>Торговый Бот v6.1</h2><form id="loginForm"><input type="password" name="password" placeholder="Введите пароль" required><button type="submit">Войти в систему</button></form></div>
    <script>document.getElementById('loginForm').addEventListener('submit', async (e) => { e.preventDefault(); const password = document.querySelector('input[name="password"]').value; const res = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const data = await res.json(); if (data.success) { document.cookie = "authToken=true; path=/; max-age=86400"; window.location.href = '/'; } else { alert('❌ Неверный пароль.'); document.querySelector('input[name="password"]').value = ''; } });</script></body></html>
  `);
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.cookie('authToken', 'true', { path: '/', maxAge: 86400000 });
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.redirect('/login');
});

app.post('/toggle-mode', (req, res) => {
  const newMode = toggleMode();
  res.json({ success: true, isRealMode: newMode });
});

app.post('/toggle-trade-mode', (req, res) => {
  toggleTradeMode();
  res.json({ success: true });
});

app.post('/set-risk-level', (req, res) => {
  const { level } = req.body;
  setRiskLevel(level);
  res.json({ success: true });
});

app.get('/api/status', (req, res) => {
  const openPositions = Object.values(globalState.positions).filter(p => p !== null);
  res.json({
    balance: globalState.balance,
    realBalance: globalState.realBalance,
    isRealMode: globalState.isRealMode,
    tradeMode: globalState.tradeMode,
    riskLevel: globalState.riskLevel,
    fearIndex: globalState.fearIndex,
    stats: globalState.stats,
    openPositions,
    history: globalState.history,
    currentPrices: globalState.currentPrices,
    lastAnalysis: globalState.lastAnalysis || []
  });
});

// ==========================
// ГЛАВНАЯ ФУНКЦИЯ — ЦИКЛ БОТА
// ==========================
(async () => {
  console.log('🤖 ЗАПУСК ТОРГОВОГО БОТА v6.1 — ИСПРАВЛЕНА ОШИБКА SERVER TIME');
  console.log('🔑 API-ключи: ЗАДАНЫ');
  console.log('🔐 Секретный ключ: ЗАДАН');
  console.log('✅ Проверка доступных монет на BingX...');

  // Проверяем доступность монет через правильный эндпоинт SPOT
  for (const coin of [...globalState.watchlist]) {
    console.log(`🔍 Проверка доступности ${coin.symbol}...`);
    try {
      const serverTime = await getBingXServerTime();
      const params = { symbol: coin.symbol, timestamp: serverTime, recvWindow: 5000 };
      const signature = signBingXRequest(params);
      const url = `${BINGX_API_BASE_URL}/openApi/spot/v2/market/ticker?symbol=${params.symbol}&timestamp=${params.timestamp}&recvWindow=5000&signature=${signature}`;
      const response = await axios.get(url, { headers: { 'X-BX-APIKEY': BINGX_API_KEY }, timeout: 10000 });
      if (response.data.code === 0 && response.data.data && response.data.data.price) {
        console.log(`✅ Монета ${coin.symbol} доступна на BingX`);
      } else {
        console.warn(`⚠️ Монета ${coin.symbol} НЕ доступна на BingX. Удалена.`);
        globalState.watchlist = globalState.watchlist.filter(c => c.symbol !== coin.symbol);
      }
    } catch (error) {
      console.error(`❌ Ошибка проверки ${coin.symbol}:`, error.message);
      globalState.watchlist = globalState.watchlist.filter(c => c.symbol !== coin.symbol);
    }
  }
  console.log(`✅ Актуальный список монет: ${globalState.watchlist.length} шт. (${globalState.watchlist.map(c => c.symbol).join(', ')})`);

  setRiskLevel('high');
  globalState.tradeMode = 'scalping';
  await forceUpdateRealBalance();
  globalState.lastAnalysis = [];

  while (globalState.isRunning) {
    try {
      console.log(`
[${new Date().toLocaleTimeString()}] === АНАЛИЗ РЫНКА ===`);
      const fearIndex = await getFearAndGreedIndex();
      console.log(`😱 Индекс страха: ${fearIndex}`);

      if (Date.now() % 300000 < 10000 && globalState.isRealMode) await forceUpdateRealBalance();

      const currentPrices = await getCurrentPrices();
      globalState.currentPrices = currentPrices;

      for (const coin of globalState.watchlist) await getFundamentalData(coin);

      let bestOpportunity = null;
      globalState.lastAnalysis = [];

      for (const coin of globalState.watchlist) {
        console.log(`\n🔍 Анализирую ${coin.name}...`);
        const candles = await getBingXSpotHistory(coin.symbol, '1h', 100);
        if (candles.length < 50) { console.log(`   ⚠️ Пропускаем — недостаточно данных`); continue; }

        const prices = candles.map(c => c.close);
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const volatility = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length) / avgPrice;
        globalState.marketMemory.volatilityHistory[coin.name].push(volatility);
        if (globalState.marketMemory.volatilityHistory[coin.name].length > 24) globalState.marketMemory.volatilityHistory[coin.name].shift();

        const fundamentalData = globalState.marketMemory.fundamentalData[coin.name];
        const analysis = analyzeMarketAdvanced(candles, coin.name, fundamentalData);
        if (!analysis || !analysis.signal.direction) continue;

        globalState.lastAnalysis.push(analysis);
        if (!bestOpportunity || analysis.signal.confidence > (bestOpportunity?.signal?.confidence || 0)) {
          bestOpportunity = analysis;
        }

        console.log(`   📊 RSI: ${analysis.indicators.rsi}, MACD: ${analysis.indicators.macd}, Стохастик: ${analysis.indicators.stochastic}`);
        console.log(`   💡 Сигнал: ${analysis.signal.direction} (уверенность: ${(analysis.signal.confidence * 100).toFixed(1)}%)`);
      }

      if (bestOpportunity && (globalState.isRealMode || globalState.balance > 10)) {
        console.log(`
💎 ЛУЧШАЯ ВОЗМОЖНОСТЬ: ${bestOpportunity.signal.direction} по ${bestOpportunity.coin}
   📈 Уверенность: ${(bestOpportunity.signal.confidence * 100).toFixed(1)}%
   🧠 Причины: ${bestOpportunity.signal.reasoning.join('; ')}`);

        const price = bestOpportunity.currentPrice;
        const riskAmount = globalState.isRealMode ? (globalState.realBalance || 100) : globalState.balance;
        const baseSize = (riskAmount * globalState.maxRiskPerTrade) / price;
        const finalSize = Math.max(0.001, baseSize);

        console.log(`
🟢 ВХОД: ${bestOpportunity.signal.direction} ${finalSize.toFixed(6)} ${bestOpportunity.coin} (цена: $${price.toFixed(4)})`);
        
        await openSpotTrade(
          { symbol: bestOpportunity.coin.toUpperCase() + '-USDT', name: bestOpportunity.coin },
          bestOpportunity.signal.direction,
          finalSize,
          price
        );
      } else {
        console.log(`
⚪ Нет подходящих возможностей — ожидаем...`);
      }

      globalState.stats.winRate = globalState.stats.totalTrades > 0
        ? (globalState.stats.profitableTrades / globalState.stats.totalTrades) * 100
        : 0;

      if (Date.now() % 60000 < 10000) {
        console.log(`
💰 Баланс: $${(globalState.isRealMode ? globalState.realBalance : globalState.balance)?.toFixed(2) || '...'}`);
      }

      // Для скальпинга — частота анализа 10 секунд
      const delay = globalState.tradeMode === 'scalping' ? 10000 : 60000;
      console.log(`💤 Ждём ${delay / 1000} секунд...`);
      await new Promise(r => setTimeout(r, delay));

    } catch (error) {
      console.error('💥 КРИТИЧЕСКАЯ ОШИБКА В ЦИКЛЕ:', error.message);
      await new Promise(r => setTimeout(r, 60000));
    }
  }
})();

// ==========================
// ЗАПУСК СЕРВЕРА
// ==========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Доступ к интерфейсу: http://localhost:${PORT}`);
  console.log(`🔐 Пароль для входа: ${APP_PASSWORD}`);
  console.log('✅ ВАЖНО: Для работы бота нужно установить переменные окружения:');
  console.log('   - BINGX_API_KEY');
  console.log('   - BINGX_SECRET_KEY');
  console.log('   - APP_PASSWORD (по желанию)');
});
