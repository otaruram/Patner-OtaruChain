import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API, authHeader, supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformStats {
  total_scans: number;
  fraud_prevented: number;
  verified_scans: number;
  integrity_rate: number;
}

interface ApiKeyInfo {
  key_value: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface ScanSummary {
  scan_id: string;
  status: string;
  nominal_total: number | null;
  vendor_name: string | null;
  doc_type: string | null;
  created_at: string;
}

interface ScoringResult {
  email: string;
  user_id: string;
  trust_score: number;
  risk_label: "PRIME" | "MODERATE" | "RISK";
  total_scans: number;
  verified_scans: number;
  tampered_scans: number;
  total_nominal: number;
  recent_scans: ScanSummary[];
}

type PricingStatus = "idle" | "loading" | "success" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("id-ID"); }
function fmtRp(n: number) {
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}M`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(1)}jt`;
  return `Rp ${fmt(n)}`;
}

function RiskBadge({ label }: { label: string }) {
  const c = label === "PRIME" ? "bg-black text-white" : label === "MODERATE" ? "bg-gray-600 text-white" : "border border-black text-black";
  return <span className={`inline-block px-3 py-0.5 text-xs font-bold tracking-widest rounded-full ${c}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const c = s === "verified" ? "bg-black text-white" : s === "tampered" ? "border border-black text-black" : "bg-gray-100 text-gray-500";
  return <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded uppercase tracking-wide ${c}`}>{status}</span>;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<ScoringResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Pricing
  const [pricingPlan, setPricingPlan] = useState<"koperasi" | "enterprise" | null>(null);
  const [pricingStatus, setPricingStatus] = useState<PricingStatus>("idle");
  const [pricingUrl, setPricingUrl] = useState<string | null>(null);

  // Active nav section for mobile
  const [section, setSection] = useState<"dashboard" | "scoring" | "pricing">("dashboard");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserEmail(data.user.email ?? "");
    });
    fetchStats();
    fetchMyKey();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch(`${API}/api/v1/partner/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchMyKey() {
    setAuthError(null);
    const headers = await authHeader();
    if (!(headers as Record<string, string>).Authorization) return;
    try {
      const res = await fetch(`${API}/api/v1/apikeys/me`, { headers });
      if (res.status === 401) {
        setAuthError("Session login expired. Silakan login ulang.");
        return;
      }
      if (res.ok) setApiKey(await res.json());
    } catch { /* ignore */ }
  }

  async function generateKey() {
    setApiKeyLoading(true);
    setAuthError(null);
    try {
      const h = { ...(await authHeader() as Record<string, string>), "Content-Type": "application/json" };
      if (!h.Authorization) {
        setAuthError("Session login tidak ditemukan. Silakan login ulang.");
        navigate("/login", { replace: true });
        return;
      }
      const res = await fetch(`${API}/api/v1/apikeys/generate`, { method: "POST", headers: h });
      if (res.status === 401) {
        setAuthError("Token tidak valid di backend. Silakan login ulang.");
        navigate("/login", { replace: true });
        return;
      }
      if (res.ok) setApiKey(await res.json());
    } finally { setApiKeyLoading(false); }
  }

  async function revokeKey() {
    if (!confirm("Revoke API key ini? Key tidak bisa digunakan lagi.")) return;
    setApiKeyLoading(true);
    setAuthError(null);
    try {
      const h = await authHeader();
      if (!(h as Record<string, string>).Authorization) {
        setAuthError("Session login tidak ditemukan. Silakan login ulang.");
        navigate("/login", { replace: true });
        return;
      }
      const res = await fetch(`${API}/api/v1/apikeys/me`, { method: "DELETE", headers: h });
      if (res.status === 401) {
        setAuthError("Token tidak valid di backend. Silakan login ulang.");
        navigate("/login", { replace: true });
        return;
      }
      setApiKey(null);
    } finally { setApiKeyLoading(false); }
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey.key_value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim() || !apiKey) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const res = await fetch(`${API}/api/v1/scoring/${encodeURIComponent(searchEmail.trim())}`, {
        headers: { "x-api-key": apiKey.key_value },
      });
      if (res.status === 404) setSearchError("User tidak ditemukan.");
      else if (res.status === 401) setSearchError("API key tidak valid.");
      else if (!res.ok) setSearchError("Error mengambil data.");
      else setSearchResult(await res.json());
    } catch { setSearchError("Network error."); }
    finally { setSearchLoading(false); }
  }, [searchEmail, apiKey]);

  async function handleCheckout(plan: "koperasi" | "enterprise") {
    setPricingPlan(plan);
    setPricingStatus("loading");
    setPricingUrl(null);
    setAuthError(null);
    try {
      const h = { ...(await authHeader() as Record<string, string>), "Content-Type": "application/json" };
      if (!h.Authorization) {
        setAuthError("Session login tidak ditemukan. Silakan login ulang.");
        navigate("/login", { replace: true });
        setPricingStatus("error");
        return;
      }
      const res = await fetch(`${API}/api/v1/payment/checkout`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        setAuthError("Token tidak valid di backend. Silakan login ulang.");
        navigate("/login", { replace: true });
        setPricingStatus("error");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPricingUrl(data.payment_url);
      setPricingStatus("success");
      // Open in new tab
      window.open(data.payment_url, "_blank", "noopener,noreferrer");
    } catch {
      setPricingStatus("error");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Top nav */}
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <span className="font-black text-lg tracking-tight">OtaruChain</span>
          <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">Partner</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-400 hidden sm:block">{userEmail}</span>
          <button onClick={signOut} className="text-gray-500 hover:text-black transition">Sign out</button>
        </div>
      </header>

      {/* Mobile section tabs */}
      <nav className="border-b border-gray-100 flex sm:hidden text-xs font-semibold">
        {(["dashboard", "scoring", "pricing"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`flex-1 py-3 capitalize tracking-wide transition ${section === s ? "border-b-2 border-black" : "text-gray-400"}`}
          >
            {s}
          </button>
        ))}
      </nav>

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 space-y-16">
        {authError && (
          <div className="border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 max-w-2xl">
            {authError}
          </div>
        )}

        {/* ── Stats ──────────────────────────────────────────────── */}
        <section className={section !== "dashboard" ? "hidden sm:block" : ""}>
          <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-6">Platform Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Scans", value: stats ? fmt(stats.total_scans) : "—" },
              { label: "Fraud Prevented", value: stats ? fmt(stats.fraud_prevented) : "—" },
              { label: "Verified", value: stats ? fmt(stats.verified_scans) : "—" },
              { label: "Integrity Rate", value: stats ? `${stats.integrity_rate}%` : "—" },
            ].map((s) => (
              <div key={s.label} className="border border-gray-200 p-5">
                <p className="text-2xl font-bold mb-1">{s.value}</p>
                <p className="text-xs text-gray-500 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── API Key ────────────────────────────────────────────── */}
        <section className={section !== "dashboard" ? "hidden sm:block" : ""}>
          <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-6">API Key</h2>
          <div className="border border-gray-200 p-6 max-w-2xl">
            {apiKey ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Active</span>
                  <span className="w-2 h-2 bg-black rounded-full" />
                </div>
                <div className="flex gap-2 mb-3">
                  <code className="flex-1 bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-mono break-all">{apiKey.key_value}</code>
                  <button onClick={copyKey} className="border border-black px-4 text-xs font-semibold hover:bg-black hover:text-white transition whitespace-nowrap">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-5">
                  Dibuat: {new Date(apiKey.created_at).toLocaleDateString("id-ID")}
                  {apiKey.last_used_at && <> · Terakhir: {new Date(apiKey.last_used_at).toLocaleDateString("id-ID")}</>}
                </p>
                <div className="flex gap-3">
                  <button onClick={generateKey} disabled={apiKeyLoading} className="border border-black px-4 py-2 text-xs font-semibold hover:bg-black hover:text-white transition disabled:opacity-40">Rotate</button>
                  <button onClick={revokeKey} disabled={apiKeyLoading} className="border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-500 hover:border-black hover:text-black transition disabled:opacity-40">Revoke</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-5">Belum ada API key aktif.</p>
                <button onClick={generateKey} disabled={apiKeyLoading} className="bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-40">
                  {apiKeyLoading ? "Generating…" : "Generate API Key"}
                </button>
              </>
            )}
          </div>
        </section>

        {/* ── Scoring ────────────────────────────────────────────── */}
        <section className={section !== "scoring" ? "hidden sm:block" : ""}>
          <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-6">User Credit Scoring</h2>
          <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-lg">
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="flex-1 border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-black"
            />
            <button type="submit" disabled={searchLoading || !apiKey} className="bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-40">
              {searchLoading ? "…" : "Cari"}
            </button>
          </form>
          {!apiKey && <p className="text-xs text-gray-400">Generate API key dulu untuk menggunakan fitur ini.</p>}
          {searchError && <p className="text-sm text-red-600 mb-4">{searchError}</p>}
          {searchResult && (
            <div className="border border-gray-200 p-6 max-w-2xl">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-lg font-bold">{searchResult.email}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{searchResult.user_id.slice(0, 16)}…</p>
                </div>
                <RiskBadge label={searchResult.risk_label} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Trust Score", value: String(searchResult.trust_score) },
                  { label: "Total Scans", value: String(searchResult.total_scans) },
                  { label: "Verified", value: String(searchResult.verified_scans) },
                  { label: "Tampered", value: String(searchResult.tampered_scans) },
                ].map((s) => (
                  <div key={s.label} className="border border-gray-100 p-3">
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Total Nominal Verified: <span className="text-black font-semibold">{fmtRp(searchResult.total_nominal)}</span>
              </p>
              {searchResult.recent_scans.length > 0 && (
                <div className="border border-gray-100 divide-y divide-gray-100 text-sm">
                  {searchResult.recent_scans.map((s) => (
                    <div key={s.scan_id} className="flex items-center justify-between px-3 py-2 gap-4">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-gray-400 truncate">{s.scan_id.slice(0, 8)}…</p>
                        <p className="text-xs truncate">{s.vendor_name ?? s.doc_type ?? "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <StatusBadge status={s.status} />
                        {s.nominal_total != null && <p className="text-xs text-gray-500 mt-0.5">{fmtRp(s.nominal_total)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <section id="pricing" className={section !== "pricing" ? "hidden sm:block" : ""}>
          <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-2">Pricing</h2>
          <p className="text-gray-500 text-sm mb-8 max-w-md">Pilih paket yang sesuai. Pembayaran aman via OtaruChain.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="border border-gray-200 p-8 flex flex-col">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">Free</p>
              <p className="text-4xl font-bold mb-1">Rp 0</p>
              <p className="text-xs text-gray-400 mb-8">/ bulan</p>
              <ul className="text-sm text-gray-600 space-y-2 flex-1">
                <li>✓ Scan dokumen tak terbatas</li>
                <li>✓ Dashboard & histori</li>
                <li>✓ Telegram bot</li>
                <li className="text-gray-300">✗ API scoring</li>
                <li className="text-gray-300">✗ Bulk export</li>
              </ul>
              <a href="https://ocr.wtf" target="_blank" rel="noopener noreferrer"
                className="mt-8 border border-black text-center py-2 text-sm font-semibold hover:bg-black hover:text-white transition">
                Mulai Gratis
              </a>
            </div>

            {/* Koperasi */}
            <div className="border-2 border-black p-8 flex flex-col relative">
              <span className="absolute top-0 right-0 bg-black text-white text-xs px-3 py-1 font-semibold tracking-widest">POPULER</span>
              <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">Koperasi</p>
              <p className="text-4xl font-bold mb-1">Rp 499k</p>
              <p className="text-xs text-gray-400 mb-8">/ bulan</p>
              <ul className="text-sm text-gray-600 space-y-2 flex-1">
                <li>✓ Semua fitur Free</li>
                <li>✓ 1 API key</li>
                <li>✓ 10.000 scoring queries/bulan</li>
                <li>✓ Real-time risk label</li>
                <li className="text-gray-300">✗ SLA support</li>
              </ul>
              <button
                onClick={() => handleCheckout("koperasi")}
                disabled={pricingPlan === "koperasi" && pricingStatus === "loading"}
                className="mt-8 bg-black text-white py-2 text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-40"
              >
                {pricingPlan === "koperasi" && pricingStatus === "loading" ? "Memproses…" : "Beli Sekarang"}
              </button>
              {pricingPlan === "koperasi" && pricingStatus === "success" && pricingUrl && (
                <a href={pricingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-center underline text-gray-500">Buka halaman pembayaran →</a>
              )}
              {pricingPlan === "koperasi" && pricingStatus === "error" && (
                <p className="mt-2 text-xs text-red-600 text-center">Gagal membuat transaksi. Coba lagi.</p>
              )}
            </div>

            {/* Enterprise */}
            <div className="border border-gray-200 p-8 flex flex-col">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">Enterprise / Bank</p>
              <p className="text-4xl font-bold mb-1">Custom</p>
              <p className="text-xs text-gray-400 mb-8">negosiasi langsung</p>
              <ul className="text-sm text-gray-600 space-y-2 flex-1">
                <li>✓ Semua fitur Koperasi</li>
                <li>✓ Multiple API keys</li>
                <li>✓ Unlimited queries</li>
                <li>✓ Dedicated SLA</li>
                <li>✓ On-premise option</li>
              </ul>
              <button
                onClick={() => handleCheckout("enterprise")}
                disabled={pricingPlan === "enterprise" && pricingStatus === "loading"}
                className="mt-8 border border-black py-2 text-sm font-semibold hover:bg-black hover:text-white transition disabled:opacity-40"
              >
                {pricingPlan === "enterprise" && pricingStatus === "loading" ? "Memproses…" : "Hubungi / Beli"}
              </button>
              {pricingPlan === "enterprise" && pricingStatus === "success" && pricingUrl && (
                <a href={pricingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-center underline text-gray-500">Buka halaman pembayaran →</a>
              )}
              {pricingPlan === "enterprise" && pricingStatus === "error" && (
                <p className="mt-2 text-xs text-red-600 text-center">Gagal membuat transaksi. Coba lagi.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-gray-100 px-6 py-6 flex items-center justify-between text-xs text-gray-400 max-w-6xl mx-auto w-full">
        <span>© 2025 OtaruChain</span>
        <span>Powered by <a href="https://ocr.wtf" className="underline">ocr.wtf</a></span>
      </footer>
    </div>
  );
}
