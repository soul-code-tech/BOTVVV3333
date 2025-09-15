// bingxApi.js — ПОЛНОСТЬЮ ГОТОВЫЙ
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

function generateSignature(payload, urlEncode = true) {
    const timestamp = Date.now();
    let parameters = "";

    for (const key in payload) {
        if (urlEncode && key !== 'timestamp') {
            parameters += `${key}=${encodeURIComponent(payload[key])}&`;
        } else {
            parameters += `${key}=${payload[key]}&`;
        }
    }

    if (!payload.timestamp) {
        parameters += `timestamp=${timestamp}`;
    } else {
        parameters = parameters.slice(0, -1);
    }

    const signature = CryptoJS.HmacSHA256(parameters, SECRET_KEY).toString(CryptoJS.enc.Hex);
    return { parameters, signature, timestamp };
}

export async function callBingxApi(path, method = 'GET', payload = {}) {
    try {
        const { parameters, signature } = generateSignature(payload, method === 'GET');
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
            ...(method !== 'GET' && {
                data: {
                    ...payload,
                    signature: signature
                }
            })
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

// SPOT API функции — ИСПРАВЛЕНО НА SPOT!
export async function getTickerPrice(symbol) {
    return await callBingxApi(`/openApi/spot/v1/ticker/price`, 'GET', { symbol });
}

export async function getKlines(symbol, interval, limit = 100) {
    return await callBingxApi(`/openApi/spot/v1/market/klines`, 'GET', { symbol, interval, limit });
}

export async function getAccountInfo() {
    return await callBingxApi(`/openApi/spot/v1/account/balance`, 'GET', {});
}

export async function createOrder(symbol, side, type, quantity, price = null, stopPrice = null) {
    const payload = {
        symbol,
        side,
        type,
        quantity: parseFloat(quantity).toFixed(8),
        timestamp: Date.now()
    };
    if (price) payload.price = parseFloat(price).toFixed(8);
    if (stopPrice) payload.stopPrice = parseFloat(stopPrice).toFixed(8);

    return await callBingxApi(`/openApi/spot/v1/trade/order`, 'POST', payload);
}
