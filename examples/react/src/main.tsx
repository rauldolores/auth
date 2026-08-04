import { AuthProvider } from "@kontrolia/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const kontroliaConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider config={kontroliaConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
);
