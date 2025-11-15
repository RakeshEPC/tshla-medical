/**
 * Pre-Visit Call Linking Service
 * Links pre-visit call data to appointments by phone number
 * Supports both provider_schedules and appointments tables
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials for previsitLinking service');
}

const supabase = createClient(supabaseUrl, supabaseKey);

class PreVisitLinkingService {
  /**
   * Normalize phone number for matching
   */
  normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    return cleaned.length >= 10 ? `+${cleaned}` : null;
  }

  /**
   * Link a pre-visit call to appointments by phone number
   * @param {string} callId - Pre-visit call data ID
   * @param {string} phoneNumber - Patient phone number
   * @returns {Promise<Object>} - Linking result
   */
  async linkCallToAppointments(callId, phoneNumber) {
    try {
      console.log(`🔗 Linking pre-visit call ${callId} to appointments...`);

      const normalizedPhone = this.normalizePhone(phoneNumber);
      if (!normalizedPhone) {
        return {
          success: false,
          error: 'Invalid phone number',
          linkedAppointments: 0
        };
      }

      // Get the call data
      const { data: callData, error: callError } = await supabase
        .from('previsit_call_data')
        .select('*')
        .eq('id', callId)
        .single();

      if (callError || !callData) {
        return {
          success: false,
          error: 'Call data not found',
          linkedAppointments: 0
        };
      }

      // Find matching appointments in provider_schedules (within 30 days)
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Check provider_schedules
      const { data: scheduleMatches, error: scheduleError } = await supabase
        .from('provider_schedules')
        .select('*')
        .or(`patient_phone.eq.${normalizedPhone},patient_phone.eq.${phoneNumber}`)
        .gte('scheduled_date', today)
        .lte('scheduled_date', futureDateStr);

      if (scheduleError) {
        console.error('❌ Error querying provider_schedules:', scheduleError);
      }

      // Check appointments table
      const { data: appointmentMatches, error: appointmentError } = await supabase
        .from('appointments')
        .select('*')
        .or(`patient_phone.eq.${normalizedPhone},patient_phone.eq.${phoneNumber}`)
        .gte('appointment_date', today)
        .lte('appointment_date', futureDateStr);

      if (appointmentError) {
        console.error('❌ Error querying appointments:', appointmentError);
      }

      let linkedCount = 0;
      const linkedDetails = [];

      // Link to provider_schedules
      if (scheduleMatches && scheduleMatches.length > 0) {
        for (const schedule of scheduleMatches) {
          // Update provider_schedule with pre-visit call reference
          const { error: updateError } = await supabase
            .from('provider_schedules')
            .update({
              previsit_call_id: callId,
              previsit_data_captured: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', schedule.id);

          if (!updateError) {
            linkedCount++;
            linkedDetails.push({
              type: 'provider_schedule',
              id: schedule.id,
              date: schedule.scheduled_date,
              time: schedule.start_time,
              patient: schedule.patient_name
            });
          }
        }
      }

      // Link to appointments table
      if (appointmentMatches && appointmentMatches.length > 0) {
        for (const appointment of appointmentMatches) {
          const { error: updateError } = await supabase
            .from('previsit_call_data')
            .update({
              appointment_id: appointment.id,
              patient_profile_id: appointment.patient_profile_id
            })
            .eq('id', callId);

          if (!updateError) {
            linkedDetails.push({
              type: 'appointment',
              id: appointment.id,
              date: appointment.appointment_date,
              time: appointment.appointment_time,
              patient: appointment.patient_name
            });
          }
        }
      }

      console.log(`✅ Linked call ${callId} to ${linkedCount} appointment(s)`);

      return {
        success: true,
        linkedAppointments: linkedCount,
        details: linkedDetails,
        message: linkedCount > 0
          ? `Linked to ${linkedCount} appointment(s)`
          : 'No matching appointments found'
      };
    } catch (error) {
      console.error('❌ Error in linkCallToAppointments:', error);
      return {
        success: false,
        error: error.message,
        linkedAppointments: 0
      };
    }
  }

  /**
   * Get pre-visit data for a specific appointment
   * @param {string} appointmentId - Appointment ID from provider_schedules
   * @returns {Promise<Object>} - Pre-visit data
   */
  async getPreVisitDataForAppointment(appointmentId) {
    try {
      // Get appointment from provider_schedules
      const { data: schedule, error: scheduleError } = await supabase
        .from('provider_schedules')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (scheduleError || !schedule) {
        return {
          success: false,
          hasPreVisitData: false,
          data: null
        };
      }

      // If no previsit_call_id, try to find by phone
      let previsitCallId = schedule.previsit_call_id;

      if (!previsitCallId && schedule.patient_phone) {
        const normalizedPhone = this.normalizePhone(schedule.patient_phone);
        const { data: callData } = await supabase
          .from('previsit_call_data')
          .select('*')
          .eq('phone_number', normalizedPhone)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (callData) {
          previsitCallId = callData.id;

          // Update the schedule with this link
          await supabase
            .from('provider_schedules')
            .update({
              previsit_call_id: callData.id,
              previsit_data_captured: true
            })
            .eq('id', appointmentId);
        }
      }

      if (!previsitCallId) {
        return {
          success: true,
          hasPreVisitData: false,
          data: null
        };
      }

      // Get the pre-visit call data
      const { data: callData, error: callError } = await supabase
        .from('previsit_call_data')
        .select('*')
        .eq('id', previsitCallId)
        .single();

      if (callError || !callData) {
        return {
          success: true,
          hasPreVisitData: false,
          data: null
        };
      }

      return {
        success: true,
        hasPreVisitData: true,
        data: {
          id: callData.id,
          conversation_id: callData.conversation_id,
          phone_number: callData.phone_number,
          medications: callData.medications || [],
          concerns: callData.concerns || [],
          questions: callData.questions || [],
          urgency_flags: callData.urgency_flags || [],
          started_at: callData.started_at,
          completed_at: callData.completed_at,
          created_at: callData.created_at
        }
      };
    } catch (error) {
      console.error('❌ Error in getPreVisitDataForAppointment:', error);
      return {
        success: false,
        error: error.message,
        hasPreVisitData: false,
        data: null
      };
    }
  }

  /**
   * Get all appointments with pre-visit data for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Appointments with pre-visit data
   */
  async getAppointmentsWithPreVisitData(date) {
    try {
      const { data: schedules, error } = await supabase
        .from('provider_schedules')
        .select('*')
        .eq('scheduled_date', date)
        .eq('previsit_data_captured', true)
        .order('start_time', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        appointments: schedules || []
      };
    } catch (error) {
      console.error('❌ Error in getAppointmentsWithPreVisitData:', error);
      return {
        success: false,
        error: error.message,
        appointments: []
      };
    }
  }

  /**
   * Auto-link all recent pre-visit calls to appointments
   * @param {number} daysBack - How many days back to check
   * @returns {Promise<Object>} - Linking results
   */
  async linkRecentCalls(daysBack = 30) {
    try {
      console.log(`🔗 Auto-linking pre-visit calls from the last ${daysBack} days...`);

      // Get all recent pre-visit calls with phone numbers
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - daysBack);
      const pastDateStr = pastDate.toISOString();

      const { data: calls, error } = await supabase
        .from('previsit_call_data')
        .select('*')
        .not('phone_number', 'is', null)
        .gte('created_at', pastDateStr);

      if (error) throw error;

      let totalLinked = 0;
      const results = [];

      for (const call of calls || []) {
        const result = await this.linkCallToAppointments(call.id, call.phone_number);
        totalLinked += result.linkedAppointments;
        results.push({
          call_id: call.id,
          phone: call.phone_number,
          linked: result.linkedAppointments
        });
      }

      console.log(`✅ Bulk linking complete: ${totalLinked} total links created`);

      return {
        success: true,
        totalCalls: calls?.length || 0,
        totalLinked,
        results
      };
    } catch (error) {
      console.error('❌ Error in linkRecentCalls:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new PreVisitLinkingService();
