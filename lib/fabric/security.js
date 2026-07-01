/**
 * BONDS Fabric Security Layer
 *
 * Abstraction for connector authentication, authorization, encryption,
 * secrets management, audit, least privilege, key rotation, and failure isolation.
 */

class FabricSecurity {
  constructor(options = {}) {
    this.secretProvider = options.secretProvider || null;
    this.auditLog = options.auditLog || null;
  }

  /**
   * Retrieve a secret for a connector without logging its value.
   */
  async getSecret(connectorCode, key) {
    if (!this.secretProvider) {
      const envKey = `${connectorCode.toUpperCase().replace(/-/g, '_')}_${key.toUpperCase()}`;
      const value = process.env[envKey];
      if (!value) throw new Error(`Secret not found: ${envKey}`);
      return { key, source: 'env', value };
    }
    return this.secretProvider.get(connectorCode, key);
  }

  /**
   * Authorize an operation for a connector/source.
   */
  async authorize({ connectorCode, operation, user }) {
    const allowed = this._checkPermission(connectorCode, operation, user);
    await this._audit('authorize', { connectorCode, operation, user, allowed });
    return { allowed };
  }

  /**
   * Encrypt a sensitive value before storage.
   */
  async encrypt(value) {
    // Placeholder: production uses KMS/AES-256-GCM.
    return { encrypted: Buffer.from(JSON.stringify(value)).toString('base64'), method: 'base64_placeholder' };
  }

  async decrypt(payload) {
    return JSON.parse(Buffer.from(payload.encrypted, 'base64').toString('utf8'));
  }

  /**
   * Rotate a connector secret.
   */
  async rotateSecret(connectorCode, key) {
    if (!this.secretProvider) throw new Error('No secret provider configured');
    await this._audit('rotate', { connectorCode, key });
    return this.secretProvider.rotate(connectorCode, key);
  }

  /**
   * Isolate a connector after repeated failures.
   */
  async isolate(connectorCode, reason) {
    await this._audit('isolate', { connectorCode, reason });
    return { isolated: true, reason };
  }

  _checkPermission(connectorCode, operation, user) {
    if (!user) return false;
    // Placeholder RBAC: admin can do anything; read operations are public.
    if (user.role === 'admin' || user.role === 'owner') return true;
    if (operation === 'read') return true;
    return false;
  }

  async _audit(action, details) {
    if (this.auditLog) {
      await this.auditLog({ action, details, timestamp: new Date().toISOString() });
    }
  }
}

module.exports = { FabricSecurity };
