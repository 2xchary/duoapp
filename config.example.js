// Template. Copy this file to config.js and fill it in. config.js is gitignored and never committed;
// the deployed site gets its own config.js from GitHub Secrets (see README, "Put it online").
// (There is no Giphy key here: GIF search runs through a Supabase function that holds the key. See README.)
window.CONFIG = {
  SUPABASE_URL: '',   // https://<your-project>.supabase.co
  SUPABASE_KEY: '',   // the PUBLISHABLE key (sb_publishable_...). NEVER the secret / service_role key.
  DEMO: true,         // fake partner on one phone; ignored once Supabase is configured
};
