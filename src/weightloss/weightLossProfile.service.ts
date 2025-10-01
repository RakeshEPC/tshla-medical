import type {
  WeightLossProfile,
  DailyCheckin,
  WeeklyCheckin,
  PatientMetadata,
  MealPlan,
  ExercisePlan,
  StallIntervention
} from './types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

class WeightLossProfileService {
  private readonly STORAGE_PREFIX = 'weightloss_';
  private currentProfile: WeightLossProfile | null = null;
  
  /**
   * Initialize a new weight loss profile
   */
  createProfile(patientId: string): WeightLossProfile {
    const profile: WeightLossProfile = {
      patientId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      demographics: {
        age: 0,
        sex: 'female',
        height: 0,
        startingWeight: 0,
        preferredUnits: {
          weight: 'kg',
          height: 'cm'
        }
      },
      medical: {
        diagnoses: [],
        currentMedications: [],
        labResults: {},
        medicalHistory: {}
      },
      dietary: {
        dietPattern: 'omnivore',
        foodsToAvoid: {
          allergies: [],
          intolerances: [],
          preferences: [],
          religious: [],
          medical: []
        },
        staples: {
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: []
        },
        cuisinePreferences: []
      },
      lifestyle: {
        schedule: {
          wakeTime: '07:00',
          sleepTime: '23:00',
          workShift: 'day',
          mealTimes: {}
        },
        activity: {
          baseline: 'sedentary',
          exerciseHabits: {
            frequency: 'none',
            types: [],
            gymAccess: false,
            homeEquipment: []
          }
        },
        cooking: {
          homeVsRestaurant: 50,
          skillLevel: 'beginner',
          timeAvailable: 'moderate',
          budget: 'moderate'
        },
        travel: {
          frequency: 'occasional',
          types: 'domestic'
        }
      },
      targets: {
        protein: {
          target: 80,
          calculation: 'per_kg',
          perKg: 1.2
        },
        steps: {
          minimum: 5000,
          target: 8000
        },
        sleep: {
          minimumHours: 6,
          targetHours: 8
        },
        hydration: {
          target: 2000
        },
        redFlags: {
          dizziness: true,
          vomitingDuration: 24,
          severNausea: true,
          chestPain: true,
          severeWeakness: true,
          customRules: []
        }
      },
      preferences: {
        communication: {
          bestTimes: ['08:00', '12:00', '18:00'],
          quietHours: {
            start: '22:00',
            end: '07:00'
          },
          frequency: 'daily',
          channels: ['app', 'push']
        },
        tone: 'coach',
        language: 'en',
        consent: {
          dataSharing: false,
          anonymizedAnalytics: true,
          coachingBoundaries: []
        }
      },
      onboardingComplete: false
    };
    
    this.saveProfile(profile);
    this.currentProfile = profile;
    return profile;
  }
  
  /**
   * Load existing profile
   */
  loadProfile(patientId: string): WeightLossProfile | null {
    const stored = localStorage.getItem(`${this.STORAGE_PREFIX}profile_${patientId}`);
    if (stored) {
      try {
        this.currentProfile = JSON.parse(stored);
        return this.currentProfile;
      } catch (e) {
        logError('App', 'Error message', {});
      }
    }
    return null;
  }
  
  /**
   * Save profile to storage
   */
  saveProfile(profile: WeightLossProfile): void {
    profile.updatedAt = new Date().toISOString();
    localStorage.setItem(
      `${this.STORAGE_PREFIX}profile_${profile.patientId}`,
      JSON.stringify(profile)
    );
    this.currentProfile = profile;
  }
  
  /**
   * Update profile section
   */
  updateProfileSection<K extends keyof WeightLossProfile>(
    patientId: string,
    section: K,
    data: Partial<WeightLossProfile[K]>
  ): WeightLossProfile | null {
    const profile = this.loadProfile(patientId);
    if (!profile) return null;
    
    profile[section] = {
      ...profile[section],
      ...data
    } as WeightLossProfile[K];
    
    this.saveProfile(profile);
    return profile;
  }
  
  /**
   * Mark onboarding as complete
   */
  completeOnboarding(patientId: string): void {
    const profile = this.loadProfile(patientId);
    if (profile) {
      profile.onboardingComplete = true;
      this.saveProfile(profile);
    }
  }
  
  /**
   * Save daily check-in
   */
  saveDailyCheckin(checkin: DailyCheckin): void {
    const key = `${this.STORAGE_PREFIX}daily_${checkin.patientId}_${checkin.date}`;
    localStorage.setItem(key, JSON.stringify(checkin));
    
    // Update today's checkin status
    const todayKey = `${this.STORAGE_PREFIX}today_${checkin.patientId}`;
    localStorage.setItem(todayKey, checkin.date);
  }
  
  /**
   * Get daily check-ins for a date range
   */
  getDailyCheckins(
    patientId: string, 
    startDate: string, 
    endDate: string
  ): DailyCheckin[] {
    const checkins: DailyCheckin[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const key = `${this.STORAGE_PREFIX}daily_${patientId}_${dateStr}`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        try {
          checkins.push(JSON.parse(stored));
        } catch (e) {
          logError('App', 'Error message', {});
        }
      }
    }
    
