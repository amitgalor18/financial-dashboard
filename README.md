# Finance Dashboard

A local, private webapp to visualize my personal finances:  
- Monthly **income & expenses**  
- **Net worth** evolution  
- **Savings rate** and cumulative savings  
- **Portfolio allocation** by holdings and by categories  

Built with **React + Vite + Tailwind + Recharts**, data comes from my Excel workbooks and (optionally) a Google Sheets CSV.

---
![Dashboard screenshot](/image.png)
---
## 🚀 Running locally

### 1. Prerequisites
- Node.js ≥ 18  
- npm (comes with Node)

### 2. Setup
Clone and install:

```bash
git clone https://github.com/<your-username>/finance-dashboard.git
cd finance-dashboard
npm install
```
Start the dev server:
```bash
npm run dev
```

Open your browser at http://localhost:5173

📂 Data Sources

⚠️ Important: This app is not generic — it expects specific Excel formats.

Expenses Excel: rows of transactions with categories, used to build monthly expenses breakdowns.

Net Worth Excel: “tracking” sheet with monthly totals. The app expects certain columns (by position):

0 → Month

1 → Cash

2 → Deposits / Money Market Funds

4 → Stocks (ignored, since per-stock data comes from portfolio CSV)

10 → Crypto (ignored, same reason)

11 → Total Liquid Assets

17 → Total Non-Liquid Assets

Portfolio CSV: exported/published from Google Sheets, with columns:

Ticker, Qty, Price, Value, Name, Category


The Google Sheet can use GOOGLEFINANCE() formulas for live market prices. For example:

=GOOGLEFINANCE("CURRENCY:BTCUSD") * GOOGLEFINANCE("CURRENCY:USDILS")

🔍 Usage

Launch the app (npm run dev).

Upload your Expenses and Net Worth Excel files in the Overview tab.

(Optional) Paste the Google Sheets CSV URL in the Portfolio tab and click Load.

Explore:

Overview: quick glance at savings, income vs. expenses.

Expenses: category pie chart per month.

Net Worth: line chart over time.

Savings: cumulative monthly savings.

Portfolio: pies + table, both by holding and by category.

📸 Mock Data

For demo/screenshot purposes, two Excel files with fake numbers are included in mock_data/:

mock_expenses.xlsx

mock_networth.xlsx

They mimic the structure of my real sheets but contain only generated values.
Load these if you want to see the app in action without real data.

⚠️ Limitations / Roadmap

Not a general-purpose tool — the column layout is hardcoded.

Portfolio data comes either from Google Sheets or manual input; no direct broker integration.

Export/Import of a single “dashboard snapshot” (JSON) + in-app editing planned for v2.

📄 License

For personal use. Feel free to fork, adapt, or reuse with your own data — just remember to protect your private financial information.
