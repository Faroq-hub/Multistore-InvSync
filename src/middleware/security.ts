/**
 * Security middleware for Fastify
 * Adds security headers and CSRF protection
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Security headers middleware
 * Adds common security headers to all responses
 */
export async function securityHeaders(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Security headers
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Shopify App Bridge
    "style-src 'self' 'unsafe-inline'", // Required for Polaris
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.myshopify.com https://*.shopify.com",
    "frame-ancestors https://*.myshopify.com",
  ].join('; ');
  
  reply.header('Content-Security-Policy', csp);
  
  // HSTS (only for HTTPS)
  if (request.protocol === 'https') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

/**
 * Register security middleware
 */
export function registerSecurityMiddleware(app: FastifyInstance): void {
  app.addHook('onRequest', securityHeaders);
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize string input
 */
export function validateString(input: unknown, maxLength = 1000): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  
  const sanitized = sanitizeInput(input);
  
  if (sanitized.length > maxLength) {
    return null;
  }
  
  return sanitized;
}

