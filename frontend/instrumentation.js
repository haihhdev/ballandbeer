// This file runs when Next.js server starts
// It loads secrets from Vault before the app initializes

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeVaultSecrets } = require('./lib/vaultClient');
    
    console.log('[Next.js] Initializing Vault secrets...');
    try {
      await initializeVaultSecrets();
      console.log('[Next.js] Vault initialization complete');
    } catch (error) {
      console.error('[Next.js] Failed to initialize Vault:', error);
      // Continue with .env.local fallback
    }
  }
}
