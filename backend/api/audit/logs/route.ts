import { NextRequest, NextResponse } from "next/server";
import { validateSession } from '../../auth/login/route';
import auditTrail, { AuditAction } from '@/lib/audit/auditTrail';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/audit/logs
 * Retrieve audit logs (admin only)
 */
export async function GET(req: NextRequest) {
  // Validate session
  const sessionId = req.cookies.get('tshla_session')?.value || req.headers.get('X-Session-Id');
  const session = validateSession(sessionId);
  
  if (!session.valid) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if user is admin (for now, check specific emails)
  const adminEmails = ['rakesh@tshla.ai', 'docparikh@gmail.com'];
  if (!adminEmails.includes(session.email || '')) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const patientId = searchParams.get('patientId');
    const actorId = searchParams.get('actorId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const verify = searchParams.get('verify') === 'true';

    // Verify chain integrity if requested
    if (verify) {
      const integrity = auditTrail.verifyChainIntegrity();
      if (!integrity.valid) {
        return NextResponse.json({
          error: 'Chain integrity compromised',
          brokenAt: integrity.brokenAt
        }, { status: 500 });
      }
    }

    let entries;
    
    // Get specific logs based on filters
    if (patientId) {
      entries = auditTrail.getPatientAuditLog(patientId, limit);
    } else if (actorId) {
      entries = auditTrail.getActorAuditLog(actorId, limit);
    } else if (action) {
      entries = auditTrail.searchAuditLog({ 
        action: action as AuditAction 
      }).slice(-limit);
    } else {
      entries = auditTrail.getRecentEntries(limit);
    }

    // Get suspicious activity
    const suspicious = auditTrail.detectSuspiciousActivity();

    return NextResponse.json({
      entries,
      suspicious: {
        failedLogins: suspicious.failedLogins.length,
        afterHoursAccess: suspicious.afterHoursAccess.length,
        unusualPatterns: suspicious.unusualPatterns.length
      },
      integrity: auditTrail.verifyChainIntegrity(),
      count: entries.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit/logs/report
 * Generate audit report
 */
export async function POST(req: NextRequest) {
  // Validate session
  const sessionId = req.cookies.get('tshla_session')?.value || req.headers.get('X-Session-Id');
  const session = validateSession(sessionId);
  
  if (!session.valid) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if user is admin
  const adminEmails = ['rakesh@tshla.ai', 'docparikh@gmail.com'];
  if (!adminEmails.includes(session.email || '')) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date required' },
        { status: 400 }
      );
    }

    const report = auditTrail.generateAuditReport(
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json({
      report,
      generated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating audit report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}