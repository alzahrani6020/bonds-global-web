/**
 * BONDS Plugin SDK Specification
 *
 * Defines the contract every plugin must implement: manifest, permissions,
 * dependencies, supported versions, digital signature, lifecycle, compatibility,
 * and configuration.
 */

class PluginSDK {
  static validateManifest(manifest) {
    const required = ['pluginCode', 'name', 'version', 'permissions', 'dependencies', 'supportedVersions'];
    const errors = [];
    for (const key of required) {
      if (manifest[key] === undefined || manifest[key] === null) errors.push(`missing ${key}`);
    }
    if (!Array.isArray(manifest.permissions)) errors.push('permissions must be an array');
    if (!Array.isArray(manifest.dependencies)) errors.push('dependencies must be an array');
    if (!Array.isArray(manifest.supportedVersions)) errors.push('supportedVersions must be an array');
    return { valid: errors.length === 0, errors };
  }

  static checkCompatibility(pluginVersion, platformVersion) {
    const [major] = pluginVersion.split('.');
    const [pMajor] = platformVersion.split('.');
    return major === pMajor;
  }

  static verifySignature(manifest, signature, publicKey) {
    // Placeholder: real implementation would use crypto.verify.
    return { valid: !!signature && !!publicKey, method: 'ed25519_placeholder' };
  }
}

module.exports = { PluginSDK };