    return checkins;
  }
  
  /**
   * Check if today's check-in is complete
   */
  isTodayCheckinComplete(patientId: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    const key = `${this.STORAGE_PREFIX}daily_${patientId}_${today}`;
    return localStorage.getItem(key) !== null;
  }
  
  /**
   * Save weekly check-in
   */
  saveWeeklyCheckin(checkin: WeeklyCheckin): void {
    const key = `${this.STORAGE_PREFIX}weekly_${checkin.patientId}_${checkin.weekStarting}`;
    localStorage.setItem(key, JSON.stringify(checkin));
  }
  
  /**
   * Get patient metadata
   */
  getPatientMetadata(patientId: string): PatientMetadata {
    const key = `${this.STORAGE_PREFIX}metadata_${patientId}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        logError('App', 'Error message', {});
      }
    }
    
    // Return default metadata
    return {
      cohorts: [],
      engagementStats: {
        replyRate: 0,
        checkinStreak: 0,
        lastActive: new Date().toISOString(),
        nudgesCompleted: 0,
        dropoffs: 0
      },
      progressMarkers: {
        week4: 0,
        week8: 0,
        week12: 0,
        bestWeek: 0
      },
      interventions: [],
      escalations: []
    };
  }
  
  /**
   * Update engagement stats
   */
  updateEngagementStats(patientId: string, updates: Partial<PatientMetadata['engagementStats']>): void {
    const metadata = this.getPatientMetadata(patientId);
    metadata.engagementStats = {
      ...metadata.engagementStats,
      ...updates,
      lastActive: new Date().toISOString()
    };
    
    const key = `${this.STORAGE_PREFIX}metadata_${patientId}`;
    localStorage.setItem(key, JSON.stringify(metadata));
  }
  
  /**
   * Calculate progress statistics
   */
  calculateProgress(patientId: string): {
    totalWeightLoss: number;
    percentageLoss: number;
    averageWeeklyLoss: number;
    currentStreak: number;
    daysOnProgram: number;
  } {
    const profile = this.loadProfile(patientId);
    if (!profile) {
      return {
        totalWeightLoss: 0,
        percentageLoss: 0,
        averageWeeklyLoss: 0,
        currentStreak: 0,
        daysOnProgram: 0
      };
    }
    
    // Get all check-ins
    const startDate = new Date(profile.createdAt).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    const checkins = this.getDailyCheckins(patientId, startDate, endDate);
    
    // Calculate stats
    const latestWeight = checkins.length > 0 
      ? checkins[checkins.length - 1].weight || profile.demographics.startingWeight
      : profile.demographics.startingWeight;
    
    const totalWeightLoss = profile.demographics.startingWeight - latestWeight;
    const percentageLoss = (totalWeightLoss / profile.demographics.startingWeight) * 100;
    
    const daysOnProgram = Math.floor(
      (new Date().getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const weeksOnProgram = Math.max(1, Math.floor(daysOnProgram / 7));
    const averageWeeklyLoss = totalWeightLoss / weeksOnProgram;
    
    // Calculate streak
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      if (checkins.find(c => c.date === dateStr)) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }
    
    return {
      totalWeightLoss,
      percentageLoss,
      averageWeeklyLoss,
      currentStreak,
      daysOnProgram
    };
  }
  
  /**
   * Detect weight loss stall
   */
  detectStall(patientId: string): {
    isStalled: boolean;
    daysStalled: number;
    suggestedIntervention?: StallIntervention;
  } {
    const checkins = this.getDailyCheckins(
      patientId,
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
    
    if (checkins.length < 7) {
      return { isStalled: false, daysStalled: 0 };
    }
    
    // Check if weight has been stable (within 0.5kg) for 7+ days
    const weights = checkins.filter(c => c.weight).map(c => c.weight!);
    if (weights.length < 7) {
      return { isStalled: false, daysStalled: 0 };
    }
    
    const recentWeights = weights.slice(-7);
    const avgWeight = recentWeights.reduce((a, b) => a + b, 0) / recentWeights.length;
    const maxDiff = Math.max(...recentWeights.map(w => Math.abs(w - avgWeight)));
    
    if (maxDiff < 0.5) {
      // Weight has been stable - stall detected
      return {
        isStalled: true,
        daysStalled: 7,
        suggestedIntervention: {
          type: 'protein_reset',
          duration: 5,
          plan: {
            daily: [],
            goals: ['Increase protein to 1.5g/kg', 'Reduce carbs by 30%', 'Maintain activity'],
            tracking: ['protein', 'weight', 'hunger']
          },
          expectedOutcome: 'Break through plateau by resetting metabolism'
        }
      };
    }
    
    return { isStalled: false, daysStalled: 0 };
  }
  
  /**
   * Get current profile
   */
  getCurrentProfile(): WeightLossProfile | null {
    return this.currentProfile;
  }
}

export const weightLossProfileService = new WeightLossProfileService();