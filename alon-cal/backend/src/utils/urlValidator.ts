/**
 * URL Validator with SSRF Protection
 *
 * Provides comprehensive SSRF (Server-Side Request Forgery) protection for ICS URLs.
 * Prevents access to private IP ranges, localhost, and cloud metadata endpoints.
 *
 * Security Features:
 * - HTTPS-only in production (HTTP allowed in development)
 * - Blacklists private IP ranges (RFC 1918)
 * - Blacklists localhost and loopback addresses
 * - Blacklists AWS/cloud metadata endpoints
 * - DNS rebinding protection via DNS resolution
 * - Redirect following with validation (max 3 redirects)
 *
 * Environment Variables:
 * - ICS_ALLOW_HTTP: Allow HTTP URLs in development (default: false)
 */

import dns from 'dns';
import { promisify } from 'util';
import axios, { AxiosResponse } from 'axios';
import logger from './logger';

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

// Private IP ranges (RFC 1918, RFC 4193, localhost, link-local)
const PRIVATE_IP_RANGES = [
  /^10\./,                        // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,                   // 192.168.0.0/16
  /^127\./,                        // 127.0.0.0/8 (loopback)
  /^169\.254\./,                   // 169.254.0.0/16 (link-local)
  /^0\.0\.0\.0$/,                  // 0.0.0.0
  /^255\.255\.255\.255$/,          // 255.255.255.255
  // IPv6
  /^::1$/,                         // ::1 (localhost)
  /^fe80:/i,                       // fe80::/10 (link-local)
  /^fc00:/i,                       // fc00::/7 (unique local)
  /^fd00:/i,                       // fd00::/8 (unique local)
  /^::ffff:127\./i,                // IPv4-mapped IPv6 localhost
  /^::ffff:10\./i,                 // IPv4-mapped IPv6 private
  /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./i, // IPv4-mapped IPv6 private
  /^::ffff:192\.168\./i,           // IPv4-mapped IPv6 private
];

// Cloud metadata endpoints
const METADATA_ENDPOINTS = [
  '169.254.169.254',               // AWS, Azure, GCP metadata
  'fd00:ec2::254',                 // AWS IMDSv2 IPv6
  'metadata.google.internal',      // GCP metadata
  '169.254.169.253',               // Azure IMDS fallback
];

// Common hostnames to block
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  '0.0.0.0',
];

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an ICS URL for SSRF protection
 *
 * @param url - URL to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * const result = await validateIcsUrl('https://example.com/calendar.ics');
 * if (!result.valid) {
 *   throw new Error(result.error);
 * }
 */
