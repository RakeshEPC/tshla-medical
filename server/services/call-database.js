import { logError, logWarn, logInfo, logDebug } from '../../src/services/logger.service';
/**
 * TSHLA Medical Call Database Service
 * Stores all call records, conversations, and extracted patient data
 * Integrates with Azure MySQL for HIPAA-compliant storage
 */

const mysql = require('mysql2/promise');

class CallDatabaseService {
    constructor() {
        this.dbConfig = {
            host: process.env.AZURE_MYSQL_HOST || 'tshla-mysql-staging.mysql.database.azure.com',
            port: process.env.AZURE_MYSQL_PORT || 3306,
            database: process.env.AZURE_MYSQL_DATABASE || 'tshla_medical_staging',
            user: process.env.AZURE_MYSQL_USER || 'azureadmin',
            password: process.env.AZURE_MYSQL_PASSWORD || 'TshlaSecure2025!',
            ssl: {
                rejectUnauthorized: false
            },
            timezone: 'Z'
        };
        logInfo('call-database', '$1', $2);
    }

    /**
     * Get database connection
     */
    async getConnection() {
        try {
            return await mysql.createConnection(this.dbConfig);
        } catch (error) {
            logError('call-database', '$1', $2);
            throw error;
        }
    }

    /**
     * Store complete call record with conversation data
     */
    async storeCallRecord(callData) {
        const connection = await this.getConnection();
        
        try {
            await connection.beginTransaction();

            // 1. Store or update patient record
            const patientId = await this.storePatientRecord(connection, callData.extractedData);

            // 2. Store communication record
            const communicationId = await this.storeCommunicationRecord(connection, {
                ...callData,
                patientId
            });

            // 3. Store AI interactions
            await this.storeAIInteractions(connection, communicationId, callData.conversations);

            // 4. Create case/action items if needed
            await this.createActionItems(connection, communicationId, callData.extractedData);

            await connection.commit();
            logInfo('call-database', '$1', $2);

            return {
                success: true,
                patientId,
                communicationId,
                callSid: callData.callSid
            };

        } catch (error) {
            await connection.rollback();
            logError('call-database', '$1', $2);
            throw error;
        } finally {
            await connection.end();
        }
    }

