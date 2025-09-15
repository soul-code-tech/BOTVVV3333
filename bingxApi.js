// ✅ bingxApi.js — ИСПРАВЛЕННАЯ ВЕРСИЯ ДЛЯ SPOT (работает на Render)
import CryptoJS from 'crypto-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HOST = "open-api.bingx.com";
const PROTOCOL = "https";
const API_KEY = process.env.BINGX_API_KEY;
const SECRET_KEY = process.env.BINGX_SECRET_KEY;

if (!API_KEY || !SECRET_KEY) {
    throw new Error("API keys not configured");
}

function generateSignature(payload) {
    const timestamp = Date.now();
    let parameters = "";

    // Сортируем параметры по ключам (обязательно для Spot API)
    const sortedKeys = Object.keys(payload).sort();
    for (const key of sortedKeys) {
        if (key !== 'timestamp') {
            parameters += `${key}=${encodeURIComponent(payload[key])}&`;
        }
    }
    parameters += `timestamp=${timestamp}`;

    const signature = CryptoJS.HmacSHA256(parameters, SECRET_KEY).toString(CryptoJS.enc.Hex);
    return { parameters, signature, timestamp };
}

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

        // Для POST — передаём параметры в теле
        if (method !== 'GET') {
            config.data = {
                ...payload,
                timestamp: Date.now(),
                signature: signature
            };
        }

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

// ✅ SPOT API — ПРАВИЛЬНЫЕ ЭНДПОИНТЫ

// 📈 Получить цену тикера — Spot
export async function getTickerPrice(symbol) {
    // Spot API использует symbol в формате BTCUSDT (без дефиса)
    const cleanSymbol = symbol.replace('-', '');
    return await callBingxApi(`/openApi/spot/v1/market/ticker`, 'GET', { symbol: cleanSymbol });
}

// 📊 Получить свечи (K-линии) — Spot
export async function getKlines(symbol, interval, limit = 100) {
    const cleanSymbol = symbol.replace('-', '');
    return await callBingxApi(`/openApi/spot/v1/market/kline`, 'GET', { symbol: cleanSymbol, interval, limit });
}

// 💰 Получить информацию о балансе — Spot
export async function getAccountInfo() {
    return await callBingxApi(`/openApi/spot/v1/account/balance`, 'GET', {});
}

// 🛒 Создать ордер — Spot
export async function createOrder(symbol, side, type, quantity, price = null, stopPrice = null) {
    const cleanSymbol = symbol.replace('-', '');
    const payload = {
        symbol: cleanSymbol,
        side: side.toUpperCase(), // BUY или SELL
        type: type.toUpperCase(), // MARKET, LIMIT и т.д.
        quantity: parseFloat(quantity).toFixed(8),
    };
    if (price) payload.price = parseFloat(price).toFixed(8);
    if (stopPrice) payload.stopPrice = parseFloat(stopPrice).toFixed(8);

    return await callBingxApi(`/openApi/spot/v1/trade/order`, 'POST', payload);
}
