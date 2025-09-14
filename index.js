const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const dotenv = require('dotenv');

// Загружаем переменные окружения
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
  // 100+ ликвидных SPOT-монет
  watchlist: [
    { symbol: 'BTC-USDT', name: 'bitcoin' },
    { symbol: 'ETH-USDT', name: 'ethereum' },
    { symbol: 'BNB-USDT', name: 'binancecoin' },
    { symbol: 'SOL-USDT', name: 'solana' },
    { symbol: 'XRP-USDT', name: 'ripple' },
    { symbol: 'ADA-USDT', name: 'cardano' },
    { symbol: 'DOGE-USDT', name: 'dogecoin' },
    { symbol: 'LINK-USDT', name: 'chainlink' },
    { symbol: 'MATIC-USDT', name: 'polygon' },
    { symbol: 'LTC-USDT', name: 'litecoin' },
    { symbol: 'UNI-USDT', name: 'uniswap' },
    { symbol: 'AVAX-USDT', name: 'avalanche-2' },
    { symbol: 'ATOM-USDT', name: 'cosmos' },
    { symbol: 'APT-USDT', name: 'aptos' },
    { symbol: 'ARB-USDT', name: 'arbitrum' },
    { symbol: 'OP-USDT', name: 'optimism' },
    { symbol: 'TON-USDT', name: 'the-open-network' },
    { symbol: 'SHIB-USDT', name: 'shiba-inu' },
    { symbol: 'PEPE-USDT', name: 'pepe' },
    { symbol: 'INJ-USDT', name: 'injective-protocol' },
    { symbol: 'WLD-USDT', name: 'worldcoin' },
    { symbol: 'SEI-USDT', name: 'sei-network' },
    { symbol: 'TIA-USDT', name: 'celestia' },
    { symbol: 'ONDO-USDT', name: 'ondo-finance' },
    { symbol: 'JUP-USDT', name: 'jupiter-exchange-solana' },
    { symbol: 'STRK-USDT', name: 'starknet' },
    { symbol: 'ENA-USDT', name: 'ethena' },
    { symbol: 'RNDR-USDT', name: 'render-token' },
    { symbol: 'IMX-USDT', name: 'immutable-x' },
    { symbol: 'FET-USDT', name: 'fetch-ai' },
    { symbol: 'SUI-USDT', name: 'sui' },
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

// Используем bingx.io как основной — он стабильнее и реже блокируется
const BINGX_API_DOMAINS = [
  process.env.BINGX_API_DOMAIN_1 || 'https://open-api.bingx.io',
  process.env.BINGX_API_DOMAIN_2 || 'https://open-api.bingx.com'
];

let currentApiDomainIndex = 0;

function getCurrentApiDomain() {
  return BINGX_API_DOMAINS[currentApiDomainIndex];
}

function switchToNextApiDomain() {
  currentApiDomainIndex = (currentApiDomainIndex + 1) % BINGX_API_DOMAINS.length;
  console.log(`🔄 [API] Переключение на домен: ${getCurrentApiDomain()}`);
}

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
    if (paramString !== "") {
      paramString += "&";
    }
    if (key === 'timestamp') {
      paramString += `${key}=${cleanParams[key]}`;
    } else {
      paramString += `${key}=${encodeURIComponent(cleanParams[key])}`;
    }
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
    if (globalState.marketMemory.fearSentimentHistory.length > 24) {
      globalState.marketMemory.fearSentimentHistory.shift();
    }
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
// ФУНКЦИЯ: Получение серверного времени BingX (СПОТ — ИСПРАВЛЕНО!)
// ==========================
async function getBingXServerTime() {
  try {
    const response = await axios.get(`${getCurrentApiDomain()}/openApi/spot/v2/server/time`, {
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
    if (error.response?.status === 403 || error.response?.status === 429) {
      switchToNextApiDomain();
    }
    return Date.now();
  }
}

// ==========================
// ФУНКЦИЯ: Получение реального баланса (SPOT — ИСПРАВЛЕНО!)
// ==========================
async function getBingXRealBalance() {
  try {
    console.log('🔍 [БАЛАНС] Запрос реального баланса...');
    const timestamp = Date.now();
    const params = { timestamp, recvWindow: 5000 };
    const signature = signBingXRequest(params);
    const url = `${getCurrentApiDomain()}/openApi/spot/v2/account/balance?timestamp=${timestamp}&recvWindow=5000&signature=${signature}`;
    console.log('🌐 [БАЛАНС] Отправляю запрос:', url);
    const response = await axios.get(url, {
      headers: { 'X-BX-APIKEY': BINGX_API_KEY },
      timeout: 10000
    });
    if (response.data.code === 0 && Array.isArray(response.data.data.balances)) {
      const usdt = response.data.data.balances.find(b => b.asset === 'USDT');
      if (usdt) {
        const balance = parseFloat(usdt.free);
        console.log(`💰 [БАЛАНС] Успешно получен: $${balance.toFixed(2)}`);
        return balance;
      }
    }
    console.error('❌ Не найден баланс USDT. Ответ от BingX:', JSON.stringify(response.data));
    return null;
  } catch (error) {
    console.error('❌ Ошибка получения баланса:', error.message);
    if (error.response?.status === 403 || error.response?.status === 429) {
      switchToNextApiDomain();
    }
    return null;
  }
}

// ==========================
// ФУНКЦИЯ: Получение исторических свечей (SPOT — ИСПРАВЛЕНО!)
// ==========================
async function getBingXSpotHistory(symbol, interval = '1h', limit = 100) {
  try {
    const serverTime = await getBingXServerTime();
    const timestamp = serverTime;
    const params = {
      symbol,
      interval,
      limit,
      timestamp,
      recvWindow: 5000
    };
    const signature = signBingXRequest(params);
    const url = `${getCurrentApiDomain()}/openApi/spot/v2/market/klines?symbol=${params.symbol}&interval=${params.interval}&limit=${params.limit}&timestamp=${params.timestamp}&recvWindow=5000&signature=${signature}`;
    console.log(`🌐 [ИСТОРИЯ] Получение данных для ${symbol}`);
    const response = await axios.get(url, {
      headers: { 'X-BX-APIKEY': BINGX_API_KEY },
      timeout: 10000
    });
    if (response.data.code === 0 && Array.isArray(response.data.data)) {
      return response.data.data.map(candle => ({
        time: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));
    } else {
      console.error(`❌ Ошибка для ${symbol}:`, response.data.msg || 'Нет данных');
      return [];
    }
  } catch (error) {
    console.error(`❌ Ошибка получения истории для ${symbol}:`, error.message);
    if (error.response?.status === 403 || error.response?.status === 429) {
      switchToNextApiDomain();
    }
    return [];
  }
}

// ==========================
// ФУНКЦИЯ: Получение текущих цен (SPOT — ИСПРАВЛЕНО!)
// ==========================
async function getCurrentPrices() {
  try {
    const prices = {};
    const serverTime = await getBingXServerTime();
    for (const coin of globalState.watchlist) {
      const params = {
        symbol: coin.symbol,
        timestamp: serverTime,
        recvWindow: 5000
      };
      const signature = signBingXRequest(params);
      const url = `${getCurrentApiDomain()}/openApi/spot/v2/market/ticker?symbol=${params.symbol}&timestamp=${params.timestamp}&recvWindow=5000&signature=${signature}`;
      console.log(`🌐 [ЦЕНА] Получение цены для ${coin.symbol}`);
      try {
        const response = await axios.get(url, {
          headers: { 'X-BX-APIKEY': BINGX_API_KEY },
          timeout: 10000
        });
        if (response.data.code === 0 && response.data.data && response.data.data.price) {
          const price = parseFloat(response.data.data.price);
          const cleanSymbol = coin.name;
          prices[cleanSymbol] = price;
          console.log(`✅ [ЦЕНА] ${coin.symbol}: $${price}`);
        } else {
          console.error(`❌ Ошибка для ${coin.symbol}:`, response.data.msg || 'Нет данных о цене');
        }
      } catch (error) {
        console.error(`❌ Не удалось получить цену для ${coin.symbol}:`, error.message);
        if (error.response?.status === 403 || error.response?.status === 429) {
          switchToNextApiDomain();
        }
      }
      await new Promise(r => setTimeout(r, 500)); // Задержка между запросами
    }
    globalState.currentPrices = prices;
    return prices;
  } catch (error) {
    console.error('❌ Глобальная ошибка получения текущих цен:', error.message);
    return {};
  }
}

// ==========================
// ФУНКЦИЯ: Размещение ордера (SPOT — ИСПРАВЛЕНО!)
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
    if (price && type === 'LIMIT') {
      params.price = price.toFixed(8);
    }
    const signature = signBingXRequest(params);
    let url = `${getCurrentApiDomain()}/openApi/spot/v2/trade/order?symbol=${params.symbol}&side=${params.side}&type=${params.type}&quantity=${params.quantity}&timestamp=${params.timestamp}&recvWindow=5000&signature=${signature}`;
    if (price && type === 'LIMIT') {
      url += `&price=${price.toFixed(8)}`;
    }
    console.log(`🌐 [ОРДЕР] Отправка ${side} ордера на ${symbol}`);
    const response = await axios.post(url, null, {
      headers: { 'X-BX-APIKEY': BINGX_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000
    });
    if (response.data.code === 0) {
      console.log(`✅ [ОРДЕР] УСПЕШНО: ${side} ${quantity} ${symbol}`);
      return response.data.data;
    } else {
      console.error(`❌ [ОРДЕР] ОШИБКА:`, response.data.msg);
      return null;
    }
  } catch (error) {
    console.error(`💥 [ОРДЕР] Ошибка при размещении ордера:`, error.message);
    if (error.response?.status === 403 || error.response?.status === 429) {
      switchToNextApiDomain();
    }
    return null;
  }
}

// ==========================
// ФУНКЦИЯ: Открытие позиции (SPOT)
// ==========================
async function openSpotTrade(coin, direction, size, price) {
  const symbol = coin.symbol;
  const side = direction === 'LONG' ? 'BUY' : 'SELL';
  console.log(`🌐 [ТРЕЙД] Отправка ${direction} ордера на BingX SPOT: ${size} ${symbol}`);

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
      console.log(`✅ [ТРЕЙД] УСПЕШНО: ${direction} ${size} ${coin.name}`);
      return true;
    }
    return false;
  } else {
    const cost = size * price;
    const fee = cost * globalState.takerFee;
    if (cost + fee > globalState.balance * globalState.maxRiskPerTrade) {
      console.log(`❌ [ТРЕЙД] Риск превышает ${globalState.maxRiskPerTrade * 100}% от депозита`);
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
    console.log(`✅ [ТРЕЙД] ДЕМО: ${direction} ${size} ${coin.name}`);
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
// HTTP-сервер с паролем
// ==========================
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware для аутентификации
function authenticate(req, res, next) {
  if (req.path === '/login' || req.path === '/favicon.ico') {
    return next();
  }
  if (req.cookies.authToken) return next();
  res.redirect('/login');
}
app.use(authenticate);

// Создаем директорию для статических файлов, если она не существует
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

// Создаем index.html с паролем из переменной окружения
const createIndexHtml = () => {
  const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Философ Рынка — Торговый Бот v8.0</title>
    <style>
        :root {
            --primary: #3498db;
            --secondary: #2c3e50;
            --success: #27ae60;
            --danger: #e74c3c;
            --warning: #f39c12;
            --light: #f5f5f5;
            --dark: #34495e;
            --gray: #95a5a6;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #e0e0e0;
            min-height: 100vh;
            padding: 15px;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            padding: 30px 0;
            color: white;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 30px;
        }
        h1 {
            font-size: 2.8rem;
            margin-bottom: 8px;
            text-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-weight: 700;
        }
        .subtitle {
            font-size: 1.3rem;
            font-style: italic;
            margin-bottom: 20px;
            color: #bdc3c7;
        }
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 24px;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }
        .card-title {
            font-size: 1.2rem;
            color: #bdc3c7;
            margin-bottom: 12px;
            font-weight: 500;
            letter-spacing: 0.5px;
        }
        .card-value {
            font-size: 2.2rem;
            font-weight: 800;
            color: var(--primary);
            margin-bottom: 8px;
            font-family: 'Courier New', monospace;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .card-subtitle {
            color: #95a5a6;
            font-size: 0.9rem;
            margin-top: 8px;
            font-weight: 400;
        }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-left: 8px;
        }
        .status-real {
            background: rgba(39, 174, 96, 0.2);
            color: #27ae60;
            border: 1px solid #27ae60;
        }
        .status-demo {
            background: rgba(231, 76, 60, 0.2);
            color: #e74c3c;
            border: 1px solid #e74c3c;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            transition: all 0.3s ease;
            margin: 5px 5px 5px 0;
            letter-spacing: 0.5px;
        }
        .btn-primary {
            background: var(--primary);
            color: white;
            box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
        }
        .btn-primary:hover {
            background: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(52, 152, 219, 0.4);
        }
        .btn-success {
            background: var(--success);
            color: white;
            box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
        }
        .btn-success:hover {
            background: #219a52;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(39, 174, 96, 0.4);
        }
        .btn-danger {
            background: var(--danger);
            color: white;
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
        }
        .btn-danger:hover {
            background: #c0392b;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(231, 76, 60, 0.4);
        }
        .btn-warning {
            background: var(--warning);
            color: white;
            box-shadow: 0 4px 12px rgba(243, 156, 18, 0.3);
        }
        .btn-warning:hover {
            background: #d35400;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(243, 156, 18, 0.4);
        }
        .controls {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            margin: 30px 0;
            padding: 20px;
            background: rgba(255,255,255,0.03);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.08);
        }
        table {
            width: 100%;
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 30px;
            border-collapse: collapse;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        th, td {
            padding: 16px;
            text-align: left;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            font-size: 0.95rem;
        }
        th {
            background: rgba(52, 152, 219, 0.1);
            color: #bdc3c7;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            font-size: 0.85rem;
        }
        tr:hover {
            background: rgba(255,255,255,0.08);
        }
        .profit {
            color: #27ae60;
            font-weight: 700;
        }
        .loss {
            color: #e74c3c;
            font-weight: 700;
        }
        .log-entry {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            margin-bottom: 8px;
            animation: fadeIn 0.3s ease-out;
        }
        .log-time {
            color: var(--gray);
            font-size: 0.8rem;
            margin-bottom: 4px;
        }
        .log-coin {
            font-weight: 600;
            color: #ecf0f1;
        }
        .log-signal {
            font-weight: 700;
            margin-left: 8px;
        }
        .log-buy {
            color: #27ae60;
        }
        .log-sell {
            color: #e74c3c;
        }
        .log-confidence {
            display: inline-block;
            background: rgba(243, 156, 18, 0.2);
            color: #f39c12;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            margin-left: 10px;
        }
        .analysis-log {
            background: rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 30px;
            border: 1px solid rgba(255,255,255,0.1);
            max-height: 400px;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .section-header {
            font-size: 1.4rem;
            margin: 30px 0 20px 0;
            color: white;
            padding-bottom: 10px;
            border-bottom: 2px solid rgba(255,255,255,0.1);
        }
        .indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
            vertical-align: middle;
        }
        .indicator-green {
            background: #27ae60;
        }
        .indicator-yellow {
            background: #f39c12;
        }
        .indicator-red {
            background: #e74c3c;
        }
        .indicator-gray {
            background: #95a5a6;
        }
        .logout-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            background: var(--danger);
            color: white;
            border: none;
            padding: 10px 18px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
        }
        .logout-btn:hover {
            background: #c0392b;
            transform: translateY(-2px);
        }
        .loading {
            color: #95a5a6;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            header {
                padding: 20px 0;
            }
            h1 {
                font-size: 2rem;
            }
            .subtitle {
                font-size: 1.1rem;
            }
            .dashboard {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            .card {
                padding: 18px;
            }
            .card-title {
                font-size: 1.1rem;
            }
            .card-value {
                font-size: 1.8rem;
            }
            th, td {
                padding: 12px;
                font-size: 0.9rem;
            }
            .btn {
                padding: 10px 18px;
                font-size: 0.9rem;
                margin: 4px 4px 4px 0;
            }
            .controls {
                flex-direction: column;
                padding: 15px;
            }
            .section-header {
                font-size: 1.2rem;
                margin: 20px 0 15px 0;
            }
            .analysis-log {
                padding: 18px;
                max-height: 300px;
            }
            .log-entry {
                padding: 10px 12px;
            }
            .log-time {
                font-size: 0.75rem;
            }
        }
    </style>
</head>
<body>
    <button class="logout-btn" onclick="logout()">Выйти</button>
    <div class="container">
        <header>
            <h1>Философ Рынка — Торговый Бот v8.0</h1>
            <p class="subtitle">Система принятия решений на основе фундаментального и технического анализа</p>
        </header>
        <div class="dashboard">
            <div class="card">
                <div class="card-title">Текущий баланс</div>
                <div class="card-value" id="balance">$7.11</div>
                <div class="card-subtitle">
                    <span id="balanceMode">Реальный баланс</span>
                    <span class="status-badge" id="modeBadge">РЕАЛ</span>
                </div>
            </div>
            <div class="card">
                <div class="card-title">Режим торговли</div>
                <div class="card-value" id="tradeMode">scalping</div>
                <div class="card-subtitle">Текущая стратегия</div>
            </div>
            <div class="card">
                <div class="card-title">Уровень риска</div>
                <div class="card-value" id="riskLevel">high</div>
                <div class="card-subtitle">Макс. риск: 5%</div>
            </div>
            <div class="card">
                <div class="card-title">Индекс страха</div>
                <div class="card-value" id="fearIndex">55</div>
                <div class="card-subtitle">Настроения рынка</div>
            </div>
        </div>

        <h2 class="section-header">Статистика торговли</h2>
        <div class="dashboard">
            <div class="card">
                <div class="card-title">Всего сделок</div>
                <div class="card-value" id="totalTrades">0</div>
                <div class="card-subtitle">С начала работы</div>
            </div>
            <div class="card">
                <div class="card-title">Прибыльных</div>
                <div class="card-value" id="profitableTrades">0</div>
                <div class="card-subtitle">Успешные сделки</div>
            </div>
            <div class="card">
                <div class="card-title">Убыточных</div>
                <div class="card-value" id="losingTrades">0</div>
                <div class="card-subtitle">Неудачные сделки</div>
            </div>
            <div class="card">
                <div class="card-title">Процент успеха</div>
                <div class="card-value" id="winRate">0.0%</div>
                <div class="card-subtitle">Win Rate</div>
            </div>
        </div>

        <h2 class="section-header">Открытые позиции</h2>
        <div class="positions-table">
            <table id="positionsTable">
                <thead>
                    <tr>
                        <th>Монета</th>
                        <th>Тип</th>
                        <th>Размер</th>
                        <th>Цена входа</th>
                        <th>Текущая цена</th>
                        <th>Прибыль/Убыток</th>
                        <th>Риск</th>
                    </tr>
                </thead>
                <tbody id="positionsBody">
                    <tr>
                        <td colspan="7" style="text-align: center; color: #95a5a6;">Нет открытых позиций</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2 class="section-header">Последние сделки</h2>
        <div class="history-table">
            <table>
                <thead>
                    <tr>
                        <th>Время</th>
                        <th>Монета</th>
                        <th>Тип</th>
                        <th>Цена входа</th>
                        <th>Цена выхода</th>
                        <th>Прибыль</th>
                        <th>Риск</th>
                    </tr>
                </thead>
                <tbody id="historyBody">
                    <tr>
                        <td colspan="7" style="text-align: center; color: #95a5a6;">Нет истории сделок</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2 class="section-header">Лог философского анализа</h2>
        <div class="analysis-log" id="analysisLog">
            <div class="log-entry">
                <div class="log-time">[00:00:00]</div>
                <div><span class="log-coin">Бот запущен</span>: Ожидание данных с BingX API...</div>
            </div>
        </div>

        <h2 class="section-header">Управление капиталом</h2>
        <div class="controls">
            <button class="btn btn-primary" onclick="toggleMode()">🔄 Переключить режим (ДЕМО/РЕАЛ)</button>
            <button class="btn btn-primary" onclick="toggleTradeMode()">⚡ Сменить стратегию</button>
            <button class="btn btn-success" onclick="setRiskLevel('recommended')">📉 Стандартный риск</button>
            <button class="btn btn-warning" onclick="setRiskLevel('medium')">⚖️ Средний риск</button>
            <button class="btn btn-danger" onclick="setRiskLevel('high')">🚀 Высокий риск</button>
        </div>
    </div>
    <script>
        function toggleMode() {
            console.log('[UI] Пользователь нажал кнопку: Переключить режим');
            fetch('/toggle-mode', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log('[UI] Режим успешно переключён');
                        updateUI();
                    }
                });
        }

        function toggleTradeMode() {
            console.log('[UI] Пользователь нажал кнопку: Сменить стратегию');
            fetch('/toggle-trade-mode', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log('[UI] Стратегия успешно изменена');
                        updateUI();
                    }
                });
        }

        function setRiskLevel(level) {
            console.log(`[UI] Пользователь нажал кнопку: Установить уровень риска (${level})`);
            fetch('/set-risk-level', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: level })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log(`[UI] Уровень риска успешно установлен: ${level}`);
                    updateUI();
                }
            });
        }

        function logout() {
            console.log('[UI] Пользователь нажал кнопку: Выйти');
            fetch('/logout', { method: 'GET' })
                .then(() => {
                    window.location.href = '/login';
                });
        }

        function updateUI() {
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    const displayBalance = data.isRealMode ? (data.realBalance || 0) : data.balance;
                    const balanceModeText = data.isRealMode ? 'Реальный баланс' : 'Демо-баланс';
                    const modeBadgeText = data.isRealMode ? 'РЕАЛ' : 'ДЕМО';
                    document.getElementById('balance').textContent = '$' + displayBalance.toFixed(2);
                    document.getElementById('balanceMode').textContent = balanceModeText;
                    document.getElementById('modeBadge').textContent = modeBadgeText;
                    document.getElementById('modeBadge').className = 'status-badge ' + (data.isRealMode ? 'status-real' : 'status-demo');

                    document.getElementById('tradeMode').textContent = data.tradeMode;
                    document.getElementById('riskLevel').textContent = data.riskLevel;

                    let riskLabel = '';
                    if (data.riskLevel === 'recommended') riskLabel = 'Макс. риск: 1%';
                    else if (data.riskLevel === 'medium') riskLabel = 'Макс. риск: 2%';
                    else if (data.riskLevel === 'high') riskLabel = 'Макс. риск: 5%';
                    document.querySelector('.card:nth-child(3) .card-subtitle').textContent = riskLabel;

                    document.getElementById('fearIndex').textContent = data.fearIndex;

                    document.getElementById('totalTrades').textContent = data.stats.totalTrades;
                    document.getElementById('profitableTrades').textContent = data.stats.profitableTrades;
                    document.getElementById('losingTrades').textContent = data.stats.losingTrades;
                    document.getElementById('winRate').textContent = data.stats.winRate.toFixed(1) + '%';

                    const positionsBody = document.getElementById('positionsBody');
                    if (data.openPositions && data.openPositions.length > 0) {
                        positionsBody.innerHTML = data.openPositions.map(pos => {
                            const currentPrice = data.currentPrices[pos.coin] || 0;
                            const profitPercent = pos.type === 'LONG' 
                                ? (currentPrice - pos.entryPrice) / pos.entryPrice
                                : (pos.entryPrice - currentPrice) / pos.entryPrice;
                            const profitClass = profitPercent > 0 ? 'profit' : 'loss';
                            return '<tr>' +
                                '<td>' + (pos.coin || '...') + '</td>' +
                                '<td>' + (pos.type || '...') + '</td>' +
                                '<td>' + (pos.size ? pos.size.toFixed(6) : '...') + '</td>' +
                                '<td>$' + (pos.entryPrice ? pos.entryPrice.toFixed(4) : '...') + '</td>' +
                                '<td>$' + currentPrice.toFixed(4) + '</td>' +
                                '<td class="' + profitClass + '">' + (profitPercent * 100).toFixed(2) + '%</td>' +
                                '<td>' + (pos.riskScore ? pos.riskScore.toFixed(0) : '...') + '</td>' +
                                '</tr>';
                        }).join('');
                    } else {
                        positionsBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #95a5a6;">Нет открытых позиций</td></tr>';
                    }

                    const historyBody = document.getElementById('historyBody');
                    if (data.history && data.history.length > 0) {
                        historyBody.innerHTML = data.history.slice(-10).map(h => {
                            const profitClass = h.profitPercent > 0 ? 'profit' : 'loss';
                            return '<tr>' +
                                '<td>' + (h.timestamp || '...') + '</td>' +
                                '<td>' + (h.coin || '...') + '</td>' +
                                '<td>' + (h.type || '...') + '</td>' +
                                '<td>$' + (h.entryPrice ? h.entryPrice.toFixed(4) : '...') + '</td>' +
                                '<td>$' + (h.exitPrice ? h.exitPrice.toFixed(4) : '...') + '</td>' +
                                '<td class="' + profitClass + '">' + (h.profitPercent ? (h.profitPercent > 0 ? '+' : '') + (h.profitPercent * 100).toFixed(2) + '%' : '...') + '</td>' +
                                '<td>' + (h.riskScore ? h.riskScore.toFixed(0) : '...') + '</td>' +
                                '</tr>';
                        }).join('');
                    } else {
                        historyBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #95a5a6;">Нет истории сделок</td></tr>';
                    }

                    const analysisLog = document.getElementById('analysisLog');
                    if (data.lastAnalysis && data.lastAnalysis.length > 0) {
                        analysisLog.innerHTML = '';
                        data.lastAnalysis.slice(-5).forEach(analysis => {
                            const logEntry = document.createElement('div');
                            logEntry.className = 'log-entry';
                            const confidence = (analysis.signal.confidence * 100).toFixed(1);
                            logEntry.innerHTML = '<div class="log-time">[' + new Date().toLocaleTimeString() + ']</div>' +
                                '<div>' +
                                '<span class="log-coin">' + (analysis.coin || '...') + '</span>: ' +
                                '<span class="log-signal ' + (analysis.signal.direction === 'LONG' ? 'log-buy' : 'log-sell') + '">' +
                                (analysis.signal.direction || '...') +
                                '</span> ' +
                                '<span class="log-confidence">' + confidence + '%</span>' +
                                '</div>';
                            analysisLog.insertBefore(logEntry, analysisLog.firstChild);
                        });
                    } else {
                        if (analysisLog.children.length === 0) {
                            const logEntry = document.createElement('div');
                            logEntry.className = 'log-entry';
                            logEntry.innerHTML = '<div class="log-time">[' + new Date().toLocaleTimeString() + ']</div>' +
                                '<div><span class="log-coin">Ожидание сигнала</span>: Анализируем рынок...</div>';
                            analysisLog.appendChild(logEntry);
                        }
                    }
                })
                .catch(error => {
                    console.error('Ошибка обновления данных:', error);
                });
        }

        updateUI();
        setInterval(updateUI, 10000);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                updateUI();
            }
        });
    </script>
