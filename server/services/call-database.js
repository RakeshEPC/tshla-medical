import { logError, logWarn, logInfo, logDebug } from '../../src/services/logger.service';
/**
 * TSHLA Medical Call Database Service
 * Stores all call records, conversations, and extracted patient data
 * Migrated to Supabase (PostgreSQL) - October 2025
 */

const unifiedSupabase = require('./unified-supabase.service');

class CallDatabaseService {
    constructor() {
        logInfo('call-database', 'Initializing Call Database Service with Supabase');
    }

    /**
     * Initialize Supabase connection
     */
    async initialize() {
        try {
            await unifiedSupabase.initialize();
            logInfo('call-database', 'Supabase connection initialized');
            return true;
        } catch (error) {
            logError('call-database', 'Failed to initialize Supabase', error);
            throw error;
        }
    }

    /**
     * Store complete call record with conversation data
     */
    async storeCallRecord(callData) {
        try {
            await this.initialize();

            // Supabase doesn't support client-side transactions, so we'll do our best effort
            // For critical data integrity, consider creating a PostgreSQL function

            // 1. Store or update patient record
            const patientId = await this.storePatientRecord(callData.extractedData);

            // 2. Store communication record
            const communicationId = await this.storeCommunicationRecord({
                ...callData,
                patientId
            });

            // 3. Store AI interactions
            await this.storeAIInteractions(communicationId, callData.conversations);

            // 4. Create case/action items if needed
            await this.createActionItems(communicationId, callData.extractedData);

            logInfo('call-database', `Call record stored: ${callData.callSid}`);

            return {
                success: true,
                patientId,
                communicationId,
                callSid: callData.callSid
            };

        } catch (error) {
            logError('call-database', 'Failed to store call record', error);
            throw error;
        }
    }

