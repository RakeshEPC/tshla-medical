/**
 * Note Sharing API Endpoints
 * RESTful API for sharing medical notes with HIPAA compliance
 */

import { noteSharingService, ShareRequest, ShareableNote } from '../services/noteSharing.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

/**
 * API endpoint handlers that can be used with any backend framework
 * These are ready to be integrated with Express, Fastify, Next.js API routes, etc.
 */

export interface ApiRequest {
  method: string;
  headers: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  user?: { id: string; email: string; role: string };
}

export interface ApiResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

/**
 * POST /api/notes/share
 * Share a medical note with an external party
 */
export async function shareNoteEndpoint(req: ApiRequest): Promise<ApiResponse> {
  try {
    // Validate authentication
    if (!req.user) {
      return {
        status: 401,
        body: { error: 'Authentication required' },
      };
    }

    // Validate request body
    const { note, shareRequest } = req.body as {
      note: ShareableNote;
      shareRequest: ShareRequest;
    };

    if (!note || !shareRequest) {
      return {
        status: 400,
        body: { error: 'Missing note or share request data' },
      };
    }

    // Validate permissions
    if (note.createdBy !== req.user.id && req.user.role !== 'admin') {
      return {
        status: 403,
        body: { error: 'Not authorized to share this note' },
      };
    }

    // Process the share
    const shareRecord = await noteSharingService.shareNote(note, shareRequest);
    const shareLink = await noteSharingService.generateShareLink(shareRecord);

    return {
      status: 200,
      body: {
        success: true,
        shareRecord,
        shareLink,
        message: `Note shared successfully with ${shareRequest.recipientEmail}`,
      },
    };
  } catch (error) {
    logError('App', 'Error message', {});
    return {
      status: 500,
      body: { error: 'Failed to share note' },
    };
  }
}

/**
 * GET /api/notes/shared/:token
 * Retrieve a shared note by token
 */
export async function getSharedNoteEndpoint(req: ApiRequest): Promise<ApiResponse> {
  try {
    const token = req.params?.token;

    if (!token) {
      return {
        status: 400,
        body: { error: 'Share token required' },
      };
    }

    // Get IP for audit logging
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';

    // Retrieve the note
    const note = await noteSharingService.getSharedNote(token, ipAddress as string);

    if (!note) {
      return {
        status: 404,
        body: { error: 'Note not found or expired' },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        note,
        timestamp: new Date().toISOString(),
      },
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    };
  } catch (error) {
    logError('App', 'Error message', {});
    return {
      status: 500,
      body: { error: 'Failed to retrieve note' },
    };
  }
}

/**
 * DELETE /api/notes/shared/:token
 * Revoke a shared note
 */
export async function revokeShareEndpoint(req: ApiRequest): Promise<ApiResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        body: { error: 'Authentication required' },
      };
    }

    const token = req.params?.token;

    if (!token) {
      return {
        status: 400,
        body: { error: 'Share token required' },
      };
    }

    const success = await noteSharingService.revokeShare(token, req.user.id);

    if (!success) {
      return {
        status: 500,
        body: { error: 'Failed to revoke share' },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Share revoked successfully',
      },
    };
  } catch (error) {
    logError('App', 'Error message', {});
    return {
      status: 500,
      body: { error: 'Failed to revoke share' },
    };
  }
}

/**
 * GET /api/notes/shares
 * Get all shares for the authenticated user
 */
export async function getUserSharesEndpoint(req: ApiRequest): Promise<ApiResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        body: { error: 'Authentication required' },
      };
    }

    const shares = await noteSharingService.getUserShares(req.user.id);

    return {
      status: 200,
      body: {
        success: true,
        shares,
        count: shares.length,
      },
    };
  } catch (error) {
    logError('App', 'Error message', {});
    return {
      status: 500,
      body: { error: 'Failed to retrieve shares' },
    };
  }
}

/**
 * POST /api/notes/share/bulk
 * Share a note with multiple recipients
 */
export async function bulkShareEndpoint(req: ApiRequest): Promise<ApiResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        body: { error: 'Authentication required' },
      };
    }

    const { note, recipients } = req.body as {
      note: ShareableNote;
      recipients: Array<{
        email: string;
        name: string;
        type: ShareRequest['recipientType'];
      }>;
    };

    if (!note || !recipients || recipients.length === 0) {
      return {
        status: 400,
        body: { error: 'Missing note or recipients' },
      };
    }

    // Share with each recipient
    const results = await Promise.all(
      recipients.map(async recipient => {
        try {
          const shareRequest: ShareRequest = {
            noteId: note.id,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            recipientType: recipient.type,
            shareMethod: 'email',
            permissions: {
              canView: true,
              canDownload: false,
              canForward: false,
            },
          };

          const shareRecord = await noteSharingService.shareNote(note, shareRequest);
          return { success: true, recipient: recipient.email, shareRecord };
        } catch (error) {
          return { success: false, recipient: recipient.email, error: error.message };
        }
      })
    );

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      status: 200,
      body: {
        success: true,
        message: `Shared with ${successful.length} recipients`,
        successful,
        failed,
      },
    };
  } catch (error) {
    logError('App', 'Error message', {});
    return {
      status: 500,
      body: { error: 'Failed to share with multiple recipients' },
    };
  }
}

/**
 * Example Express.js integration:
 *
 * import express from 'express';
 * import { shareNoteEndpoint, getSharedNoteEndpoint } from './noteSharing.api';
 *
 * const app = express();
 *
 * app.post('/api/notes/share', async (req, res) => {
 *   const apiReq = {
 *     method: req.method,
 *     headers: req.headers,
 *     body: req.body,
 *     user: req.user // From auth middleware
 *   };
 *
 *   const response = await shareNoteEndpoint(apiReq);
 *   res.status(response.status).json(response.body);
 * });
 *
 * app.get('/api/notes/shared/:token', async (req, res) => {
 *   const apiReq = {
 *     method: req.method,
 *     headers: req.headers,
 *     params: req.params
 *   };
 *
 *   const response = await getSharedNoteEndpoint(apiReq);
 *   res.status(response.status).json(response.body);
 * });
 */

/**
 * Example Next.js API Route integration:
 *
 * // pages/api/notes/share.ts
 * import { shareNoteEndpoint } from '@/api/noteSharing.api';
 *
 * export default async function handler(req, res) {
 *   if (req.method !== 'POST') {
 *     return res.status(405).json({ error: 'Method not allowed' });
 *   }
 *
 *   const apiReq = {
 *     method: req.method,
 *     headers: req.headers,
 *     body: req.body,
 *     user: req.session?.user
 *   };
 *
 *   const response = await shareNoteEndpoint(apiReq);
 *   res.status(response.status).json(response.body);
 * }
 */