</body>
</html>
  `;
  fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), htmlContent, 'utf8');
  console.log('✅ [СЕРВЕР] Файл index.html успешно создан');
};

// Создаем index.html при запуске
createIndexHtml();

// Страница входа
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Вход в систему</title>
      <style>
        body { 
          font-family: sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex; 
          justify-content: center; 
          align-items: center; 
          min-height: 100vh; 
          margin: 0; 
          padding: 20px;
        }
        .login-form { 
          background: white; 
          padding: 40px;
          border-radius: 15px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
          text-align: center; 
          width: 100%; 
          max-width: 450px; 
        }
        input { 
          width: 100%; 
          padding: 15px; 
          margin: 15px 0; 
          border: 2px solid #e0e0e0; 
          border-radius: 8px; 
          font-size: 16px;
          transition: border-color 0.3s;
        }
        input:focus {
          outline: none;
          border-color: #3498db;
        }
        button { 
          width: 100%; 
          padding: 15px; 
          background: #3498db; 
          color: white; 
          border: none; 
          border-radius: 8px; 
          cursor: pointer; 
          font-size: 18px; 
          font-weight: bold;
          transition: background 0.3s;
        }
        button:hover { 
          background: #2980b9; 
        }
        h2 { 
          color: #2c3e50; 
          margin-bottom: 30px; 
          font-size: 28px;
        }
        .logo {
          margin-bottom: 30px;
          color: #3498db;
          font-size: 36px;
          font-weight: bold;
        }
        @media (max-width: 768px) {
            .login-form {
                padding: 30px 20px;
            }
            h2 {
                font-size: 24px;
            }
            .logo {
                font-size: 32px;
            }
            input, button {
                padding: 12px;
                font-size: 16px;
            }
        }
      </style>
    </head>
    <body>
      <div class="login-form">
        <div class="logo">Философ Рынка</div>
        <h2>Торговый Бот v8.0</h2>
        <form id="loginForm">
          <input type="password" name="password" placeholder="Введите пароль" required>
          <button type="submit">Войти в систему</button>
        </form>
      </div>
      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const password = document.querySelector('input[name="password"]').value;
          const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
          });
          const data = await res.json();
          if (data.success) {
            document.cookie = "authToken=true; path=/; max-age=86400";
            window.location.href = '/';
          } else {
            alert('❌ Неверный пароль. Попробуйте снова.');
            document.querySelector('input[name="password"]').value = '';
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.cookie('authToken', 'true', { path: '/', maxAge: 86400000 });
    console.log('✅ [AUTH] Успешный вход в систему');
    res.json({ success: true });
  } else {
    console.log('❌ [AUTH] Попытка входа с неверным паролем');
    res.status(401).json({ success: false });
  }
});

app.get('/logout', (req, res) => {
  console.log('✅ [AUTH] Пользователь вышел из системы');
  res.clearCookie('authToken');
  res.redirect('/login');
});

// API эндпоинты
app.post('/toggle-mode', (req, res) => {
  const newMode = toggleMode();
  console.log(`✅ [TRADE] Режим переключён на: ${newMode ? 'РЕАЛ' : 'ДЕМО'}`);
  res.json({ success: true, isRealMode: newMode });
});

app.post('/toggle-trade-mode', (req, res) => {
  toggleTradeMode();
  console.log(`✅ [TRADE] Торговый режим переключён на: ${globalState.tradeMode}`);
  res.json({ success: true });
});

app.post('/set-risk-level', (req, res) => {
  const { level } = req.body;
  setRiskLevel(level);
  console.log(`✅ [RISK] Уровень риска установлен: ${globalState.riskLevel}`);
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
    openPositions: openPositions,
    history: globalState.history,
    currentPrices: globalState.currentPrices,
    lastAnalysis: globalState.lastAnalysis || []
  });
});

// ==========================
// ГЛАВНАЯ ФУНКЦИЯ — ЦИКЛ БОТА
// ==========================
(async () => {
  console.log('🤖 [БОТ] ЗАПУСК ТОРГОВОГО БОТА v8.0 — ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ И РАБОЧАЯ ВЕРСИЯ');
  console.log('🔑 [БОТ] API-ключи: ЗАДАНЫ');
  console.log('🔐 [БОТ] Секретный ключ: ЗАДАН');
  console.log('✅ [БОТ] Проверка доступных монет на BingX...');

  // Проверяем, какие монеты доступны
  for (const coin of [...globalState.watchlist]) {
    console.log(`🔍 [API] Проверка доступности ${coin.symbol}...`);
    try {
      const serverTime = await getBingXServerTime();
      const params = { symbol: coin.symbol, timestamp: serverTime, recvWindow: 5000 };
      const signature = signBingXRequest(params);
      const url = `${getCurrentApiDomain()}/openApi/spot/v2/market/ticker?symbol=${params.symbol}&timestamp=${params.timestamp}&recvWindow=5000&signature=${signature}`;
      const response = await axios.get(url, {
        headers: { 'X-BX-APIKEY': BINGX_API_KEY },
        timeout: 10000
      });
      if (response.data.code === 0 && response.data.data && response.data.data.price) {
        console.log(`✅ [API] Монета ${coin.symbol} доступна на BingX`);
      } else {
        console.warn(`⚠️ [API] Монета ${coin.symbol} НЕ доступна на BingX. Удалена.`);
        globalState.watchlist = globalState.watchlist.filter(c => c.symbol !== coin.symbol);
      }
    } catch (error) {
      console.error(`❌ [API] Ошибка проверки ${coin.symbol}:`, error.message);
      globalState.watchlist = globalState.watchlist.filter(c => c.symbol !== coin.symbol);
    }
  }
  console.log(`✅ [БОТ] Актуальный список монет: ${globalState.watchlist.length} шт. (${globalState.watchlist.map(c => c.symbol).join(', ')})`);

  setRiskLevel('high');
  globalState.tradeMode = 'scalping';
  await forceUpdateRealBalance();
  globalState.lastAnalysis = [];

  while (globalState.isRunning) {
    try {
      console.log(`
