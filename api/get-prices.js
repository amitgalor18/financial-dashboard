// File: /api/get-prices.js (FINAL - Using /eod/ for consistency)

async function fetchFromEODHD(url) {
  const response = await fetch(url);
  if (!response.ok) { throw new Error(`EODHD API request failed: ${response.status}`); }
  return response.json();
}

export default async function handler(req, res) {
  const { ticker, apiKey } = req.query;
  if (!ticker || !apiKey) { return res.status(400).json({ error: 'Ticker and apiKey required' }); }

  try {
    let url;
    const upperTicker = ticker.toUpperCase();

    if (upperTicker.endsWith('.FOREX')) {
      // Forex is always real-time
      url = `https://eodhd.com/api/real-time/${upperTicker}?api_token=${apiKey}&fmt=json`;
    } else {
      // ✅ Use the /eod/ endpoint for both stocks and crypto, as you confirmed it's reliable
      url = `https://eodhd.com/api/eod/${upperTicker}?api_token=${apiKey}&fmt=json&period=d&limit=1`;
    }

    const data = await fetchFromEODHD(url);
    
    let price;
    // The /eod/ response is an array, get the last (most recent) item's close price
    if (Array.isArray(data) && data.length > 0) {
      price = data[data.length - 1].close;
    // The /real-time/ response for FOREX is an object
    } else if (data && data.close) {
      price = data.close;
    }

    if (price === undefined || isNaN(price)) {
      throw new Error('Valid price not found in EODHD response.');
    }
    
    res.status(200).json({ price });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}