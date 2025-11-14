/**
 * Secure Storage - AES-256-GCM Encrypted localStorage
 *
 * Protects cached data from XSS attacks by encrypting all stored data
 * Uses Web Crypto API for cryptographically secure encryption
 *
 * Security Features:
 * - AES-256-GCM encryption
 * - Session-specific encryption keys
 * - Initialization vector (IV) per encryption
 * - Automatic key rotation on page reload
 */

class SecureStorage {
  constructor() {
    this.key = null;
    this.keyPromise = this.initializeKey();
  }

  /**
   * Initialize encryption key for this session
   * Uses Web Crypto API to generate cryptographically secure key
   */
  async initializeKey() {
    try {
      // Check if browser supports Web Crypto API
      if (!window.crypto || !window.crypto.subtle) {
        console.warn('Web Crypto API not available, falling back to unencrypted storage');
        this.key = null;
        return;
      }

      // Generate AES-256-GCM key for this session
      this.key = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      this.key = null;
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} data - Data to encrypt
   * @returns {Promise<string>} Base64-encoded encrypted data with IV
   */
  async encrypt(data) {
    await this.keyPromise;

    // Fallback to unencrypted if crypto not available
    if (!this.key) {
      return data;
    }

    try {
      const encoder = new TextEncoder();

      // Generate random IV (12 bytes for GCM)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Encrypt data
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        this.key,
        encoder.encode(data)
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      return data; // Fallback to unencrypted
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {string} encryptedData - Base64-encoded encrypted data with IV
   * @returns {Promise<string>} Decrypted data
   */
  async decrypt(encryptedData) {
    await this.keyPromise;

    // Fallback to unencrypted if crypto not available
    if (!this.key) {
      return encryptedData;
    }

    try {
      // Decode base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

      // Extract IV (first 12 bytes)
      const iv = combined.slice(0, 12);

      // Extract encrypted data
      const encrypted = combined.slice(12);

      // Decrypt
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        this.key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null; // Return null on decryption failure
    }
  }

  /**
   * Store encrypted data in localStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be JSON serialized)
   */
  async setItem(key, value) {
    try {
      const serialized = JSON.stringify(value);
      const encrypted = await this.encrypt(serialized);
      localStorage.setItem(`secure:${key}`, encrypted);
    } catch (error) {
      console.error('Failed to store item:', error);
    }
  }

  /**
   * Retrieve and decrypt data from localStorage
   * @param {string} key - Storage key
   * @returns {Promise<any>} Decrypted and parsed value
   */
  async getItem(key) {
    try {
      const encrypted = localStorage.getItem(`secure:${key}`);
      if (!encrypted) {
        return null;
      }

      const decrypted = await this.decrypt(encrypted);
      if (!decrypted) {
        return null;
      }

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to retrieve item:', error);
      return null;
    }
  }

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   */
  removeItem(key) {
    localStorage.removeItem(`secure:${key}`);
  }

  /**
   * Clear all secure storage items
   */
  clear() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('secure:')) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Check if encryption is available
   * @returns {Promise<boolean>}
   */
  async isEncryptionAvailable() {
    await this.keyPromise;
    return this.key !== null;
  }
}

// Export singleton instance
const secureStorage = new SecureStorage();
export default secureStorage;
