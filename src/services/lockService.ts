import { Capacitor } from '@capacitor/core';

export interface LockSettings {
  enabled: boolean;
  type: 'biometric' | 'password' | 'pin';
  password?: string;
  pin?: string;
  biometricAvailable: boolean;
}

export class LockService {
  private settings: LockSettings = {
    enabled: false,
    type: 'password',
    biometricAvailable: false,
  };

  private readonly STORAGE_KEY = 'wargram_lock_settings';

  constructor() {
    this.loadSettings();
    this.checkBiometricAvailability();
  }

  // Load lock settings from storage
  private loadSettings() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading lock settings:', error);
    }
  }

  // Save lock settings to storage
  private saveSettings() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving lock settings:', error);
    }
  }

  // Check if biometric authentication is available
  private async checkBiometricAvailability(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      // For web, we'll simulate biometric with a simple check
      this.settings.biometricAvailable = 'credentials' in navigator && 'get' in navigator.credentials;
      return this.settings.biometricAvailable;
    }

    // For native platforms, check if biometric hardware is available
    try {
      // This would require a biometric plugin, for now we'll assume it's available
      this.settings.biometricAvailable = true;
      return true;
    } catch (error) {
      this.settings.biometricAvailable = false;
      return false;
    }
  }

  // Enable app lock
  async enableLock(type: 'biometric' | 'password' | 'pin', credential?: string): Promise<boolean> {
    if (type === 'biometric' && !this.settings.biometricAvailable) {
      throw new Error('Biometric authentication not available');
    }

    if ((type === 'password' || type === 'pin') && !credential) {
      throw new Error('Credential required for password/pin lock');
    }

    this.settings.enabled = true;
    this.settings.type = type;

    if (type === 'password') {
      this.settings.password = await this.hashCredential(credential!);
    } else if (type === 'pin') {
      this.settings.pin = credential;
    }

    this.saveSettings();
    return true;
  }

  // Disable app lock
  disableLock() {
    this.settings.enabled = false;
    this.settings.password = undefined;
    this.settings.pin = undefined;
    this.saveSettings();
  }

  // Authenticate user
  async authenticate(credential?: string): Promise<boolean> {
    if (!this.settings.enabled) {
      return true; // No lock enabled
    }

    switch (this.settings.type) {
      case 'biometric':
        return await this.authenticateBiometric();

      case 'password':
        if (!credential) return false;
        const hashedCredential = await this.hashCredential(credential);
        return hashedCredential === this.settings.password;

      case 'pin':
        return credential === this.settings.pin;

      default:
        return false;
    }
  }

  // Authenticate with biometric
  private async authenticateBiometric(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      // For web, use WebAuthn if available
      if ('credentials' in navigator && 'get' in navigator.credentials) {
        try {
          const credential = await navigator.credentials.get({
            publicKey: {
              challenge: new Uint8Array(32),
              rpId: window.location.hostname,
              userVerification: 'required',
            },
          });
          return !!credential;
        } catch (error) {
          console.error('Biometric authentication failed:', error);
          return false;
        }
      }
      return false;
    }

    // For native platforms, this would use a biometric plugin
    // For now, return true (would need actual biometric plugin implementation)
    return true;
  }

  // Hash credential for storage
  private async hashCredential(credential: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(credential);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Get current lock settings
  getSettings(): LockSettings {
    return { ...this.settings };
  }

  // Check if lock is required
  isLockRequired(): boolean {
    return this.settings.enabled;
  }

  // Check if biometric is available
  isBiometricAvailable(): boolean {
    return this.settings.biometricAvailable;
  }
}

export const lockService = new LockService();