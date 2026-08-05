export const kontroliaClientConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
};
