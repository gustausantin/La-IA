
// src/dev/InitializationTest.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";            // ajusta la ruta si difiere
import { initSession } from "../contexts/AuthContext"; // ajusta la ruta si difiere

export default function InitializationTest() {
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      setAuthUser(authData?.user ?? null);
      const { restaurant } = await initSession();
      setRestaurant(restaurant ?? null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { run(); }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Initialization Test</h1>
      <button onClick={run} disabled={loading} style={{ marginBottom: 12 }}>
        {loading ? "Comprobando..." : "Reintentar"}
      </button>

      {error && <pre style={{ color: "crimson" }}>Error: {error}</pre>}

      <div style={{ display: "grid", gap: 8 }}>
        <div><strong>Auth user:</strong> {authUser?.id || "—"}</div>
        <div><strong>Restaurante:</strong> {restaurant?.name || "—"}</div>
        <div><strong>Restaurante ID:</strong> {restaurant?.id || "—"}</div>
      </div>
    </div>
  );
}
