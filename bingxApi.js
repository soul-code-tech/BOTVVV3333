// bingxApi.js — ОФИЦИАЛЬНЫЙ КОД ДЛЯ ФЬЮЧЕРСОВ (Perp Futures)
import CryptoJS from 'crypto-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HOST = "open-api.bingx.com";
const PROTOCOL = "https";
const API_KEY = process.env.BINGX_API_KEY;
const SECRET_KEY = process.env.BINGX_SECRET_KEY;

if (!API_KEY || !SECRET_KEY) {
    throw new Error("BINGX_API_KEY и BINGX_SECRET_KEY должны быть заданы в .env");
}

/**
 * Генерирует подпись для запроса
 * @param {Object} payload - параметры запроса
 * @returns {Object} - параметры, подпись и временная метка
 */
function generateSignature(payload) {
    const timestamp = Date.now();
    // Сортируем ключи по алфавиту — ОБЯЗАТЕЛЬНО для BingX
    const sortedKeys = Object.keys(payload).sort();
    let parameters = "";

    for (const key of sortedKeys) {
        if (key !== 'timestamp') {
            parameters += `${key}=${encodeURIComponent(payload[key])}&`;
        }
    }
    parameters += `timestamp=${timestamp}`;

    const signature = CryptoJS.HmacSHA256(parameters, SECRET_KEY).toString(CryptoJS.enc.Hex);
    return { parameters, signature, timestamp };
}

/**
 * Универсальная функция для вызова API BingX
 * @param {string} path - путь эндпоинта
 * @param {string} method - метод (GET, POST и т.д.)
 * @param {Object} payload - параметры запроса
 * @returns {Promise} - ответ API
 */
export async function callBingxApi(path, method = 'GET', payload = {}) {
    try {
        const { parameters, signature } = generateSignature(payload);
        let url;

        if (method === 'GET') {
            url = `${PROTOCOL}://${HOST}${path}?${parameters}&signature=${signature}`;
        }

        const config = {
            method: method,
            url: url,
            headers: {
                'X-BX-APIKEY': API_KEY,
            },
        };

        // Для POST — передаём параметры в теле запроса
        if (method !== 'GET') {
            config.data = {
                ...payload,
                timestamp: Date.now(),
                signature: signature
            };
        }

        // Обработка больших чисел (orderID)
        config.transformResponse = (response) => {
            try {
                const parsed = JSON.parse(response);
                // Если есть orderID — преобразуем в строку
                if (parsed.data && parsed.data.orderId) {
                    parsed.data.orderId = parsed.data.orderId.toString();
                }
                if (parsed.data && Array.isArray(parsed.data)) {
                    parsed.data.forEach(item => {
                        if (item.orderId) {
                            item.orderId = item.orderId.toString();
                        }
                    });
                }
                return parsed;
            } catch (e) {
                return response;
            }
        };

        const response = await axios(config);

        if (response.data.code !== 0) {
            throw new Error(`BingX API Error [${response.data.code}]: ${response.data.msg}`);
        }

        return response.data.data;
    } catch (error) {
        console.error(`API Error for ${path}:`, error.message);
        throw error;
    }
}

// ✅ ФЬЮЧЕРСЫ — ЭНДПОИНТЫ V2/V3

// 📈 Получить цену — v1 (актуально)
export async function getTickerPrice(symbol) {
    return await callBingxApi(`/openApi/swap/v1/ticker/price`, 'GET', { symbol });
}

// 📊 Получить свечи — v3 (последняя версия)
export async function getKlines(symbol, interval, limit = 100) {
    return await callBingxApi(`/openApi/swap/v3/quote/klines`, 'GET', { symbol, interval, limit });
}

// 💰 Получить баланс аккаунта — v2
export async function getAccountInfo() {
    return await callBingxApi(`/openApi/swap/v2/user/balance`, 'GET', {});
}

// 🛒 Создать ордер — v2
export async function createOrder(symbol, side, type, quantity, price = null, stopPrice = null) {
    const payload = {
        symbol,
        side: side.toUpperCase(),
        type: type.toUpperCase(),
        quantity: parseFloat(quantity).toFixed(8)
    };
    if (price) payload.price = parseFloat(price).toFixed(8);
    if (stopPrice) payload.stopPrice = parseFloat(stopPrice).toFixed(8);
    return await callBingxApi(`/openApi/swap/v2/trade/order`, 'POST', payload);
}

// 📋 Получить информацию о контрактах — v2
export async function getContracts(symbol = null) {
    const payload = {};
    if (symbol) payload.symbol = symbol;
    return await callBingxApi(`/openApi/swap/v2/quote/contracts`, 'GET', payload);
}

// 📚 Получить книгу ордеров — v2
export async function getDepth(symbol, limit = 5) {
    return await callBingxApi(`/openApi/swap/v2/quote/depth`, 'GET', { symbol, limit });
}

// 🔄 Получить последние сделки — v2
export async function getTrades(symbol, limit = 10) {
    return await callBingxApi(`/openApi/swap/v2/quote/trades`, 'GET', { symbol, limit });
}

// 💰 Получить индекс премии и уровень финансирования — v2
export async function getPremiumIndex(symbol) {
    return await callBingxApi(`/openApi/swap/v2/quote/premiumIndex`, 'GET', { symbol });
}

// 📅 Получить историю ставок финансирования — v2
export async function getFundingRate(symbol, limit = 10) {
    return await callBingxApi(`/openApi/swap/v2/quote/fundingRate`, 'GET', { symbol, limit });
}

// 📈 Получить статистику открытых процентов — v2
export async function getOpenInterest(symbol) {
    return await callBingxApi(`/openApi/swap/v2/quote/openInterest`, 'GET', { symbol });
}

// 📊 Получить статистику изменения цен за 24 часа — v2
export async function getTicker24hr(symbol = null) {
    const payload = {};
    if (symbol) payload.symbol = symbol;
    return await callBingxApi(`/openApi/swap/v2/quote/ticker`, 'GET', payload);
}

// 📖 Получить исторические ордера на транзакции — v1
export async function getHistoricalTrades(symbol, limit = 500, fromId = null) {
    const payload = { symbol, limit };
    if (fromId) payload.fromId = fromId;
    return await callBingxApi(`/openApi/swap/v1/market/historicalTrades`, 'GET', payload);
}

// 🎯 Получить текущий лучший ордер — v2
export async function getBookTicker(symbol = null) {
    const payload = {};
    if (symbol) payload.symbol = symbol;
    return await callBingxApi(`/openApi/swap/v2/quote/bookTicker`, 'GET', payload);
}

// 📈 Получить данные Kline по марке — v1
export async function getMarkPriceKlines(symbol, interval, limit = 100) {
    return await callBingxApi(`/openApi/swap/v1/market/markPriceKlines`, 'GET', { symbol, interval, limit });
}

// ⚖️ Получить правила торговли — v1
export async function getTradingRules(symbol) {
    return await callBingxApi(`/openApi/swap/v1/tradingRules`, 'GET', { symbol });
}

// ⏱️ Получить время сервера
export async function getServerTime() {
    const response = await callBingxApi(`/openApi/swap/v2/server/time`, 'GET', {});
    return response.serverTime;
}
// ✅ Получить список доступных контрактов (торговых пар)
export async function getContracts() {
    return await callBingxApi(`/openApi/swap/v2/quote/contracts`, 'GET', {});
}
