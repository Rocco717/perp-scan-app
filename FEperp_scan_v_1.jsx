import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, ArrowRight, Home, Loader2, RefreshCw, Download, Globe, Copy } from "lucide-react";

/* ========================================================
   Perp Scan v1.2 — Two-page app (Landing → Dashboard)
   - No external router; uses hash routing (#/ and #/acct/:addr)
   - 15s fetch timeouts; CSV export links to your /pnlClean
   - Tailwind + shadcn components
   ======================================================== */

const DEFAULT_BASE = "https://perp-scan-live.liam-alerts.workers.dev"; // replace if needed
const BUILT_IN_PERIODS = ["day","week","month","allTime","perpDay","perpWeek","perpMonth","perpAllTime"];

// ---------- utils ----------
async function fetchJson(url: string, opts: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 15000, ...rest } = opts;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal, headers: { 'User-Agent': 'PerpScan-Web/1.2' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(to); }
}
const num = (v: any, d = 2) => v == null || !isFinite(+v) ? "" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (v: any) => v == null || !isFinite(+v) ? "" : `${(Math.abs(+v) <= 1 ? +v * 100 : +v).toFixed(2)}%`;
const ts  = (ms?: number) => !ms ? "" : new Date(ms).toLocaleString();

function useHashRoute() {
  const [hash, setHash] = useState<string>(() => window.location.hash || "#/");
  useEffect(() => { const h = () => setHash(window.location.hash || "#/"); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  return hash;
}
function parseRoute(hash: string){
  // #/acct/0xabc?... or #/
  const clean = hash.replace(/^#/, "");
  const [path, queryStr] = clean.split("?");
  const qs = new URLSearchParams(queryStr || "");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "acct" && parts[1]) return { name: "acct", addr: parts[1], qs } as const;
  return { name: "home", qs } as const;
}
function shareUrl(addr: string, baseUrl: string){
  const u = new URL(window.location.href);
  u.hash = `#/acct/${addr}?base=${encodeURIComponent(baseUrl)}`;
  return u.toString();
}

// ---------- app ----------
export default function App(){
  const hash = useHashRoute();
  const route = parseRoute(hash);
  return route.name === "home" ? <Landing /> : <Dashboard addr={route.addr} qs={route.qs} />;
}

// ---------- Landing Page ----------
function Landing(){
  const [baseUrl, setBaseUrl] = useState<string>(() => localStorage.getItem("ps_base") || DEFAULT_BASE);
  const [addr, setAddr] = useState<string>("");
  useEffect(() => { localStorage.setItem("ps_base", baseUrl); }, [baseUrl]);

  function go(){ if (!addr) return; window.location.hash = `#/acct/${addr}?base=${encodeURIComponent(baseUrl)}`; }

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50 p-6">
      <Card className="w-full max-w-xl shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-neutral-500 text-sm"><Home className="w-4 h-4"/> Start</div>
          <CardTitle className="text-xl">Perp Scan v1.2 — Enter Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label className="text-sm">Account address</Label>
            <Input value={addr} onChange={(e)=>setAddr(e.target.value)} placeholder="0x…" className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">Base URL (API)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)} placeholder="https://…" />
              <Button variant="outline" onClick={()=>setBaseUrl(DEFAULT_BASE)} title="Reset"><Globe className="w-4 h-4"/></Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={go} className="gap-2">Continue <ArrowRight className="w-4 h-4"/></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Dashboard Page ----------
function Dashboard({ addr, qs }: { addr: string; qs: URLSearchParams }){
  const [baseUrl, setBaseUrl] = useState<string>(() => qs.get("base") || localStorage.getItem("ps_base") || DEFAULT_BASE);
  const [period, setPeriod] = useState<string>(() => qs.get("period") || "week");
  const [includePositions, setIncludePositions] = useState<boolean>(true);
  const [includeClosed, setIncludeClosed] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<any | null>(null);

  useEffect(()=>{ localStorage.setItem("ps_base", baseUrl); }, [baseUrl]);

  async function run(){
    setLoading(true); setError(""); setData(null);
    try {
      const params = new URLSearchParams({ account: addr, period, _ts: String(Math.floor(Date.now()/1000)) });
      if (includePositions) params.set("positions","1");
      if (includeClosed) params.set("closed","1");
      const url = `${baseUrl.replace(/\/$/,"")}/pnlClean?${params.toString()}`;
      const json = await fetchJson(url, { timeoutMs: 15000 });
      if (!json.ok) throw new Error(json.error || "ok=false");
      setData(json);
    } catch(e: any){ setError(e?.message || String(e)); }
    finally{ setLoading(false); }
  }

  function downloadCsv(section: "closed"|"positions"){
    const url = `${baseUrl.replace(/\/$/,"")}/pnlClean?account=${addr}&period=${period}&csv=1&section=${section}&_ts=${Math.floor(Date.now()/1000)}`;
    const a = document.createElement('a'); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click();
  }

  const positions = useMemo(()=> data?.positions ?? [], [data]);
  const closed    = useMemo(()=> data?.closed ?? [], [data]);
  const link      = shareUrl(addr, baseUrl);

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-6xl mx-auto grid gap-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-500">Perp Scan v1.2</div>
            <div className="text-xl font-semibold">Dashboard — {addr.slice(0,6)}…{addr.slice(-4)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>{navigator.clipboard.writeText(link)}} className="gap-2" title="Copy share link"><Copy className="w-4 h-4"/>Share</Button>
            <a href="#/" className="text-sm text-neutral-600 underline">Change address</a>
          </div>
        </div>

        {/* Controls */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Controls</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm">Base URL</Label>
              <div className="flex gap-2 mt-1">
                <Input value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)} />
                <Button variant="outline" onClick={()=>setBaseUrl(DEFAULT_BASE)} title="Reset"><Globe className="w-4 h-4"/></Button>
              </div>
            </div>
            <div>
              <Label className="text-sm">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select period" /></SelectTrigger>
                <SelectContent>
                  {BUILT_IN_PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <div className="flex items-center gap-2"><Switch id="pos" checked={includePositions} onCheckedChange={setIncludePositions}/><Label htmlFor="pos">Positions</Label></div>
              <div className="flex items-center gap-2"><Switch id="cls" checked={includeClosed} onCheckedChange={setIncludeClosed}/><Label htmlFor="cls">Closed</Label></div>
            </div>
            <div className="flex items-end">
              <Button onClick={run} disabled={loading} className="gap-2 w-full">{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>} Fetch</Button>
            </div>
            {includeClosed && (
              <div className="col-span-full flex gap-2 -mt-2">
                <Button variant="outline" className="gap-2" onClick={()=>downloadCsv('closed')}><Download className="w-4 h-4"/>Closed CSV</Button>
                {includePositions && <Button variant="outline" className="gap-2" onClick={()=>downloadCsv('positions')}><Download className="w-4 h-4"/>Positions CSV</Button>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
            <AlertCircle className="w-5 h-5 mt-0.5"/>
            <div><div className="font-medium">Error</div><div className="text-sm">{error}</div></div>
          </div>
        )}

        {/* Data */}
        {data && (
          <div className="grid gap-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoCard title="Period" value={data.period} sub={data.method} />
              <InfoCard title="Trading PnL" value={`$${num(data.perp_pnl)}`} sub={`ROI ${pct(data.roi?.trading_pct)}`} />
              <InfoCard title="Portfolio PnL" value={`$${num(data.balance_change)}`} sub={`ROI ${pct(data.roi?.portfolio_pct)}`} />
              <InfoCard title="Balances Now" value={`Perp $${num(data.balances?.perp_now)}
Port $${num(data.balances?.portfolio_now)}`} mono />
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-4 text-sm grid md:grid-cols-3 gap-4">
                <div><div className="font-medium text-neutral-700">Window</div><div className="text-neutral-600">{ts(data.window?.startMs)} → {ts(data.window?.endMs)}</div></div>
                <div><div className="font-medium text-neutral-700">Cashflows</div><div className="text-neutral-600">Deposits: ${num(data.adjustments?.deposits)} · Withdrawals: ${num(data.adjustments?.withdrawals)} · Net: ${num(data.adjustments?.net_cashflow)}</div></div>
                <div className="text-neutral-500">v1.2 — Landing → Dashboard flow · CSV export.</div>
              </CardContent>
            </Card>

            {/* Positions */}
            {includePositions && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">Open Positions ({positions.length})</CardTitle></CardHeader>
                <CardContent className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="py-2 pr-4">Coin</th>
                        <th className="py-2 pr-4">Side</th>
                        <th className="py-2 pr-4">Size</th>
                        <th className="py-2 pr-4">Entry</th>
                        <th className="py-2 pr-4">Mark</th>
                        <th className="py-2 pr-4">Notional</th>
                        <th className="py-2 pr-4">Unrealized</th>
                        <th className="py-2 pr-4">ROE</th>
                        <th className="py-2 pr-4">Basis</th>
                        <th className="py-2 pr-4">Lev</th>
                        <th className="py-2 pr-4">LiqPx</th>
                        <th className="py-2 pr-4">EntryTs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="py-2 pr-4 whitespace-nowrap">{p.symbolPretty || p.coin}</td>
                          <td className="py-2 pr-4">{p.side}</td>
                          <td className="py-2 pr-4">{num(p.size, 4)} {p.coin}</td>
                          <td className="py-2 pr-4">{num(p.entryPx, 6)}</td>
                          <td className="py-2 pr-4">{num(p.markPx, 6)}</td>
                          <td className="py-2 pr-4">${num(p.notional)}</td>
                          <td className="py-2 pr-4">${num(p.unrealizedPnl)}</td>
                          <td className="py-2 pr-4">{pct(p.roePct)}</td>
                          <td className="py-2 pr-4">{pct(p.basisPct)}</td>
                          <td className="py-2 pr-4">{p.leverage ?? ""}</td>
                          <td className="py-2 pr-4">{num(p.liqPx, 5)}</td>
                          <td className="py-2 pr-4">{p.entryTs ? ts(p.entryTs) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Closed */}
            {includeClosed && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">Closed Trades ({closed.length})</CardTitle></CardHeader>
                <CardContent className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="py-2 pr-4">End</th>
                        <th className="py-2 pr-4">Coin</th>
                        <th className="py-2 pr-4">Dir</th>
                        <th className="py-2 pr-4">Duration</th>
                        <th className="py-2 pr-4">SizeClosed</th>
                        <th className="py-2 pr-4">AvgEntry</th>
                        <th className="py-2 pr-4">ExitPx</th>
                        <th className="py-2 pr-4">PnL</th>
                        <th className="py-2 pr-4">Fees</th>
                        <th className="py-2 pr-4">NetPnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closed.map((c: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="py-2 pr-4 whitespace-nowrap">{ts(c.endTs)}</td>
                          <td className="py-2 pr-4">{c.symbolPretty || c.coin}</td>
                          <td className="py-2 pr-4">{c.direction}</td>
                          <td className="py-2 pr-4">{num(c.durationMs/1000, 0)}s</td>
                          <td className="py-2 pr-4">{num(c.sizeClosed, 4)}</td>
                          <td className="py-2 pr-4">{num(c.avgEntryPx, 6)}</td>
                          <td className="py-2 pr-4">{num(c.exitPx, 6)}</td>
                          <td className="py-2 pr-4">${num(c.pnl)}</td>
                          <td className="py-2 pr-4">${num(c.fees)}</td>
                          <td className="py-2 pr-4">${num(c.netPnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!data && !loading && !error && (
          <Card className="shadow-sm">
            <CardContent className="p-6 text-neutral-500 text-sm">Click <span className="font-medium text-neutral-700">Fetch</span> to load {addr.slice(0,8)}…</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, value, sub, mono = false }: { title: string; value: string; sub?: string; mono?: boolean }){
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-neutral-600">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className={"text-xl font-semibold " + (mono ? "font-mono whitespace-pre-line" : "")}>{value || "—"}</div>
        {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