    /**
     * Store or update patient record
     */
    async storePatientRecord(extractedData) {
        try {
            // Check if patient exists by phone number
            const { data: existingPatients, error: searchError } = await unifiedSupabase
                .from('patients')
                .select('id')
                .eq('phone_number', extractedData.phoneNumber)
                .limit(1);

            if (searchError) throw searchError;

            if (existingPatients && existingPatients.length > 0) {
                // Update existing patient if we have new information
                const patientId = existingPatients[0].id;

                const updateData = { updated_at: new Date().toISOString() };

                if (extractedData.firstName && extractedData.lastName) {
                    updateData.first_name = extractedData.firstName;
                    updateData.last_name = extractedData.lastName;
                }

                if (extractedData.dateOfBirth) {
                    updateData.date_of_birth = extractedData.dateOfBirth;
                }

                if (Object.keys(updateData).length > 1) { // More than just updated_at
                    await unifiedSupabase.update('patients', updateData, { id: patientId });
                    logDebug('call-database', `Updated patient: ${patientId}`);
                }

                return patientId;

            } else if (extractedData.name || extractedData.firstName) {
                // Create new patient record
                const patientData = {
                    phone_number: extractedData.phoneNumber,
                    first_name: extractedData.firstName || extractedData.name?.split(' ')[0] || null,
                    last_name: extractedData.lastName || (extractedData.name?.split(' ').slice(1).join(' ')) || null,
                    date_of_birth: extractedData.dateOfBirth || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { data: newPatient, error: insertError } = await unifiedSupabase
                    .from('patients')
                    .insert(patientData)
                    .select()
                    .single();

                if (insertError) throw insertError;

                logDebug('call-database', `Created new patient: ${newPatient.id}`);
                return newPatient.id;
            }

            return null; // No patient information to store

        } catch (error) {
            logError('call-database', 'Failed to store patient record', error);
            throw error;
        }
    }

    /**
     * Store communication record (call details and transcript)
     */
    async storeCommunicationRecord(callData) {
        try {
            // Prepare transcript from conversation messages
            const transcript = callData.conversations?.map(msg =>
                `${msg.role}: ${msg.content}`
            ).join('\n') || 'No transcript available';

            // Generate AI summary
            const aiSummary = this.generateCallSummary(callData);

            const commData = {
                call_sid: callData.callSid,
                patient_id: callData.patientId,
                type: 'voice',
                direction: 'inbound',
                from_number: callData.fromNumber,
                to_number: callData.toNumber,
                status: callData.status || 'completed',
                duration_seconds: Math.floor(callData.duration || 0),
                raw_transcript: transcript,
                ai_summary: aiSummary,
                confidence_score: callData.extractedData?.confidence || 0.8,
                needs_review: callData.extractedData?.isEmergency || false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: newComm, error } = await unifiedSupabase
                .from('communications')
                .insert(commData)
                .select()
                .single();

            if (error) throw error;

            logDebug('call-database', `Created communication record: ${newComm.id}`);
            return newComm.id;

        } catch (error) {
            logError('call-database', 'Failed to store communication record', error);
            throw error;
        }
    }

    /**
     * Store AI interactions for audit trail
     */
    async storeAIInteractions(communicationId, conversations) {
        if (!conversations || conversations.length === 0) return;

        try {
            const interactions = [];
            for (const message of conversations) {
                if (message.role === 'assistant') {
                    interactions.push({
                        communication_id: communicationId,
                        agent_type: 'voice-assistant',
                        request: 'Voice conversation', // Previous user message would be request
                        response: message.content,
                        tokens_used: message.content.length, // Approximate token count
                        created_at: new Date().toISOString()
                    });
                }
            }

            if (interactions.length > 0) {
                await unifiedSupabase.insert('ai_interactions', interactions);
                logDebug('call-database', `Stored ${interactions.length} AI interactions`);
            }

        } catch (error) {
            logError('call-database', 'Failed to store AI interactions', error);
            // Don't throw - this is not critical for call functionality
        }
    }

    /**
     * Create action items based on call content
     */
    async createActionItems(communicationId, extractedData) {
        try {
            const actionItems = [];

            // Create appointment request if detected
            if (extractedData.appointmentType && extractedData.appointmentType !== 'message') {
                actionItems.push({
                    communication_log_id: communicationId,
                    action_type: 'schedule_appointment',
                    action_title: `Schedule ${extractedData.appointmentType} appointment`,
                    action_description: `Patient ${extractedData.name || 'caller'} requested ${extractedData.appointmentType} appointment. Preferred provider: ${extractedData.preferredProvider || 'Not specified'}`,
                    priority: extractedData.urgencyLevel === 'emergency' ? 'high' : 'medium',
                    status: 'pending',
                    created_at: new Date().toISOString()
                });
            }

            // Create message follow-up if it's a message call
            if (extractedData.reasonForCall && !extractedData.appointmentType) {
                actionItems.push({
                    communication_log_id: communicationId,
                    action_type: 'follow_up',
                    action_title: 'Follow up on patient message',
                    action_description: `Patient called regarding: ${extractedData.reasonForCall}`,
                    priority: extractedData.urgencyLevel === 'urgent' ? 'high' : 'medium',
                    status: 'pending',
                    created_at: new Date().toISOString()
                });
            }

            // Create emergency action if detected
            if (extractedData.isEmergency) {
                actionItems.push({
                    communication_log_id: communicationId,
                    action_type: 'emergency_follow_up',
                    action_title: '🚨 Emergency call follow-up',
                    action_description: `EMERGENCY CALL: Patient instructed to call 911. Follow up required.`,
                    priority: 'high',
                    status: 'pending',
                    created_at: new Date().toISOString()
                });
            }

            // Store action items
            if (actionItems.length > 0) {
                await unifiedSupabase.insert('action_items', actionItems);
                logInfo('call-database', `Created ${actionItems.length} action items`);
            }

        } catch (error) {
            logError('call-database', 'Failed to create action items', error);
            // Don't throw - this is not critical for call functionality
        }
    }

    /**
     * Generate call summary
     */
    generateCallSummary(callData) {
        const data = callData.extractedData;
        let summary = `Phone call received. `;

        if (data.name) summary += `Patient: ${data.name}. `;
        if (data.reasonForCall) summary += `Reason: ${data.reasonForCall}. `;
        if (data.appointmentType) summary += `Requested: ${data.appointmentType}. `;
        if (data.preferredProvider) summary += `Provider: ${data.preferredProvider}. `;
        if (data.isEmergency) summary += `⚠️ EMERGENCY - instructed to call 911. `;

        summary += `Language: ${data.language || 'English'}.`;

        return summary;
    }

    /**
     * Get recent calls for dashboard
     */
    async getRecentCalls(limit = 50) {
        try {
            await this.initialize();

            const limitInt = parseInt(limit) || 50;

            const { data, error } = await unifiedSupabase.getClient()
                .from('communications')
                .select(`
                    id, call_sid, from_number, to_number, status,
                    duration_seconds, ai_summary, needs_review, created_at,
                    patients!patient_id (
                        first_name,
                        last_name,
                        phone_number
                    )
                `)
                .eq('type', 'voice')
                .order('created_at', { ascending: false })
                .limit(limitInt);

            if (error) throw error;

            return data.map(row => ({
                id: row.id,
                callSid: row.call_sid,
                fromNumber: row.from_number,
                toNumber: row.to_number,
                status: row.status,
                duration: row.duration_seconds,
                summary: row.ai_summary,
                needsReview: row.needs_review,
                createdAt: row.created_at,
                patient: row.patients ? {
                    name: `${row.patients.first_name} ${row.patients.last_name}`,
                    phone: row.patients.phone_number
                } : null
            }));

        } catch (error) {
            logError('call-database', 'Failed to get recent calls', error);
            throw error;
        }
    }

    /**
     * Get call details with transcript
     */
    async getCallDetails(callSid) {
        try {
            await this.initialize();

            // Get call with patient info
            const { data: calls, error: callError } = await unifiedSupabase.getClient()
                .from('communications')
                .select(`
                    *,
                    patients!patient_id (
                        first_name,
                        last_name,
                        date_of_birth,
                        phone_number
                    )
                `)
                .eq('call_sid', callSid)
                .single();

            if (callError) throw callError;
            if (!calls) return null;

            // Get AI interactions
            const { data: interactions, error: interactionsError } = await unifiedSupabase
                .from('ai_interactions')
                .select('*')
                .eq('communication_id', calls.id)
                .order('created_at', { ascending: true });

            if (interactionsError) throw interactionsError;

            // Get action items
            const { data: actions, error: actionsError } = await unifiedSupabase
                .from('action_items')
                .select('*')
                .eq('communication_log_id', calls.id)
                .order('created_at', { ascending: true });

            if (actionsError) throw actionsError;

            return {
                ...calls,
                patient: calls.patients ? {
                    name: `${calls.patients.first_name} ${calls.patients.last_name}`,
                    dateOfBirth: calls.patients.date_of_birth,
                    phone: calls.patients.phone_number
                } : null,
                interactions: interactions || [],
                actionItems: actions || []
            };

        } catch (error) {
            logError('call-database', 'Failed to get call details', error);
            throw error;
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        try {
            await this.initialize();
            const { error } = await unifiedSupabase.getClient()
                .from('communications')
                .select('id')
                .limit(1);

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is fine
                throw error;
            }

            logInfo('call-database', 'Database connection test successful');
            return true;
        } catch (error) {
            logError('call-database', 'Database connection test failed', error);
            return false;
        }
    }
}

module.exports = new CallDatabaseService();
