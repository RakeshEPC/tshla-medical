/**
 * TSHLA Medical - Database Helper Utilities
 * Prevents JSON parsing errors and data corruption
 */

class DatabaseHelper {
  /**
   * Safely parse JSON with comprehensive error handling
   * @param {any} value - Value to parse (string, object, null, undefined)
   * @param {any} fallback - Fallback value if parsing fails
   * @returns {any} Parsed JSON or fallback
   */
  static safeJsonParse(value, fallback = null) {
    // Handle null/undefined
    if (!value) return fallback;

    // Already an object - return as-is
    if (typeof value === 'object') return value;

    // Handle common bad patterns
    if (value === '[object Object]') {
      console.warn('App', 'Invalid [object Object] data detected');
      return fallback;
    }

    if (value === 'undefined' || value === 'null') {
      return fallback;
    }

    // Try to parse JSON string
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('App', 'JSON parse failed:', {
        value: value,
        error: error.message,
        fallback: fallback
      });
      return fallback;
    }
  }

  /**
   * Safely stringify data for database storage
   * @param {any} value - Value to stringify
   * @returns {string} JSON string
   */
  static safeJsonStringify(value) {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return JSON.stringify({});
    }

    // Already a string - validate it's proper JSON
    if (typeof value === 'string') {
      try {
        JSON.parse(value); // Validate
        return value;
      } catch {
        console.warn('App', 'Invalid JSON string detected');
        return JSON.stringify({ invalidData: value });
      }
    }

    // Convert object to JSON
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error('App', 'JSON stringify failed:', error);
      return JSON.stringify({ error: 'Failed to stringify data' });
    }
  }

  /**
   * Parse session data safely
   * @param {Object} session - Raw session from database
   * @returns {Object} Safely parsed session
   */
  static parseSessionData(session) {
    return {
      sessionId: session.session_id,
      categoryResponses: this.safeJsonParse(session.category_responses, {}),
      currentCategory: session.current_category,
      completedCategories: this.safeJsonParse(session.completed_categories, []),
      createdAt: session.created_at,
      updatedAt: session.updated_at
    };
  }

  /**
   * Parse assessment data safely
   * @param {Object} assessment - Raw assessment from database
   * @returns {Object} Safely parsed assessment
   */
  static parseAssessmentData(assessment) {
    return {
      ...assessment,
      slider_values: this.safeJsonParse(assessment.slider_values, {}),
      selected_features: this.safeJsonParse(assessment.selected_features, []),
      clarification_responses: this.safeJsonParse(assessment.clarification_responses, {}),
      gpt4_scores: this.safeJsonParse(assessment.gpt4_scores, {}),
      claude_scores: this.safeJsonParse(assessment.claude_scores, {}),
      hybrid_scores: this.safeJsonParse(assessment.hybrid_scores, {}),
      final_recommendation: this.safeJsonParse(assessment.final_recommendation, {})
    };
  }

  /**
   * Validate and prepare data for saving
   * @param {Object} data - Data to validate
   * @param {Array} jsonFields - Fields that should be JSON
   * @returns {Object} Prepared data
   */
  static prepareForSave(data, jsonFields = []) {
    const prepared = { ...data };

    jsonFields.forEach(field => {
      if (prepared[field] !== undefined) {
        prepared[field] = this.safeJsonStringify(prepared[field]);
      }
    });

    return prepared;
  }
}

module.exports = DatabaseHelper;