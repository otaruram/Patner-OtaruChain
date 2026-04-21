import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, supabase } from "../lib/supabase";

interface PlatformStats {
  total_scans: number;
  fraud_prevented: number;
  verified_scans: number;
  integrity_rate: number;
}

function fmt(n: number) { return n.toLocaleString("id-ID"); }

export default function Landing() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    // Redirect logged-in users straight to dashboard
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
    fetch(`${API}/api/v1/partner/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d))
      .catch(() => {});
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Nav */}
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="font-black text-xl tracking-tight">OtaruChain</span>
        <nav className="flex gap-5 text-sm items-center">
          <a href="#stats" className="hover:underline text-gray-500">Stats</a>
          <a href="#pricing" className="hover:underline text-gray-500">Pricing</a>
          <a href="/login" className="bg-black text-white px-4 py-2 text-xs font-semibold hover:bg-gray-800 transition">
            Partner Login →
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-b border-gray-100">
        <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">B2B Document Intelligence</p>
        <h1 className="text-5xl md:text-6xl font-black leading-none mb-6">
          OtaruChain<br />
          <span className="text-gray-400">Partner API</span>
        </h1>
        <p className="text-gray-500 max-w-xl text-base mb-10">
          Verifikasi dokumen logistik dan credit scoring real-time untuk koperasi, bank, dan
          lembaga keuangan. Satu API key, data terpercaya.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/login" className="bg-black text-white px-7 py-3 text-sm font-bold hover:bg-gray-800 transition">
            Mulai Sekarang
          </a>
          <a href="#pricing" className="border border-black px-7 py-3 text-sm font-bold hover:bg-black hover:text-white transition">
            Lihat Harga
          </a>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="max-w-6xl mx-auto px-6 py-14 border-b border-gray-100">
        <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-8">Platform Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: "Total Scans", value: stats ? fmt(stats.total_scans) : "…" },
            { label: "Fraud Prevented", value: stats ? fmt(stats.fraud_prevented) : "…" },
            { label: "Verified Docs", value: stats ? fmt(stats.verified_scans) : "…" },
            { label: "Integrity Rate", value: stats ? `${stats.integrity_rate}%` : "…" },
          ].map((s) => (
            <div key={s.label} className="border border-gray-200 p-6">
              <p className="text-3xl font-bold mb-1">{s.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-14 border-b border-gray-100">
        <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-8">Kenapa OtaruChain?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "Credit Scoring Real-Time",
              desc: "Skor kepercayaan otomatis berdasarkan riwayat scan dokumen nyata. Langsung dari data transaksi logistik.",
            },
            {
              title: "Fraud Detection",
              desc: "Deteksi dokumen tampered secara otomatis oleh AI. Setiap dokumen diverifikasi sebelum masuk database.",
            },
            {
              title: "API Mudah Diintegrasikan",
              desc: "Satu API key, satu endpoint GET. Integrasikan ke sistem koperasi atau LOS bank dalam hitungan jam.",
            },
          ].map((f) => (
            <div key={f.title} className="border border-gray-200 p-6">
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-14 border-b border-gray-100">
        <h2 className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-2">Pricing</h2>
        <p className="text-gray-500 text-sm mb-10 max-w-md">Login terlebih dahulu untuk melakukan pembayaran langsung dari dashboard.</p>
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
            </ul>
            <a href="https://ocr.wtf" target="_blank" rel="noopener noreferrer"
              className="mt-8 border border-black text-center py-2 text-sm font-semibold hover:bg-black hover:text-white transition">
              Coba di ocr.wtf
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
              <li>✓ 1 API key aktif</li>
              <li>✓ 10.000 scoring queries</li>
              <li>✓ Risk label real-time</li>
            </ul>
            <a href="/login" className="mt-8 bg-black text-white text-center py-2 text-sm font-semibold hover:bg-gray-800 transition">
              Login &amp; Beli
            </a>
          </div>
          {/* Enterprise */}
          <div className="border border-gray-200 p-8 flex flex-col">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-4">Enterprise / Bank</p>
            <p className="text-4xl font-bold mb-1">Custom</p>
            <p className="text-xs text-gray-400 mb-8">negosiasi</p>
            <ul className="text-sm text-gray-600 space-y-2 flex-1">
              <li>✓ Multiple API keys</li>
              <li>✓ Unlimited queries</li>
              <li>✓ Dedicated SLA</li>
              <li>✓ On-premise option</li>
            </ul>
            <a href="/login" className="mt-8 border border-black text-center py-2 text-sm font-semibold hover:bg-black hover:text-white transition">
              Login &amp; Hubungi
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-gray-400">
        <span className="font-bold text-black">OtaruChain</span>
        <span>Powered by <a href="https://ocr.wtf" className="underline">ocr.wtf</a></span>
      </footer>
    </div>
  );
}