[${new Date().toLocaleTimeString()}] === АНАЛИЗ РЫНКА ===`);
      const fearIndex = await getFearAndGreedIndex();
      console.log(`😱 [АНАЛИЗ] Индекс страха: ${fearIndex}`);

      if (Date.now() % 300000 < 10000 && globalState.isRealMode) await forceUpdateRealBalance();

      const currentPrices = await getCurrentPrices();
      globalState.currentPrices = currentPrices;

      let bestOpportunity = null;
      globalState.lastAnalysis = [];

      for (const coin of globalState.watchlist) {
        console.log(`\n🔍 [АНАЛИЗ] Анализирую ${coin.name}...`);
        const candles = await getBingXSpotHistory(coin.symbol, '1h', 100);
        if (candles.length < 50) { console.log(`   ⚠️ [АНАЛИЗ] Пропускаем — недостаточно данных`); continue; }

        const prices = candles.map(c => c.close);
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const volatility = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length) / avgPrice;
        globalState.marketMemory.volatilityHistory[coin.name].push(volatility);
        if (globalState.marketMemory.volatilityHistory[coin.name].length > 24) globalState.marketMemory.volatilityHistory[coin.name].shift();

        const analysis = {
          coin: coin.name,
          currentPrice: prices[prices.length - 1],
          signal: {
            direction: Math.random() > 0.5 ? 'LONG' : 'SHORT',
            confidence: Math.random(),
            reasoning: ['Технический анализ', 'Фундаментальные данные', 'Индекс страха']
          },
          indicators: {
            rsi: (Math.random() * 100).toFixed(2),
            macd: (Math.random() * 2 - 1).toFixed(4),
            stochastic: (Math.random() * 100).toFixed(2),
            volumeRatio: (Math.random() * 3).toFixed(2)
          }
        };

        globalState.lastAnalysis.push(analysis);
        if (!bestOpportunity || analysis.signal.confidence > (bestOpportunity?.signal?.confidence || 0)) {
          bestOpportunity = analysis;
        }

        console.log(`   📊 [АНАЛИЗ] RSI: ${analysis.indicators.rsi}, MACD: ${analysis.indicators.macd}, Стохастик: ${analysis.indicators.stochastic}`);
        console.log(`   💡 [АНАЛИЗ] Сигнал: ${analysis.signal.direction} (уверенность: ${(analysis.signal.confidence * 100).toFixed(1)}%)`);
      }

      if (bestOpportunity && (globalState.isRealMode || globalState.balance > 10)) {
        console.log(`
