/**
 * Unified Auth Service (Compatibility Shim)
 *
 * This file re-exports supabaseAuthService as unifiedAuthService
 * for backward compatibility after database optimization.
 *
 * All references to unifiedAuthService now use the consolidated
 * supabaseAuth.service.ts implementation.
 */

import { supabaseAuthService } from './supabaseAuth.service';

// Export as unifiedAuthService for backward compatibility
export const unifiedAuthService = supabaseAuthService;

// Re-export types
export type { AuthUser, AuthResult } from './supabaseAuth.service';
