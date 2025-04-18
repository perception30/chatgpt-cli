import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'child_process';
import axios from 'axios';

/**
 * Helper class for authentication-related functionality
 */
export class AuthHelper {
  private static readonly SESSION_DIR = path.join(os.homedir(), '.chatgpt-cli');
  private static readonly SESSION_FILE = path.join(AuthHelper.SESSION_DIR, 'session.json');
  private static readonly LOCAL_SESSION_FILE = 'session.json';
  private static readonly LOCAL_HEADERS_FILE = 'headers.json';

  /**
   * Loads session data from either the local directory or the home directory
   */
  public static loadSession() {
    try {
      // Try local directory first
      if (fs.existsSync(AuthHelper.LOCAL_SESSION_FILE)) {
        console.log('Loading session from current directory...');
        const data = fs.readFileSync(AuthHelper.LOCAL_SESSION_FILE, 'utf8');
        return JSON.parse(data);
      }
      
      // Fall back to home directory
      if (fs.existsSync(AuthHelper.SESSION_FILE)) {
        console.log('Loading session from home directory...');
        const data = fs.readFileSync(AuthHelper.SESSION_FILE, 'utf8');
        return JSON.parse(data);
      }
      
      console.error('No session file found in either current or home directory');
      return null;
    } catch (error) {
      console.error('Error loading session:', error);
      return null;
    }
  }

  /**
   * Loads custom headers from local file if available
   */
  public static loadHeaders() {
    try {
      if (fs.existsSync(AuthHelper.LOCAL_HEADERS_FILE)) {
        console.log('Loading headers from current directory...');
        const data = fs.readFileSync(AuthHelper.LOCAL_HEADERS_FILE, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Error loading headers:', error);
      return {};
    }
  }

  /**
   * Saves session data to both local and home directories
   */
  public static saveSession(sessionData: any) {
    try {
      // Ensure home directory exists
      if (!fs.existsSync(AuthHelper.SESSION_DIR)) {
        fs.mkdirSync(AuthHelper.SESSION_DIR, { recursive: true });
      }
      
      // Save to home directory
      fs.writeFileSync(
        AuthHelper.SESSION_FILE, 
        JSON.stringify(sessionData, null, 2)
      );
      
      // Save to local directory as well
      fs.writeFileSync(
        AuthHelper.LOCAL_SESSION_FILE, 
        JSON.stringify(sessionData, null, 2)
      );
      
      console.log('Session saved successfully to both locations');
      return true;
    } catch (error) {
      console.error('Error saving session:', error);
      return false;
    }
  }

  /**
   * Validates if the current session is valid
   */
  public static async validateSession(session: any): Promise<boolean> {
    if (!session) return false;
    
    // Check for essential cookies
    const hasSessionToken = session.cookies.some(
      (cookie: any) => cookie.name.startsWith('__Secure-next-auth.session-token')
    );
    
    const hasPuid = session.cookies.some(
      (cookie: any) => cookie.name === '_puid'
    );
    
    const hasCfClearance = session.cookies.some(
      (cookie: any) => cookie.name === 'cf_clearance'
    );
    
    console.log('Session check: Session found');
    console.log('Session token cookie:', hasSessionToken ? 'Found' : 'Missing');
    console.log('PUID cookie:', hasPuid ? 'Found' : 'Missing');
    console.log('CF clearance cookie:', hasCfClearance ? 'Found' : 'Missing');
    
    // Basic validation
    const isValid = hasSessionToken || (hasPuid && hasCfClearance);
    console.log('Session valid:', isValid);
    
    return isValid;
  }

  /**
   * Attempts to refresh the Cloudflare clearance cookie
   */
  public static async refreshCloudflareToken(): Promise<boolean> {
    try {
      console.log('Attempting to refresh Cloudflare token...');
      
      // This would typically involve browser automation
      // For now, we'll just notify the user
      console.log('Please run the login command to refresh your session');
      return false;
    } catch (error) {
      console.error('Error refreshing Cloudflare token:', error);
      return false;
    }
  }

  /**
   * Creates a filtered cookie string for API requests
   */
  public static createCookieString(session: any): string {
    if (!session || !session.cookies || !Array.isArray(session.cookies)) {
      return '';
    }
    
    // Essential cookies for authentication
    const essentialCookieNames = [
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.session-token.0',
      '__Secure-next-auth.session-token.1',
      '_puid',
      'cf_clearance',
      '__cf_bm',
      'oai-sc',
      '__Secure-next-auth.callback-url',
      '__Host-next-auth.csrf-token',
    ];
    
    // Important domains
    const relevantDomains = [
      'chat.openai.com',
      'chatgpt.com',
      'openai.com',
      'auth0.openai.com',
      'auth.openai.com',
    ];
    
    // Filter cookies
    const criticalCookies = session.cookies.filter(
      (cookie: any) => essentialCookieNames.includes(cookie.name)
    );
    
    let filteredCookies = [...criticalCookies];
    
    // Add domain-based cookies if we don't have too many already
    if (criticalCookies.length < 20) {
      const domainCookies = session.cookies.filter(
        (cookie: any) => 
          !essentialCookieNames.includes(cookie.name) && 
          relevantDomains.some((domain) => cookie.domain.includes(domain))
      );
      
      // Limit total cookies to avoid header size issues
      const remainingSlots = 30 - filteredCookies.length;
      if (remainingSlots > 0 && domainCookies.length > 0) {
        filteredCookies = [...filteredCookies, ...domainCookies.slice(0, remainingSlots)];
      }
    }
    
    // Convert to cookie string
    return filteredCookies
      .map((cookie: any) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }
}
