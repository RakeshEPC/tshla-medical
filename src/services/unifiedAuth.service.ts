/**
 * ⚠️ DEPRECATED - DO NOT USE IN NEW CODE
 *
 * This file exists only for backward compatibility.
 * Use `supabaseAuthService` directly instead.
 *
 * @deprecated Use import { supabaseAuthService } from './supabaseAuth.service'
 *
 * Migration: All imports have been updated to use supabaseAuthService directly.
 * This file will be removed in the next major cleanup.
 */

import { supabaseAuthService } from './supabaseAuth.service';

/**
 * @deprecated Use supabaseAuthService directly
 */
export const unifiedAuthService = supabaseAuthService;

// Re-export types
export type { AuthUser, AuthResult } from './supabaseAuth.service';
