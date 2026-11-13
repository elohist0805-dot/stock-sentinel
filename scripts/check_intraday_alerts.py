#!/usr/bin/env python3
"""Private Taiwan intraday alert runner. No positions or credentials committed to Pages."""
import datetime as dt, json, os, sys, urllib.request, urllib.error, pathlib, hashlib

TZ=dt.timezone(dt.timedelta(hours=8))
NOW=dt.datetime.now(TZ)
TODAY=NOW.date().isoformat()
RULES_JSON=os.getenv("ALERT_RULES_JSON","")
API_KEY=os.getenv("FUGLE_API_KEY","")
BOT_TOKEN=os.getenv("TELEGRAM_BOT_TOKEN","")
CHAT_ID=os.getenv("TELEGRAM_CHAT_ID","")
STATE=pathlib.Path(".private-alert-cache/state.json")
def request_json(url, headers=None, data=None):
    req=urllib.request.Request(url,data=data,headers=headers or {},method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=22) as r: return json.load(r)
def to_num(v):
    try:
        x=float(v)
        return x if x>0 and x!=float("inf") else None
    except (ValueError,TypeError): return None
def main():
    if not all((RULES_JSON,API_KEY,BOT_TOKEN,CHAT_ID)):
        print("監控未啟用：請設定四個 GitHub Actions Secrets。")
        return 0
    rules=json.loads(RULES_JSON)
    if not isinstance(rules,list) or len(rules)>60: raise ValueError("ALERT_RULES_JSON must contain a list up to 60 symbols")
    if not (dt.time(9,0)<=NOW.time()<dt.time(13,35)) or NOW.weekday()>4:
        print("非一般盤中監控時間；不讀取或發送訊息")
        return 0
    existing={}
    if STATE.exists():
        try: existing=json.loads(STATE.read_text())
        except Exception: existing={}
    sent=set(existing.get("sent",[])) if existing.get("date")==TODAY else set()
    changed=False
    for rule in rules:
        if not isinstance(rule,dict): continue
        code=str(rule.get("code","")).strip()
        if not code.isalnum() or len(code)>10: continue
        try:
            q=request_json("https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/"+code,{"X-API-KEY":API_KEY,"Accept":"application/json"})
        except Exception as e:
            print("取得盤中行情失敗:",code,str(e)[:140],file=sys.stderr);continue
        if str(q.get("date",""))!=TODAY:
            print(code,"行情日期非今日，略過");continue
        market=str(rule.get("market","")).strip()
        expected={"上市":"TSE","上櫃":"OTC"}.get(market)
        if expected and q.get("market") not in (expected,None):
            print(code,"市場別不符，略過");continue
        hi=to_num(q.get("highPrice"));lo=to_num(q.get("lowPrice"))
        last=to_num(q.get("lastPrice"))
        checks=[("加碼觀察","buy",lo,"≤"),("停利觀察","take",hi,"≥"),("停損警示","stop",lo,"≤")]
        for label,field,observed,operator in checks:
            limit=to_num(rule.get(field))
            if limit is None or observed is None: continue
            touched=observed<=limit if operator=="≤" else observed>=limit
            if not touched: continue
            # Hash the complete alert condition; a changed threshold receives a new reminder.
            key=hashlib.sha256(f"{TODAY}|{code}|{market}|{field}|{limit}".encode()).hexdigest()[:28]
            if key in sent:continue
            name=str(rule.get("name",code)).strip()[:30]
            msg=(f"🔔 台股紀律提醒｜{label}\n{name} ({code})\n"
                 f"條件：當日{'最低' if field!='take' else '最高'}價 {operator} {limit:g} 元\n"
                 f"今日高／低：{hi if hi is not None else '無資料'}／{lo if lo is not None else '無資料'} 元\n"
                 f"最近成交：{last if last is not None else '無資料'} 元\n"
                 f"行情交易日：{TODAY}\n"
                 "⚠️ 非自動下單；僅表示當日曾觸價，收到訊息時價格可能已變。")
            try:
                payload=json.dumps({"chat_id":CHAT_ID,"text":msg}).encode()
                response=request_json(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                  {"Content-Type":"application/json"},payload)
                if not response.get("ok"):raise ValueError("Telegram returned not ok")
                sent.add(key);changed=True
                print("已發送:",code,label)
            except Exception as e:
                print("發送訊息失敗:",code,str(e)[:140],file=sys.stderr)
    STATE.parent.mkdir(parents=True,exist_ok=True)
    STATE.write_text(json.dumps({"date":TODAY,"sent":sorted(sent)}))
    if changed:print("今日新增提醒完成")
    return 0
if __name__=="__main__":
    try:sys.exit(main())
    except Exception as exc:
        print("監控執行失敗:",str(exc)[:200],file=sys.stderr);sys.exit(1)