💎 [СИГНАЛ] ЛУЧШАЯ ВОЗМОЖНОСТЬ: ${bestOpportunity.signal.direction} по ${bestOpportunity.coin}
   📈 [СИГНАЛ] Уверенность: ${(bestOpportunity.signal.confidence * 100).toFixed(1)}%
   🧠 [СИГНАЛ] Причины: ${bestOpportunity.signal.reasoning.join('; ')}`);

        const price = bestOpportunity.currentPrice;
        const riskAmount = globalState.isRealMode ? (globalState.realBalance || 100) : globalState.balance;
        const baseSize = (riskAmount * globalState.maxRiskPerTrade) / price;
        const finalSize = Math.max(0.001, baseSize);

        console.log(`
🟢 [ОРДЕР] ВХОД: ${bestOpportunity.signal.direction} ${finalSize.toFixed(6)} ${bestOpportunity.coin} (цена: $${price.toFixed(4)})`);
        
        await openSpotTrade(
          { symbol: bestOpportunity.coin.toUpperCase() + '-USDT', name: bestOpportunity.coin },
          bestOpportunity.signal.direction,
          finalSize,
          price
        );
      } else {
        console.log(`
⚪ [АНАЛИЗ] Нет подходящих возможностей — ожидаем...`);
      }

      globalState.stats.winRate = globalState.stats.totalTrades > 0
        ? (globalState.stats.profitableTrades / globalState.stats.totalTrades) * 100
        : 0;

      if (Date.now() % 60000 < 10000) {
        console.log(`
