// bingxApi.js — РАБОЧИЙ API ДЛЯ ФЬЮЧЕРСОВ
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
    const sortedKeys = Object.keys(payload).sort();
    let parameters = "";

    for (const key of sortedKeys) {
        if (key !== 'timestamp') {
            parameters += `${key}=${encodeURIComponent(payload[key])}&`;
        }
    }
    parameters += `timestamp=${timestamp}`;

    return CryptoJS.HmacSHA256(parameters, SECRET_KEY).toString(CryptoJS.enc.Hex);
}

export async function callBingxApi(path, method = 'GET', payload = {}) {
    try {
        const timestamp = Date.now();
        const signature = generateSignature({ ...payload, timestamp });
        let url;

        if (method === 'GET') {
            const params = new URLSearchParams({ ...payload, timestamp, signature });
            url = `${PROTOCOL}://${HOST}${path}?${params.toString()}`;
        }

        const config = {
            method,
            url,
            headers: { 'X-BX-APIKEY': API_KEY },
        };

        if (method !== 'GET') {
            config.data = { ...payload, timestamp, signature };
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

// ✅ ФЬЮЧЕРСЫ — РАБОЧИЕ ЭНДПОИНТЫ

export async function getTickerPrice(symbol) {
    return await callBingxApi(`/openApi/swap/v1/ticker/price`, 'GET', { symbol });
}

export async function getKlines(symbol, interval, limit = 100) {
    return await callBingxApi(`/openApi/swap/v3/quote/klines`, 'GET', { symbol, interval, limit });
}

export async function getAccountInfo() {
    return await callBingxApi(`/openApi/swap/v2/user/balance`, 'GET', {});
}

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

// ✅ Получить список контрактов
export async function getContracts() {
    return await callBingxApi(`/openApi/swap/v2/quote/contracts`, 'GET', {});
}

// ✅ Установить плечо
export async function setLeverage(symbol, leverage) {
    return await callBingxApi(`/openApi/swap/v2/trade/leverage`, 'POST', {
        symbol,
        leverage: leverage.toString(),
        side: "LONG" // BingX требует указать сторону
    });
}
