#!/usr/bin/env python3
"""Fetch public daily closing quotes. No user portfolio data is accessed."""
import json, datetime, urllib.request, time, pathlib, sys

SOURCES = {
    "上市": "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
    "上櫃": "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes",
}
def normalize_date(v):
    t = str(v or "").strip()
    if len(t) == 7 and t.isdecimal():
        return f"{int(t[:3])+1911:04d}-{t[3:5]}-{t[5:7]}"
    if len(t) == 8 and t.isdecimal():
        return f"{t[:4]}-{t[4:6]}-{t[6:8]}"
    if len(t) == 10 and t[4] in "-/" and t[7] in "-/":
        return t.replace("/", "-")
    return None
def valid(d):
    if not d: return False
    try:
        day = datetime.date.fromisoformat(d)
        now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date()
        return datetime.timedelta(days=0) <= now - day <= datetime.timedelta(days=10)
    except ValueError: return False
def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 StockSentinel/0.3", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=35) as resp:
        return json.load(resp)
def parse(market, rows):
    out={}
    for row in rows:
        code=str(row.get("Code") or row.get("SecuritiesCompanyCode") or row.get("證券代號") or "").strip()
        raw=row.get("ClosingPrice") or row.get("Close") or row.get("收盤價")
        date=normalize_date(row.get("Date") or row.get("DateOfData") or row.get("日期"))
        try: price=float(str(raw).replace(",","").strip())
        except (ValueError,TypeError): continue
        if not code or price<=0 or not valid(date): continue
        out[f"{market}:{code}"]={"price":price,"date":date}
    return out
path=pathlib.Path("quotes.json")
old={}
if path.exists():
    try: old=json.loads(path.read_text(encoding="utf-8"))
    except (ValueError,OSError): pass
quotes=old.get("quotes",{}) if isinstance(old.get("quotes"),dict) else {}
updated=[]
for market,url in SOURCES.items():
    try:
        rows=fetch(url)
        if not isinstance(rows,list): raise ValueError("Unexpected shape")
        parsed=parse(market,rows)
        if len(parsed)<100: raise ValueError("Too few quotes parsed")
        quotes={k:v for k,v in quotes.items() if not k.startswith(market+":")}
        quotes.update(parsed)
        updated.append(market)
        print(market,len(parsed))
    except Exception as exc:
        print(f"{market}: {exc}",file=sys.stderr)
# Never rewrite a valid file with all data missing.
if not updated:
    sys.exit("All upstream requests failed; leaving previous quotes intact")
payload={"source":"TWSE / TPEx official daily-close open data","markets_updated":updated,"quotes":quotes}
# Stable content avoids needless commits when sources are unchanged.
new=json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True)+"\n"
path.write_text(new,encoding="utf-8")