export async function validateIcsUrl(url: string): Promise<ValidationResult> {
  try {
    // Parse URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }

    // Check protocol (HTTPS only in production)
    const allowHttp = process.env.ICS_ALLOW_HTTP === 'true' || process.env.NODE_ENV === 'development';
    if (parsedUrl.protocol === 'http:' && !allowHttp) {
      return {
        valid: false,
        error: 'Only HTTPS URLs are allowed in production',
      };
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Only HTTP and HTTPS protocols are allowed',
      };
    }

    // Check for blocked hostnames
    const hostname = parsedUrl.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      logger.warn('Blocked hostname in ICS URL', { hostname, url });
      return {
        valid: false,
        error: 'Access to this hostname is not allowed',
      };
    }

    // Check for metadata endpoints
    if (METADATA_ENDPOINTS.includes(hostname)) {
      logger.warn('Attempted access to metadata endpoint', { hostname, url });
      return {
        valid: false,
        error: 'Access to cloud metadata endpoints is not allowed',
      };
    }

    // Check if hostname is an IP address
    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');

    if (isIpAddress) {
      // Direct IP address - check if it's private
      const isPrivate = await isPrivateIP(hostname);
      if (isPrivate) {
        logger.warn('Blocked private IP in ICS URL', { ip: hostname, url });
        return {
          valid: false,
          error: 'Access to private IP addresses is not allowed',
        };
      }
    } else {
      // Hostname - resolve DNS and check all IPs
      const ips = await resolveDNS(hostname);

      if (ips.length === 0) {
        return {
          valid: false,
          error: 'Unable to resolve hostname',
        };
      }

      // Check all resolved IPs
      for (const ip of ips) {
        const isPrivate = await isPrivateIP(ip);
        if (isPrivate) {
          logger.warn('DNS resolved to private IP', { hostname, ip, url });
          return {
            valid: false,
            error: 'Hostname resolves to a private IP address',
          };
        }
      }
    }

    // Validate redirects (if any)
    // This will be done during actual fetch in ICS client
    // Here we just validate the initial URL

    logger.debug('ICS URL validation passed', { url });

    return {
      valid: true,
    };
  } catch (error) {
    logger.error('URL validation error', { url, error });
    return {
      valid: false,
      error: `URL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if an IP address is private/local
 *
 * @param ip - IP address (v4 or v6)
 * @returns true if IP is private/local
 *
 * @example
 * await isPrivateIP('192.168.1.1'); // true
 * await isPrivateIP('8.8.8.8'); // false
 */
export async function isPrivateIP(ip: string): Promise<boolean> {
  // Check against all private IP ranges
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(ip)) {
      return true;
    }
  }

  // Check metadata endpoints
  if (METADATA_ENDPOINTS.includes(ip)) {
    return true;
  }

  return false;
}

/**
 * Resolve DNS for a hostname
 *
 * @param hostname - Hostname to resolve
 * @returns Array of resolved IP addresses
 */
async function resolveDNS(hostname: string): Promise<string[]> {
  const ips: string[] = [];

  try {
    // Resolve IPv4
    const ipv4Addresses = await dnsResolve4(hostname);
    ips.push(...ipv4Addresses);
  } catch (error) {
    // IPv4 resolution failed, might be IPv6 only
    logger.debug('IPv4 DNS resolution failed', { hostname, error });
  }

  try {
    // Resolve IPv6
    const ipv6Addresses = await dnsResolve6(hostname);
    ips.push(...ipv6Addresses);
  } catch (error) {
    // IPv6 resolution failed, might be IPv4 only
    logger.debug('IPv6 DNS resolution failed', { hostname, error });
  }

  return ips;
}

/**
 * Validate URL after redirect
 *
 * Used by ICS client to validate each redirect in the chain
 *
 * @param url - Redirected URL
 * @returns Validation result
 */
export async function validateRedirectUrl(url: string): Promise<ValidationResult> {
  // Same validation as initial URL
  return validateIcsUrl(url);
}

/**
 * Create axios instance with SSRF protection
 *
 * @param maxRedirects - Maximum number of redirects (default: 3)
 * @returns Axios instance configured with SSRF protection
 */
export function createSafeAxiosInstance(maxRedirects: number = 3) {
  return axios.create({
    maxRedirects,
    timeout: parseInt(process.env.ICS_FETCH_TIMEOUT_MS || '10000', 10),
    validateStatus: (status) => status >= 200 && status < 400,
    beforeRedirect: async (options: any, responseDetails: any) => {
      // Validate redirect URL
      const redirectUrl = responseDetails.headers.location;
      if (redirectUrl) {
        const validation = await validateRedirectUrl(redirectUrl);
        if (!validation.valid) {
          throw new Error(`Redirect validation failed: ${validation.error}`);
        }
      }
    },
  });
}

/**
 * Test URL validator with a sample URL
 *
 * For testing/debugging purposes
 *
 * @param url - URL to test
 * @returns Validation result
 */
export async function testUrlValidator(url: string): Promise<ValidationResult> {
  logger.info('Testing URL validator', { url });
  const result = await validateIcsUrl(url);
  logger.info('Validation result', { url, result });
  return result;
}
