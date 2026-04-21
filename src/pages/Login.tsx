import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  async function signInGoogle() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 border-b border-gray-100">
        <a href="/" className="font-black text-xl tracking-tight">OtaruChain</a>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="border border-gray-200 p-8">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gray-400 mb-3">Partner Login</p>
            <h1 className="text-2xl font-bold mb-2">Masuk ke Portal</h1>
            <p className="text-sm text-gray-500 mb-8">
              Gunakan akun Google yang sama dengan ocr.wtf — data langsung terhubung.
            </p>

            {error && (
              <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-700 mb-4 rounded">
                {error}
              </div>
            )}

            <button
              onClick={signInGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 py-3 text-sm font-semibold hover:border-black hover:bg-black hover:text-white transition disabled:opacity-40"
            >
              {loading ? (
                "Mengalihkan…"
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.5-.4-3.5z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.1 0-9.6-3.2-11.3-7.9l-6.6 5c3.4 6.5 10.1 11 17.9 11z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C41.3 35.4 44 30.1 44 24c0-1.2-.1-2.5-.4-3.5z" />
                  </svg>
                  Lanjut dengan Google
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 mt-6 text-center">
              Belum punya akun?{" "}
              <a href="https://ocr.wtf" target="_blank" rel="noopener noreferrer" className="underline text-black">
                Daftar gratis di ocr.wtf
              </a>
            </p>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-gray-100 text-xs text-gray-400 text-center">
        © 2025 OtaruChain · <a href="https://ocr.wtf/privacy" className="underline">Privacy</a>
      </footer>
    </div>
  );
}