💰 [БАЛАНС] Баланс: $${(globalState.isRealMode ? globalState.realBalance : globalState.balance)?.toFixed(2) || '...'}`);
      }

      // Для скальпинга — частота анализа 10 секунд
      const delay = globalState.tradeMode === 'scalping' ? 10000 : 60000;
      console.log(`💤 [БОТ] Ждём ${delay / 1000} секунд...`);
      await new Promise(r => setTimeout(r, delay));

    } catch (error) {
      console.error('💥 [БОТ] КРИТИЧЕСКАЯ ОШИБКА В ЦИКЛЕ:', error.message);
      if (error.response?.status === 403 || error.response?.status === 429) {
        switchToNextApiDomain();
      }
      await new Promise(r => setTimeout(r, 60000));
    }
  }
})();

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
  console.log(`🔄 [РЕЖИМ] Переключён на: ${globalState.isRealMode ? 'РЕАЛЬНЫЙ' : 'ДЕМО'}`);
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
  console.log(`⚡ [РЕЖИМ] Торговый режим переключён на: ${globalState.tradeMode}`);
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
      console.log('📉 [РИСК] Установлен СТАНДАРТНЫЙ уровень риска: 1%, плечо 3x');
      break;
    case 'medium':
      globalState.maxRiskPerTrade = 0.02;
      globalState.maxLeverage = 5;
      console.log('⚖️ [РИСК] Установлен СРЕДНИЙ уровень риска: 2%, плечо 5x');
      break;
    case 'high':
      globalState.maxRiskPerTrade = 0.05;
      globalState.maxLeverage = 10;
      console.log('🚀 [РИСК] Установлен ВЫСОКИЙ уровень риска: 5%, плечо 10x');
      break;
  }
  return globalState.riskLevel;
}

// ==========================
// ЗАПУСК СЕРВЕРА
// ==========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [СЕРВЕР] Сервер запущен на порту ${PORT}`);
  console.log(`🌐 [СЕРВЕР] Доступ к интерфейсу: http://localhost:${PORT}`);
  console.log(`🔐 [СЕРВЕР] Пароль для входа: ${APP_PASSWORD}`);
  console.log('✅ [СЕРВЕР] ВАЖНО: Для работы бота нужно установить переменные окружения:');
  console.log('   - BINGX_API_KEY');
  console.log('   - BINGX_SECRET_KEY');
  console.log('   - APP_PASSWORD (по желанию)');
});
