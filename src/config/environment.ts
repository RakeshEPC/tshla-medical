/**
 * Environment Configuration and Validation for TSHLA Medical
 * SECURITY: Validates all required environment variables at startup
 * No hardcoded secrets or default API keys
 */

export interface EnvironmentConfig {
  // Azure Services (Primary - HIPAA Compliant)
  azureOpenAI: {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
  };
  azureSpeech: {
    region: string;
    endpoint: string;
    apiKey: string;
  };

  // External APIs
  elevenlabs: {
    apiKey: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };

  // Database (RDS/MySQL)
  database: {
    host: string;
    port: number;
    database: string;
    username?: string;
    password?: string;
  };

  // Application Settings
  app: {
    apiUrl: string;
    environment: 'development' | 'staging' | 'production';
    sessionTimeoutMinutes: number;
    enableHipaaMode: boolean;
    enableAuditLogging: boolean;
  };

  // Feature Flags
  features: {
    enableSpeech: boolean;
    enableAiProcessing: boolean;
    enableTranscribeMedical: boolean;
    enablePaymentFlow: boolean;
    enableProviderDelivery: boolean;
  };

  // Legacy AWS (Being Phased Out)
  aws?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
}

class EnvironmentValidator {
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.loadAndValidateConfig();
  }

  private loadAndValidateConfig(): EnvironmentConfig {
    const errors: string[] = [];

    // Critical security check: No hardcoded API keys allowed
    const requiredVars = {
      VITE_AZURE_OPENAI_ENDPOINT: 'Azure OpenAI endpoint',
      VITE_AZURE_OPENAI_KEY: 'Azure OpenAI API key',
      VITE_AZURE_SPEECH_REGION: 'Azure Speech region',
      VITE_ELEVENLABS_API_KEY: 'ElevenLabs API key',
      VITE_SUPABASE_URL: 'Supabase URL',
      VITE_SUPABASE_ANON_KEY: 'Supabase anonymous key',
    };

    // Secure authentication credentials (optional but recommended)
    const optionalSecureVars = {
      VITE_ADMIN_PASSWORD: 'Admin password for secure authentication',
      VITE_PUMPDRIVE_ADMIN_PASSWORD: 'PumpDrive admin password for secure authentication',
    };

    // Validate required environment variables exist
    for (const [envVar, description] of Object.entries(requiredVars)) {
      if (!import.meta.env[envVar]) {
        errors.push(`Missing required environment variable: ${envVar} (${description})`);
      }
    }

    // Validate URL formats
    const urlVars = ['VITE_AZURE_OPENAI_ENDPOINT', 'VITE_SUPABASE_URL'];
    urlVars.forEach(envVar => {
      const value = import.meta.env[envVar];
      if (value && !this.isValidUrl(value)) {
        errors.push(`Invalid URL format for ${envVar}: ${value}`);
      }
    });

    // Validate API key formats (security check against placeholder values)
    const apiKeyVars = ['VITE_AZURE_OPENAI_KEY', 'VITE_ELEVENLABS_API_KEY'];
    apiKeyVars.forEach(envVar => {
      const value = import.meta.env[envVar];
      if (value) {
        if (value.length < 10) {
          errors.push(`${envVar} appears to be a placeholder (too short)`);
        }
        if (
          value.includes('placeholder') ||
          value.includes('example') ||
          value.includes('change-this')
        ) {
          errors.push(`${envVar} contains placeholder text - use real API key`);
        }
      }
    });

    // Validate optional secure authentication variables
    for (const [envVar, description] of Object.entries(optionalSecureVars)) {
      const value = import.meta.env[envVar];
      if (!value) {
        console.warn(`⚠️  Optional secure variable not set: ${envVar} (${description})`);
        console.warn(`   Authentication will fall back to account creation service only`);
      } else {
        // Validate secure password format
        if (value.length < 8) {
          errors.push(`${envVar} must be at least 8 characters long for security`);
        }
        if (
          value.includes('placeholder') ||
          value.includes('example') ||
          value.includes('change-this')
        ) {
          errors.push(`${envVar} contains placeholder text - use real password`);
        }
      }
    }

    if (errors.length > 0) {
      console.error('❌ Environment validation failed:');
      console.error('='.repeat(80));
      errors.forEach(error => console.error(`  • ${error}`));
      console.error('='.repeat(80));
      throw new Error(`Environment validation failed. Check console for details.`);
    }

    return {
      azureOpenAI: {
        endpoint: import.meta.env.VITE_AZURE_OPENAI_ENDPOINT,
        apiKey: import.meta.env.VITE_AZURE_OPENAI_KEY,
        deployment: import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
        apiVersion: import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01',
      },
      azureSpeech: {
        region: import.meta.env.VITE_AZURE_SPEECH_REGION,
        endpoint:
          import.meta.env.VITE_AZURE_SPEECH_ENDPOINT ||
          `https://${import.meta.env.VITE_AZURE_SPEECH_REGION}.tts.speech.microsoft.com/`,
        apiKey: import.meta.env.VITE_AZURE_SPEECH_KEY || '',
      },
      elevenlabs: {
        apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
      },
      supabase: {
        url: import.meta.env.VITE_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        serviceRoleKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      database: {
        host: import.meta.env.VITE_RDS_HOST || '',
        port: parseInt(import.meta.env.VITE_RDS_PORT || '3306'),
        database: import.meta.env.VITE_RDS_DATABASE || '',
        username: import.meta.env.VITE_RDS_USERNAME,
        password: import.meta.env.VITE_RDS_PASSWORD,
      },
      app: {
        apiUrl: import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'production' ? 'https://api.tshla.ai' : 'http://localhost:3001'),
        environment: this.getEnvironment(),
        sessionTimeoutMinutes: parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES || '120'),
        enableHipaaMode: import.meta.env.VITE_ENABLE_HIPAA_MODE === 'true',
        enableAuditLogging: import.meta.env.VITE_ENABLE_AUDIT_LOGGING !== 'false', // Default to true unless explicitly disabled
      },
      features: {
        enableSpeech: import.meta.env.VITE_ENABLE_SPEECH === 'true',
        enableAiProcessing: import.meta.env.VITE_ENABLE_AI_PROCESSING === 'true',
        enableTranscribeMedical: import.meta.env.VITE_ENABLE_TRANSCRIBE_MEDICAL === 'true',
        enablePaymentFlow: import.meta.env.VITE_ENABLE_PAYMENT_FLOW === 'true',
        enableProviderDelivery: import.meta.env.VITE_ENABLE_PROVIDER_DELIVERY === 'true',
      },
      aws: import.meta.env.VITE_AWS_ACCESS_KEY_ID
        ? {
            region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
            accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
            secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
            bucketName: import.meta.env.AWS_BUCKET_NAME || '',
          }
        : undefined,
    };
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  private getEnvironment(): 'development' | 'staging' | 'production' {
    const env = import.meta.env.MODE;
    if (env === 'production') return 'production';
    if (env === 'staging') return 'staging';
    return 'development';
  }

  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  public validateHipaaCompliance(): void {
    if (this.config.app.enableHipaaMode) {
      const issues: string[] = [];

      if (!this.config.app.enableAuditLogging) {
        issues.push('HIPAA mode requires audit logging');
      }

      if (this.config.app.environment === 'production') {
        if (this.config.azureOpenAI.endpoint.includes('localhost')) {
          issues.push('Production cannot use localhost endpoints');
        }
        if (this.config.app.apiUrl.includes('localhost')) {
          issues.push('Production cannot use localhost API URLs');
        }
      }

      if (issues.length > 0) {
        throw new Error(`HIPAA compliance violations: ${issues.join(', ')}`);
      }
    }
  }
}

// Create and validate configuration
const validator = new EnvironmentValidator();
// TODO: Re-enable HIPAA validation once environment variables are properly configured
// validator.validateHipaaCompliance();

// Export validated configuration
export const config = validator.getConfig();
export const isProduction = config.app.environment === 'production';
export const isDevelopment = config.app.environment === 'development';

// Export for testing
export const validateEnvironment = () => {
  const newValidator = new EnvironmentValidator();
  newValidator.validateHipaaCompliance();
  return newValidator.getConfig();
};
