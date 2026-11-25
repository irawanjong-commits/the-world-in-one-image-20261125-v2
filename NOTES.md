# NOTES — news-image-20261125 v2 ("EVENING EXTRA")

Build: fresh, original Node 22 stdlib-only program (`main.ts`), written from
scratch for this entry. Own rasterizer (rects, lines, circles, polygons), own
hand-authored 5×7 bitmap font with word-wrap, drawn falling-chart
illustration, own deterministic PNG encoder (zlib + CRC32). Output:
1024×1024 PNG, 23,391 bytes, sha256
1b3bbac21c579040c8fb7513fde2df6222d2de2f26178892afb80bd381c7e3d2 —
two runs byte-identical. Visual check of the render: all text fits its
panels, no overlaps, numbers legible (one fix applied during the check: the
first render had no visible text because the glyph test matched "#" while the
font uses "1" for ink; the Ukraine brief body was then shortened so it no
longer overflowed its box).

## Sources per story (all released/reported 25 Nov 2026)

- Q3 GDP +4.3% annualised (BEA second estimate; +3.5% expected, +3.4%
  advance; spending +4.2%, business investment +16.1%) — BEA.
- Core PCE +0.3% MoM / +3.3% YoY Oct (vs +3.2% expected); headline PCE
  +0.3% MoM / +3.8% YoY; Q3 PCE prices +2.1% headline / +2.5% core — BEA.
- S&P 500 futures -2.1% after the release; Nasdaq selloff continued —
  Investors.com.
- Durable goods +0.2% (vs +0.5% expected); jobless claims 189,000; consumer
  spending +0.3% Oct (flat in real terms); personal income +0.7% — BEA /
  Investors.com.
- Kospi -6.16% to 4,697.51 (sidecar triggered, ~$186bn wiped); Nikkei
  -2.78% to 57,011.62; Taiwan -4.5%; SoftBank -14.1%; Samsung / SK Hynix
  about -9% — Barron's / CNN.
- Bitcoin ~$58,123, -3.1% (low $57,990); US spot BTC ETF November outflows
  record ~$4.71bn, sixth straight day ($232m Tuesday) — Finnhub / Kitco.
- Gold -1% after the US data — Kitco.
- Tankers hit by mines in the Strait of Hormuz (IRGC Navy says 2); Iran
  claims it downed a US MQ-9 drone; oil eased — AP / CNN.
- Ukrainian drones hit two Rosneft refineries in Samara (Syzran and
  Kuibyshev); Putin ordered stronger energy-site protection, retaliation
  inevitable; Russian drones violated Polish airspace; leaked records point
  to 490,000+ Russian war deaths; Zelensky on US peace-deal push by January
  — AP / CNN.
- Hamas internal security chief Abu Nahel and 6 others killed in strikes
  despite the truce — AP.
- US consumer confidence November 103.3 — AP.
- Fed decision 9 December; OPEC+ meets 29 November; December Fed hike odds
  near 97% before the data — Investors.com / Barron's.
