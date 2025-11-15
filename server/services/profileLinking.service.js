/**
 * Profile Linking Service
 * Automatically links patient profiles to appointments based on phone/MRN matching
 * Supports manual linking and bulk operations
 * Created: January 2025
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials for profileLinking service');
}

const supabase = createClient(supabaseUrl, supabaseKey);

class ProfileLinkingService {
  /**
   * Normalize phone number to E.164 format for consistent matching
   * @param {string} phone - Raw phone number
   * @returns {string|null} - Normalized phone or null
   */
  normalizePhone(phone) {
    if (!phone) return null;

    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Handle various formats
    if (cleaned.length === 10) {
      // US number without country code: 7134649100 -> +17134649100
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      // US number with country code: 17134649100 -> +17134649100
      return `+${cleaned}`;
    } else if (cleaned.startsWith('+')) {
      return cleaned;
    }

    return cleaned.length >= 10 ? `+${cleaned}` : null;
  }

  /**
   * Auto-link a patient profile to matching appointments
   * @param {string} profileId - UUID of patient profile
   * @param {number} searchDaysAhead - How many days ahead to search (default 30)
   * @returns {Promise<Object>} - Linking results
   */
  async linkProfileToAppointments(profileId, searchDaysAhead = 30) {
    try {
      console.log(`🔗 Auto-linking profile ${profileId} (searching ${searchDaysAhead} days ahead)...`);

      // Call the PostgreSQL function
      const { data, error } = await supabase.rpc('link_profile_to_appointments', {
        p_profile_id: profileId,
        p_search_days_ahead: searchDaysAhead
      });

      if (error) {
        console.error('❌ Error calling link_profile_to_appointments:', error);
        throw error;
      }

      const linkedCount = data?.filter(row => row.link_created).length || 0;

      console.log(`✅ Linked profile ${profileId} to ${linkedCount} appointment(s)`);

      return {
        success: true,
        profileId,
        linkedAppointments: linkedCount,
        details: data || [],
        message: linkedCount > 0
          ? `Successfully linked to ${linkedCount} appointment(s)`
          : 'No matching appointments found'
      };
    } catch (error) {
      console.error('❌ Error in linkProfileToAppointments:', error);
      return {
        success: false,
        error: error.message,
        profileId
      };
    }
  }

  /**
   * Bulk auto-link all patient profiles
   * @param {number} searchDaysAhead - How many days ahead to search
   * @returns {Promise<Object>} - Bulk linking results
   */
  async linkAllProfiles(searchDaysAhead = 30) {
    try {
      console.log(`🔗 Bulk auto-linking all profiles (searching ${searchDaysAhead} days ahead)...`);

      const { data, error } = await supabase.rpc('link_all_profiles', {
        p_search_days_ahead: searchDaysAhead
      });

      if (error) {
        console.error('❌ Error calling link_all_profiles:', error);
        throw error;
      }

      const totalProfiles = data?.length || 0;
      const linkedProfiles = data?.filter(row => row.status === 'linked').length || 0;
      const totalAppointments = data?.reduce((sum, row) => sum + row.appointments_linked, 0) || 0;

      console.log(`✅ Bulk linking complete: ${linkedProfiles}/${totalProfiles} profiles linked to ${totalAppointments} appointments`);

      return {
        success: true,
        totalProfiles,
        linkedProfiles,
        unlinkedProfiles: totalProfiles - linkedProfiles,
        totalAppointments,
        details: data || []
      };
    } catch (error) {
      console.error('❌ Error in linkAllProfiles:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manual link: Associate a specific profile with a specific appointment
   * @param {string} profileId - Patient profile UUID
   * @param {string} appointmentId - Appointment UUID
   * @param {string} userId - ID of user creating the link
   * @returns {Promise<Object>} - Link result
   */
  async manualLink(profileId, appointmentId, userId = 'manual') {
    try {
      console.log(`🔗 Manual linking profile ${profileId} to appointment ${appointmentId}...`);

      // Update the appointment record
      const { data: appointment, error: updateError } = await supabase
        .from('appointments')
        .update({
          patient_profile_id: profileId,
          link_method: 'manual',
          linked_at: new Date().toISOString(),
          linked_by: userId
        })
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating appointment:', updateError);
        throw updateError;
      }

      // Create audit record
      const { error: auditError } = await supabase
        .from('profile_appointment_links')
        .insert({
          patient_profile_id: profileId,
          appointment_id: appointmentId,
          link_method: 'manual',
          link_confidence: 1.0,
          matched_on: 'manual_selection',
          linked_by: userId
        });

      if (auditError) {
        console.warn('⚠️ Failed to create audit record:', auditError);
        // Don't fail the whole operation
      }

      // Update profile metadata
      const { data: profile } = await supabase
        .from('patient_profiles')
        .select('linked_appointments_count')
        .eq('id', profileId)
        .single();

      await supabase
        .from('patient_profiles')
        .update({
          last_linked_at: new Date().toISOString(),
          linked_appointments_count: (profile?.linked_appointments_count || 0) + 1,
          needs_manual_linking: false
        })
        .eq('id', profileId);

      console.log(`✅ Manual link created successfully`);

      return {
        success: true,
        profileId,
        appointmentId,
        appointment
      };
    } catch (error) {
      console.error('❌ Error in manualLink:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unlink a profile from an appointment
   * @param {string} appointmentId - Appointment UUID
   * @param {string} userId - ID of user removing the link
   * @param {string} reason - Reason for unlinking
   * @returns {Promise<Object>} - Unlink result
   */
  async unlinkAppointment(appointmentId, userId = 'system', reason = null) {
    try {
      console.log(`🔓 Unlinking appointment ${appointmentId}...`);

      // Get current link info
      const { data: appointment } = await supabase
        .from('appointments')
        .select('patient_profile_id')
        .eq('id', appointmentId)
        .single();

      if (!appointment?.patient_profile_id) {
        return {
          success: false,
          error: 'Appointment is not linked to a profile'
        };
      }

      // Update appointment
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          patient_profile_id: null,
          link_method: null,
          linked_at: null,
          linked_by: null
        })
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      // Mark audit records as inactive
      const { error: auditError } = await supabase
        .from('profile_appointment_links')
        .update({
          is_active: false,
          unlinked_at: new Date().toISOString(),
          unlinked_by: userId,
          unlink_reason: reason
        })
        .eq('appointment_id', appointmentId)
        .eq('is_active', true);

      if (auditError) {
        console.warn('⚠️ Failed to update audit records:', auditError);
      }

      console.log(`✅ Appointment unlinked successfully`);

      return {
        success: true,
        appointmentId,
        profileId: appointment.patient_profile_id
      };
    } catch (error) {
      console.error('❌ Error in unlinkAppointment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get unlinked patient profiles that need manual attention
   * @returns {Promise<Array>} - List of unlinked profiles
   */
  async getUnlinkedProfiles() {
    try {
      const { data, error } = await supabase
        .from('patient_profiles')
        .select('*')
        .or('linked_appointments_count.eq.0,linked_appointments_count.is.null')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return {
        success: true,
        profiles: data || [],
        count: data?.length || 0
      };
    } catch (error) {
      console.error('❌ Error in getUnlinkedProfiles:', error);
      return {
        success: false,
        error: error.message,
        profiles: []
      };
    }
  }

  /**
   * Search for appointments that could match a profile
   * @param {Object} searchCriteria - { phone, mrn, name, dateFrom, dateTo }
   * @returns {Promise<Array>} - Matching appointments
   */
  async searchMatchingAppointments(searchCriteria) {
    try {
      const { phone, mrn, name, dateFrom, dateTo } = searchCriteria;

      let query = supabase
        .from('appointments')
        .select('*')
        .is('patient_profile_id', null); // Only unlinked appointments

      // Add filters based on provided criteria
      if (phone) {
        const normalizedPhone = this.normalizePhone(phone);
        query = query.eq('patient_phone', normalizedPhone);
      }

      if (mrn) {
        query = query.eq('patient_mrn', mrn);
      }

      if (name) {
        query = query.ilike('patient_name', `%${name}%`);
      }

      if (dateFrom) {
        query = query.gte('appointment_date', dateFrom);
      } else {
        // Default to future appointments only
        query = query.gte('appointment_date', new Date().toISOString().split('T')[0]);
      }

      if (dateTo) {
        query = query.lte('appointment_date', dateTo);
      }

      query = query
        .not('status', 'in', '(cancelled,no-show)')
        .order('appointment_date', { ascending: true })
        .limit(50);

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        appointments: data || [],
        count: data?.length || 0
      };
    } catch (error) {
      console.error('❌ Error in searchMatchingAppointments:', error);
      return {
        success: false,
        error: error.message,
        appointments: []
      };
    }
  }

  /**
   * Get linking statistics for monitoring dashboard
   * @returns {Promise<Object>} - Statistics
   */
  async getLinkingStats() {
    try {
      // Get total appointments
      const { count: totalAppointments } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('appointment_date', new Date().toISOString().split('T')[0]);

      // Get linked appointments
      const { count: linkedAppointments } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .not('patient_profile_id', 'is', null)
        .gte('appointment_date', new Date().toISOString().split('T')[0]);

      // Get unique profiles linked
      const { data: uniqueProfiles } = await supabase
        .from('appointments')
        .select('patient_profile_id')
        .not('patient_profile_id', 'is', null)
        .gte('appointment_date', new Date().toISOString().split('T')[0]);

      const uniqueProfileCount = new Set(uniqueProfiles?.map(a => a.patient_profile_id)).size;

      // Get breakdown by link method
      const { data: methodBreakdown } = await supabase
        .from('appointments')
        .select('link_method')
        .not('patient_profile_id', 'is', null)
        .gte('appointment_date', new Date().toISOString().split('T')[0]);

      const byMethod = {};
      methodBreakdown?.forEach(row => {
        const method = row.link_method || 'unknown';
        byMethod[method] = (byMethod[method] || 0) + 1;
      });

      return {
        success: true,
        stats: {
          totalAppointments: totalAppointments || 0,
          linkedAppointments: linkedAppointments || 0,
          unlinkedAppointments: (totalAppointments || 0) - (linkedAppointments || 0),
          uniqueProfilesLinked: uniqueProfileCount,
          linkingRate: totalAppointments > 0
            ? ((linkedAppointments / totalAppointments) * 100).toFixed(1)
            : 0,
          byMethod
        }
      };
    } catch (error) {
      console.error('❌ Error in getLinkingStats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ProfileLinkingService();
