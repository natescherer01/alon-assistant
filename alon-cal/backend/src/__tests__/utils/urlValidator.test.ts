/**
 * URL Validator Tests
 *
 * Tests for SSRF protection and URL validation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { validateIcsUrl, isPrivateIP } from '../../utils/urlValidator';
import dns from 'dns';

// Mock DNS resolution
jest.mock('dns');

describe('URL Validator - SSRF Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set development mode to allow HTTP
    process.env.NODE_ENV = 'development';
    process.env.ICS_ALLOW_HTTP = 'true';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Valid URLs', () => {
    it('should accept valid HTTPS URL', async () => {
      // Mock DNS resolution to public IP
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34']); // example.com
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('https://example.com/calendar.ics');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid HTTP URL in dev mode', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34']);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('http://example.com/calendar.ics');

      expect(result.valid).toBe(true);
    });

    it('should reject HTTP URL in production mode', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ICS_ALLOW_HTTP = 'false';

      const result = await validateIcsUrl('http://example.com/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTTPS');
    });

    it('should accept URL with query parameters', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34']);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('https://example.com/calendar.ics?token=abc123&format=ical');

      expect(result.valid).toBe(true);
    });

    it('should accept URL with port number', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34']);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('https://example.com:8443/calendar.ics');

      expect(result.valid).toBe(true);
    });
  });

  describe('Private IP Address Blocking', () => {
    it('should reject private IP 192.168.1.1', async () => {
      const result = await validateIcsUrl('https://192.168.1.1/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject private IP 10.0.0.1', async () => {
      const result = await validateIcsUrl('https://10.0.0.1/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject private IP 172.16.0.1', async () => {
      const result = await validateIcsUrl('https://172.16.0.1/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject private IP 172.31.255.254', async () => {
      const result = await validateIcsUrl('https://172.31.255.254/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should accept public IP in 172.32.0.1 (outside private range)', async () => {
      const result = await validateIcsUrl('https://172.32.0.1/calendar.ics');

      expect(result.valid).toBe(true);
    });
  });

  describe('Localhost Blocking', () => {
    it('should reject localhost 127.0.0.1', async () => {
      const result = await validateIcsUrl('https://127.0.0.1/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject localhost hostname', async () => {
      const result = await validateIcsUrl('https://localhost/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('hostname is not allowed');
    });

    it('should reject IPv6 localhost ::1', async () => {
      const result = await validateIcsUrl('https://[::1]/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject IPv6 loopback variations', async () => {
      const result = await validateIcsUrl('https://[0:0:0:0:0:0:0:1]/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });
  });

  describe('Cloud Metadata Endpoint Blocking', () => {
    it('should reject AWS metadata endpoint 169.254.169.254', async () => {
      const result = await validateIcsUrl('https://169.254.169.254/latest/meta-data/');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject Azure metadata endpoint', async () => {
      const result = await validateIcsUrl('https://169.254.169.253/metadata/instance');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject GCP metadata endpoint', async () => {
      const result = await validateIcsUrl('https://metadata.google.internal/');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('hostname is not allowed');
    });

    it('should reject AWS IMDSv2 IPv6 endpoint', async () => {
      const result = await validateIcsUrl('https://[fd00:ec2::254]/latest/meta-data/');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });
  });

  describe('Invalid URL Formats', () => {
    it('should reject invalid URL format', async () => {
      const result = await validateIcsUrl('not-a-valid-url');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject file protocol', async () => {
      const result = await validateIcsUrl('file:///etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Only HTTP and HTTPS protocols are allowed');
    });

    it('should reject javascript protocol', async () => {
      const result = await validateIcsUrl('javascript:alert("xss")');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Only HTTP and HTTPS protocols are allowed');
    });

    it('should reject ftp protocol', async () => {
      const result = await validateIcsUrl('ftp://example.com/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Only HTTP and HTTPS protocols are allowed');
    });

    it('should reject data URLs', async () => {
      const result = await validateIcsUrl('data:text/plain,Hello');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Only HTTP and HTTPS protocols are allowed');
    });
  });

  describe('DNS Rebinding Protection', () => {
    it('should reject hostname that resolves to private IP', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['192.168.1.100']); // Private IP
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('https://evil.example.com/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject if any resolved IP is private', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34', '192.168.1.1']); // Mixed public and private
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('https://mixed.example.com/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject hostname that resolves to AWS metadata IP', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['169.254.169.254']);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('https://metadata.evil.com/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should handle DNS resolution failure', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('ENOTFOUND'), null);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('ENOTFOUND'), null);
      });

      const result = await validateIcsUrl('https://nonexistent.example.com/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unable to resolve hostname');
    });
  });

  describe('isPrivateIP Helper Function', () => {
    it('should identify IPv4 private ranges', async () => {
      expect(await isPrivateIP('10.0.0.0')).toBe(true);
      expect(await isPrivateIP('10.255.255.255')).toBe(true);
      expect(await isPrivateIP('172.16.0.0')).toBe(true);
      expect(await isPrivateIP('172.31.255.255')).toBe(true);
      expect(await isPrivateIP('192.168.0.0')).toBe(true);
      expect(await isPrivateIP('192.168.255.255')).toBe(true);
    });

    it('should identify loopback addresses', async () => {
      expect(await isPrivateIP('127.0.0.1')).toBe(true);
      expect(await isPrivateIP('127.255.255.255')).toBe(true);
    });

    it('should identify link-local addresses', async () => {
      expect(await isPrivateIP('169.254.1.1')).toBe(true);
      expect(await isPrivateIP('169.254.169.254')).toBe(true);
    });

    it('should identify IPv6 private ranges', async () => {
      expect(await isPrivateIP('::1')).toBe(true);
      expect(await isPrivateIP('fe80::1')).toBe(true);
      expect(await isPrivateIP('fc00::1')).toBe(true);
      expect(await isPrivateIP('fd00::1')).toBe(true);
    });

    it('should not flag public IPs as private', async () => {
      expect(await isPrivateIP('8.8.8.8')).toBe(false);
      expect(await isPrivateIP('1.1.1.1')).toBe(false);
      expect(await isPrivateIP('93.184.216.34')).toBe(false);
      expect(await isPrivateIP('172.32.0.1')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle URL with authentication', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34']);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('https://user:pass@example.com/calendar.ics');

      expect(result.valid).toBe(true);
    });

    it('should handle URL with fragment', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34']);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const result = await validateIcsUrl('https://example.com/calendar.ics#section');

      expect(result.valid).toBe(true);
    });

    it('should handle empty string', async () => {
      const result = await validateIcsUrl('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should handle very long URL', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34']);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      const longPath = 'a'.repeat(1000);
      const result = await validateIcsUrl(`https://example.com/${longPath}.ics`);

      expect(result.valid).toBe(true);
    });

    it('should handle internationalized domain names', async () => {
      (dns.resolve4 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(null, ['93.184.216.34']);
      });
      (dns.resolve6 as jest.MockedFunction<any>) = jest.fn((hostname, callback) => {
        callback(new Error('No IPv6'), null);
      });

      // Punycode encoded IDN
      const result = await validateIcsUrl('https://xn--n3h.com/calendar.ics');

      expect(result.valid).toBe(true);
    });
  });

  describe('Special IP Addresses', () => {
    it('should reject 0.0.0.0', async () => {
      const result = await validateIcsUrl('https://0.0.0.0/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });

    it('should reject broadcast address 255.255.255.255', async () => {
      const result = await validateIcsUrl('https://255.255.255.255/calendar.ics');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('private IP');
    });
  });
});