    /**
     * Store or update patient record
     */
    async storePatientRecord(connection, extractedData) {
        try {
            // Check if patient exists by phone number
            const [existingPatients] = await connection.execute(
                'SELECT id FROM patients WHERE phone_number = ? LIMIT 1',
                [extractedData.phoneNumber]
            );

            if (existingPatients.length > 0) {
                // Update existing patient if we have new information
                const patientId = existingPatients[0].id;
                
                const updateFields = [];
                const updateValues = [];

                if (extractedData.firstName && extractedData.lastName) {
                    updateFields.push('first_name = ?', 'last_name = ?');
                    updateValues.push(extractedData.firstName, extractedData.lastName);
                }

                if (extractedData.dateOfBirth) {
                    updateFields.push('date_of_birth = ?');
                    updateValues.push(extractedData.dateOfBirth);
                }

                if (updateFields.length > 0) {
                    updateValues.push(patientId);
                    await connection.execute(
                        `UPDATE patients SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
                        updateValues
                    );
                    logDebug('call-database', '$1', $2);
                }

                return patientId;

            } else if (extractedData.name || extractedData.firstName) {
                // Create new patient record
                const patientId = this.generateUUID();
                
                await connection.execute(
                    `INSERT INTO patients (
                        id, phone_number, first_name, last_name, date_of_birth, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        patientId,
                        extractedData.phoneNumber,
                        extractedData.firstName || extractedData.name?.split(' ')[0] || null,
                        extractedData.lastName || (extractedData.name?.split(' ').slice(1).join(' ')) || null,
                        extractedData.dateOfBirth || null
                    ]
                );

                logDebug('call-database', '$1', $2);
                return patientId;
            }

            return null; // No patient information to store

        } catch (error) {
            logError('call-database', '$1', $2);
            throw error;
        }
    }

    /**
     * Store communication record (call details and transcript)
     */
    async storeCommunicationRecord(connection, callData) {
        try {
            const communicationId = this.generateUUID();

            // Prepare transcript from conversation messages
            const transcript = callData.conversations?.map(msg => 
                `${msg.role}: ${msg.content}`
            ).join('\n') || 'No transcript available';

            // Generate AI summary
            const aiSummary = this.generateCallSummary(callData);

            await connection.execute(
                `INSERT INTO communications (
                    id, call_sid, patient_id, type, direction, from_number, to_number,
                    status, duration_seconds, raw_transcript, ai_summary, 
                    confidence_score, needs_review, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    communicationId,
                    callData.callSid,
                    callData.patientId,
                    'voice',
                    'inbound',
                    callData.fromNumber,
                    callData.toNumber,
                    callData.status || 'completed',
                    Math.floor(callData.duration || 0),
                    transcript,
                    aiSummary,
                    callData.extractedData?.confidence || 0.8,
                    callData.extractedData?.isEmergency || false,
                ]
            );

            logDebug('call-database', '$1', $2);
            return communicationId;

        } catch (error) {
            logError('call-database', '$1', $2);
            throw error;
        }
    }

    /**
     * Store AI interactions for audit trail
     */
    async storeAIInteractions(connection, communicationId, conversations) {
        if (!conversations || conversations.length === 0) return;

        try {
            for (const message of conversations) {
                if (message.role === 'assistant') {
                    await connection.execute(
                        `INSERT INTO ai_interactions (
                            id, communication_id, agent_type, request, response,
                            tokens_used, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            this.generateUUID(),
                            communicationId,
                            'voice-assistant',
                            'Voice conversation', // Previous user message would be request
                            message.content,
                            message.content.length // Approximate token count
                        ]
                    );
                }
            }

            logDebug('call-database', '$1', $2).length} AI interactions`);

        } catch (error) {
            logError('call-database', '$1', $2);
            // Don't throw - this is not critical for call functionality
        }
    }

    /**
     * Create action items based on call content
     */
    async createActionItems(connection, communicationId, extractedData) {
        try {
            const actionItems = [];

            // Create appointment request if detected
            if (extractedData.appointmentType && extractedData.appointmentType !== 'message') {
                actionItems.push({
                    type: 'schedule_appointment',
                    title: `Schedule ${extractedData.appointmentType} appointment`,
                    description: `Patient ${extractedData.name || 'caller'} requested ${extractedData.appointmentType} appointment. Preferred provider: ${extractedData.preferredProvider || 'Not specified'}`,
                    priority: extractedData.urgencyLevel === 'emergency' ? 'high' : 'medium'
                });
            }

            // Create message follow-up if it's a message call
            if (extractedData.reasonForCall && !extractedData.appointmentType) {
                actionItems.push({
                    type: 'follow_up',
                    title: 'Follow up on patient message',
                    description: `Patient called regarding: ${extractedData.reasonForCall}`,
                    priority: extractedData.urgencyLevel === 'urgent' ? 'high' : 'medium'
                });
            }

            // Create emergency action if detected
            if (extractedData.isEmergency) {
                actionItems.push({
                    type: 'emergency_follow_up',
                    title: '🚨 Emergency call follow-up',
                    description: `EMERGENCY CALL: Patient instructed to call 911. Follow up required.`,
                    priority: 'high'
                });
            }

            // Store action items
            for (const item of actionItems) {
                await connection.execute(
                    `INSERT INTO action_items (
                        id, communication_log_id, action_type, action_title, 
                        action_description, priority, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        this.generateUUID(),
                        communicationId,
                        item.type,
                        item.title,
                        item.description,
                        item.priority,
                        'pending'
                    ]
                );
            }

            if (actionItems.length > 0) {
                logInfo('call-database', '$1', $2);
            }

        } catch (error) {
            logError('call-database', '$1', $2);
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
        const connection = await this.getConnection();
        
        try {
            // Ensure limit is an integer to avoid SQL parameter errors
            const limitInt = parseInt(limit) || 50;
            
            const [rows] = await connection.execute(`
                SELECT 
                    c.id, c.call_sid, c.from_number, c.to_number, c.status,
                    c.duration_seconds, c.ai_summary, c.needs_review, c.created_at,
                    p.first_name, p.last_name, p.phone as patient_phone
                FROM communications c
                LEFT JOIN patients p ON c.patient_id = p.id
                WHERE c.type = 'voice'
                ORDER BY c.created_at DESC
                LIMIT ${limitInt}
            `);

            return rows.map(row => ({
                id: row.id,
                callSid: row.call_sid,
                fromNumber: row.from_number,
                toNumber: row.to_number,
                status: row.status,
                duration: row.duration_seconds,
                summary: row.ai_summary,
                needsReview: row.needs_review,
                createdAt: row.created_at,
                patient: row.first_name ? {
                    name: `${row.first_name} ${row.last_name}`,
                    phone: row.patient_phone
                } : null
            }));

        } finally {
            await connection.end();
        }
    }

    /**
     * Get call details with transcript
     */
    async getCallDetails(callSid) {
        const connection = await this.getConnection();
        
        try {
            const [calls] = await connection.execute(`
                SELECT 
                    c.*, p.first_name, p.last_name, p.date_of_birth, p.phone_number as patient_phone
                FROM communications c
                LEFT JOIN patients p ON c.patient_id = p.id
                WHERE c.call_sid = ?
            `, [callSid]);

            if (calls.length === 0) {
                return null;
            }

            const call = calls[0];

            // Get AI interactions
            const [interactions] = await connection.execute(`
                SELECT * FROM ai_interactions 
                WHERE communication_id = ? 
                ORDER BY created_at ASC
            `, [call.id]);

            // Get action items
            const [actions] = await connection.execute(`
                SELECT * FROM action_items 
                WHERE communication_log_id = ? 
                ORDER BY created_at ASC
            `, [call.id]);

            return {
                ...call,
                patient: call.first_name ? {
                    name: `${call.first_name} ${call.last_name}`,
                    dateOfBirth: call.date_of_birth,
                    phone: call.patient_phone
                } : null,
                interactions: interactions,
                actionItems: actions
            };

        } finally {
            await connection.end();
        }
    }

    /**
     * Generate UUID for database records
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Test database connection
     */
    async testConnection() {
        try {
            const connection = await this.getConnection();
            await connection.execute('SELECT 1 as test');
            await connection.end();
            logInfo('call-database', '$1', $2);
            return true;
        } catch (error) {
            logError('call-database', '$1', $2);
            return false;
        }
    }
}

module.exports = new CallDatabaseService();