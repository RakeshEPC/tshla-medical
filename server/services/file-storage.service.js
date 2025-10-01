import { logError, logWarn, logInfo, logDebug } from '../../src/services/logger.service';
const fs = require('fs');
const path = require('path');

class FileStorageService {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.callsFile = path.join(this.dataDir, 'phone-calls.json');
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize calls file if it doesn't exist
    if (!fs.existsSync(this.callsFile)) {
      fs.writeFileSync(this.callsFile, '[]', 'utf8');
    }
  }

  // Save a new call to the file
  async saveCall(callData) {
    try {
      // Read existing calls
      const existingCalls = this.getAllCalls();

      // Add timestamp if not provided
      if (!callData.timestamp) {
        callData.timestamp = new Date().toISOString();
      }

      // Add unique ID if not provided
      if (!callData.id) {
        callData.id = `CALL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Add the new call
      existingCalls.unshift(callData); // Add to beginning for most recent first

      // Keep only last 100 calls to prevent file from getting too large
      if (existingCalls.length > 100) {
        existingCalls.splice(100);
      }

      // Write back to file
      fs.writeFileSync(this.callsFile, JSON.stringify(existingCalls, null, 2), 'utf8');

      logDebug('file-storage', '$1', $2);
      return callData.id;
    } catch (error) {
      logError('file-storage', '$1', $2);
      throw error;
    }
  }

  // Get all calls from file
  getAllCalls() {
    try {
      if (!fs.existsSync(this.callsFile)) {
        return [];
      }

      const data = fs.readFileSync(this.callsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logError('file-storage', '$1', $2);
      return [];
    }
  }

  // Get recent calls (for dashboard)
  getRecentCalls(limit = 10) {
    const allCalls = this.getAllCalls();
    return allCalls.slice(0, limit);
  }

  // Get call by ID
  getCallById(id) {
    const allCalls = this.getAllCalls();
    return allCalls.find(call => call.id === id);
  }

  // Update call status
  async updateCallStatus(id, status) {
    try {
      const allCalls = this.getAllCalls();
      const callIndex = allCalls.findIndex(call => call.id === id);

      if (callIndex !== -1) {
        allCalls[callIndex].status = status;
        allCalls[callIndex].lastUpdated = new Date().toISOString();

        fs.writeFileSync(this.callsFile, JSON.stringify(allCalls, null, 2), 'utf8');
        logDebug('file-storage', '$1', $2);
        return true;
      }

      return false;
    } catch (error) {
      logError('file-storage', '$1', $2);
      throw error;
    }
  }

  // Get call statistics for dashboard
  getCallStats() {
    const calls = this.getAllCalls();
    const today = new Date().toDateString();

    const todaysCalls = calls.filter(call => {
      const callDate = new Date(call.timestamp).toDateString();
      return callDate === today;
    });

    const stats = {
      totalCalls: calls.length,
      todaysCalls: todaysCalls.length,
      emergencyCalls: calls.filter(call => call.priority === 'emergency').length,
      urgentCalls: calls.filter(call => call.priority === 'urgent').length,
      completedCalls: calls.filter(call => call.status === 'completed').length,
      pendingCalls: calls.filter(call => call.status === 'pending').length,
      averageCallDuration: this.calculateAverageCallDuration(calls),
      lastCallTime: calls.length > 0 ? calls[0].timestamp : null,
    };

    return stats;
  }

  calculateAverageCallDuration(calls) {
    const callsWithDuration = calls.filter(call => call.duration && call.duration > 0);
    if (callsWithDuration.length === 0) return 0;

    const totalDuration = callsWithDuration.reduce((sum, call) => sum + call.duration, 0);
    return Math.round(totalDuration / callsWithDuration.length);
  }
}

// Export singleton instance
module.exports = new FileStorageService();
