# RSG | Visitor Feedback Intelligence

Interactive visitor-experience dashboard for **Red Sea Global**, built with plain HTML, CSS and JavaScript (no frameworks, no build step).

**Live demo:** https://cro80.github.io/rsg-visitor-feedback-dashboard/

## Pages
- **Dashboard** – 6 KPI cards (click to drill down), 9 interactive charts, 4 filters with cross-filtering
- **Survey Data** – search, sort, paginate and export 511 responses to CSV
- **Alerts List** – assign owners, start progress, close/reopen tickets (saved in the browser, updates the dashboard live)
- **Analysis Tables** – item statistics, reliability, correlations, group means, SPSS tests
- **About & Guide**

## Run locally
Open `index.html` in a browser, or run `python3 -m http.server` and visit http://localhost:8000.

## Data
Generated from `RSG_Visitor_Experience_Dashboard.xlsx` (`js/data.js`). Satisfaction, recommendation, region and item scores are real survey responses; destination, visitor type, month and alert records are illustrative prototype data.
