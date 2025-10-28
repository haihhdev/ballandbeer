// Vault client for Next.js frontend
// This loads secrets from Vault during server startup

let secretsCache = null;

async function loadSecretsFromVault() {
  if (secretsCache) {
    return secretsCache;
  }

  try {
    const vaultAddr = process.env.VAULT_ADDR || 'http://localhost:8200';
    const vaultToken = process.env.VAULT_TOKEN || 'root';
    const secretPath = process.env.VAULT_SECRET_PATH || 'secret/data/frontend-service';

    console.log(`[Vault] Connecting to Vault at: ${vaultAddr}`);
    console.log(`[Vault] Reading secrets from: ${secretPath}`);

    const response = await fetch(`${vaultAddr}/v1/${secretPath}`, {
      method: 'GET',
      headers: {
        'X-Vault-Token': vaultToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Vault request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const secrets = data.data.data;

    console.log('[Vault] Secrets loaded successfully');
    console.log('[Vault] Available keys:', Object.keys(secrets).join(', '));

    // Cache the secrets
    secretsCache = secrets;
    return secrets;
  } catch (error) {
    console.error('[Vault] Failed to load secrets from Vault:', error.message);
    console.log('[Vault] Falling back to .env.local if available');
    
    // Return empty object on failure - let .env.local handle it
    return {};
  }
}

// Load secrets and inject them into process.env
async function initializeVaultSecrets() {
  const secrets = await loadSecretsFromVault();
  
  // Only set env vars if they don't already exist (allow .env.local override for development)
  Object.keys(secrets).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = secrets[key];
      console.log(`[Vault] Set env var: ${key}`);
    } else {
      console.log(`[Vault] Env var ${key} already exists, skipping`);
    }
  });

  return secrets;
}

// Export function to get a specific secret
function getSecret(key) {
  if (secretsCache && secretsCache[key]) {
    return secretsCache[key];
  }
  return process.env[key];
}

module.exports = {
  initializeVaultSecrets,
  loadSecretsFromVault,
  getSecret,
};
