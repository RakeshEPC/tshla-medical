import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { weightLossProfileService } from '../weightloss/weightLossProfile.service';
import { patientService } from '../services/patient.service';
import type { WeightLossProfile } from '../weightloss/types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

interface WeightLossPlan {
  dailyCalories: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  weeklyWeightLossGoal: number;
  mealPlan: {
    breakfast: string[];
    lunch: string[];
    dinner: string[];
    snacks: string[];
  };
  exercisePlan: {
    cardio: string[];
    strength: string[];
    flexibility: string[];
    weeklySchedule: string;
  };
  behaviorStrategies: string[];
  milestones: {
    week2: string;
    month1: string;
    month3: string;
    month6: string;
  };
  personalizedTips: string[];
  warningsAndConcerns: string[];
}

export default function WeightLossOnboardingSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<WeightLossProfile | null>(null);
  const [plan, setPlan] = useState<WeightLossPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [showFullPlan, setShowFullPlan] = useState(false);

  useEffect(() => {
    loadProfileAndGeneratePlan();
  }, []);

  const loadProfileAndGeneratePlan = async () => {
    try {
      // Get current patient
      const currentPatient = patientService.getCurrentPatient();
      if (!currentPatient) {
        navigate('/patient-login');
        return;
      }

      // Get the weight loss profile
      const patientProfile = weightLossProfileService.getProfile(currentPatient.internalId);
      if (!patientProfile) {
        navigate('/weightloss/onboarding');
        return;
      }

      setProfile(patientProfile);

      // Generate AI plan
      const aiPlan = await generateAIPlan(patientProfile);
      setPlan(aiPlan);

      // Store the plan
      storeWeightLossPlan(currentPatient.internalId, aiPlan);
    } catch (error) {
      logError('WeightLossOnboardingSummary', 'Error message', {});
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAIPlan = async (profile: WeightLossProfile): Promise<WeightLossPlan> => {
    const prompt = `
      Based on this comprehensive weight loss patient profile, create a detailed, personalized weight loss plan.
      
      Patient Profile:
      Demographics:
      - Age: ${profile.demographics.age}, ${profile.demographics.sex}
      - Height: ${profile.demographics.height}cm, Current Weight: ${profile.demographics.weight}kg
      - Goal Weight: ${profile.demographics.goalWeight}kg
      - Target Date: ${profile.demographics.targetDate}
      
      Medical Context:
      - Diagnoses: ${profile.medical.diagnoses.join(', ')}
      - Medications: ${profile.medical.medications.map(m => m.name).join(', ')}
      - Recent labs: A1C=${profile.medical.recentLabs.a1c}, LDL=${profile.medical.recentLabs.ldl}
      
      Dietary Profile:
      - Current Diet Pattern: ${profile.dietary.currentDiet}
      - Dietary Restrictions: ${profile.dietary.restrictions.join(', ')}
      - Allergies: ${profile.dietary.foodsToAvoid.allergies.join(', ')}
      - Preferred Cuisines: ${profile.dietary.cuisinePreferences.join(', ')}
      - Eating Out Frequency: ${profile.dietary.eatingOutFrequency}
      - Water Intake: ${profile.dietary.waterIntake}
      - Alcohol: ${profile.dietary.alcoholConsumption}
      
      Lifestyle:
      - Work Schedule: ${profile.lifestyle.workSchedule}
      - Activity Level: ${profile.lifestyle.activityLevel}
      - Exercise: ${profile.lifestyle.exerciseFrequency}
      - Sleep: ${profile.lifestyle.sleepHours} hours
      - Stress Level: ${profile.lifestyle.stressLevel}
      - Cooking Time: ${profile.lifestyle.cookingTime}
      - Travel Frequency: ${profile.lifestyle.travelFrequency}
      
      Health Targets:
      - Daily Protein: ${profile.targets.dailyProtein}g
      - Daily Steps: ${profile.targets.dailySteps}
      - Weekly Exercise: ${profile.targets.weeklyExerciseMinutes} minutes
      - Sleep Goal: ${profile.targets.sleepHours} hours
      - Water Goal: ${profile.targets.waterIntake} glasses
      
      Preferences:
      - Check-in Frequency: ${profile.preferences.checkInFrequency}
      - Preferred Time: ${profile.preferences.preferredCheckInTime}
      - Notification Style: ${profile.preferences.notificationStyle}
      - Motivators: ${profile.preferences.motivators.join(', ')}
      - Challenges: ${profile.preferences.challenges.join(', ')}
      
      Create a comprehensive weight loss plan that includes:
      1. Daily calorie target with macro breakdown (protein, carbs, fat in grams)
      2. Weekly weight loss goal (safe and sustainable)
      3. Specific meal suggestions for breakfast, lunch, dinner, and snacks based on their cuisine preferences and restrictions
      4. Exercise plan with specific activities for cardio, strength, and flexibility
      5. Behavioral strategies addressing their specific challenges
      6. Milestone goals for 2 weeks, 1 month, 3 months, and 6 months
      7. 5 personalized tips based on their unique situation
      8. Any warnings or medical concerns to watch for
      
      Format the response as JSON with the following structure:
      {
        "dailyCalories": number,
        "proteinTarget": number,
        "carbTarget": number,
        "fatTarget": number,
        "weeklyWeightLossGoal": number,
        "mealPlan": {
          "breakfast": ["option1", "option2", "option3"],
          "lunch": ["option1", "option2", "option3"],
          "dinner": ["option1", "option2", "option3"],
          "snacks": ["option1", "option2", "option3"]
        },
        "exercisePlan": {
          "cardio": ["activity1", "activity2"],
          "strength": ["activity1", "activity2"],
          "flexibility": ["activity1", "activity2"],
          "weeklySchedule": "detailed schedule"
        },
        "behaviorStrategies": ["strategy1", "strategy2", "strategy3"],
        "milestones": {
          "week2": "goal",
          "month1": "goal",
          "month3": "goal",
          "month6": "goal"
        },
        "personalizedTips": ["tip1", "tip2", "tip3", "tip4", "tip5"],
        "warningsAndConcerns": ["concern1", "concern2"]
      }
    `;

    try {
      const response = await azureAIService.generateSoapNote(prompt, '');
      const parsedPlan = JSON.parse(response);
      return parsedPlan;
    } catch (error) {
      logError('WeightLossOnboardingSummary', 'Error message', {});
      // Return a default plan if AI fails
      return getDefaultPlan(profile);
    }
  };

  const getDefaultPlan = (profile: WeightLossProfile): WeightLossPlan => {
    const bmr =
      profile.demographics.sex === 'Male'
        ? 10 * profile.demographics.weight +
          6.25 * profile.demographics.height -
          5 * profile.demographics.age +
          5
        : 10 * profile.demographics.weight +
          6.25 * profile.demographics.height -
          5 * profile.demographics.age -
          161;

    const dailyCalories = Math.round(bmr * 1.2 - 500); // 500 calorie deficit

    return {
      dailyCalories,
      proteinTarget: Math.round(profile.demographics.weight * 1.2),
      carbTarget: Math.round((dailyCalories * 0.4) / 4),
      fatTarget: Math.round((dailyCalories * 0.3) / 9),
      weeklyWeightLossGoal: 0.5, // 0.5-1kg per week is safe
      mealPlan: {
        breakfast: [
          'Greek yogurt parfait with berries and granola',
          'Veggie omelet with whole grain toast',
          'Overnight oats with protein powder and fruits',
        ],
        lunch: [
          'Grilled chicken salad with mixed greens',
          'Quinoa bowl with roasted vegetables',
          'Turkey and avocado wrap with side salad',
        ],
        dinner: [
          'Baked salmon with steamed vegetables',
          'Stir-fry tofu with brown rice',
          'Lean beef with sweet potato and green beans',
        ],
        snacks: [
          'Apple slices with almond butter',
          'Protein shake with banana',
          'Carrot sticks with hummus',
        ],
      },
      exercisePlan: {
        cardio: ['30-minute brisk walk', '20-minute cycling', '15-minute HIIT workout'],
        strength: [
          'Upper body resistance training',
          'Lower body bodyweight exercises',
          'Core strengthening',
        ],
        flexibility: [
          '10-minute morning stretch',
          '15-minute yoga session',
          '5-minute post-workout stretch',
        ],
        weeklySchedule:
          'Monday/Wednesday/Friday: Cardio + Strength, Tuesday/Thursday: Flexibility + Light cardio, Weekend: Active rest',
      },
      behaviorStrategies: [
        'Track all meals in a food diary',
        'Prepare meals in advance on weekends',
        'Find an accountability partner',
        'Set up regular check-ins with healthcare provider',
      ],
      milestones: {
        week2: 'Establish consistent meal timing and portion control',
        month1: `Lose ${Math.round(profile.demographics.weight * 0.02)}kg and build exercise habit`,
        month3: `Reach ${Math.round(profile.demographics.weight * 0.05)}kg weight loss`,
        month6: `Achieve ${Math.round(profile.demographics.weight * 0.1)}kg total weight loss`,
      },
      personalizedTips: [
        'Focus on protein at every meal to maintain muscle mass',
        'Stay hydrated - aim for your target water intake daily',
        'Get adequate sleep to support weight loss hormones',
        'Manage stress through meditation or deep breathing',
        'Celebrate non-scale victories like energy and mood improvements',
      ],
      warningsAndConcerns: [
        'Monitor blood sugar if diabetic - weight loss may affect medication needs',
        'Watch for signs of too rapid weight loss (fatigue, hair loss, mood changes)',
      ],
    };
  };

  const storeWeightLossPlan = (patientId: string, plan: WeightLossPlan) => {
    // Store the plan in localStorage for now (in production, this would go to a database)
    const storageKey = `weight_loss_plan_${patientId}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        plan,
        createdAt: new Date().toISOString(),
        patientId,
      })
    );

    // Also update the patient record to indicate plan was generated
    const patient = patientService.getCurrentPatient();
    if (patient) {
      patientService.updatePatientProgram(patient.internalId, 'weightloss', {
        planGenerated: true,
        planGeneratedAt: new Date().toISOString(),
      });
    }
  };

  const handleStartJourney = () => {
    navigate('/weightloss/dashboard');
  };

  const downloadPlan = () => {
    if (!plan || !profile) return;

    const planText = `
PERSONALIZED WEIGHT LOSS PLAN
Generated: ${new Date().toLocaleDateString()}

PATIENT INFORMATION
Name: ${patientService.getCurrentPatient()?.firstName} ${patientService.getCurrentPatient()?.lastName}
Current Weight: ${profile.demographics.weight}kg
Goal Weight: ${profile.demographics.goalWeight}kg
Target Date: ${profile.demographics.targetDate}

DAILY NUTRITION TARGETS
Calories: ${plan.dailyCalories}
Protein: ${plan.proteinTarget}g
Carbohydrates: ${plan.carbTarget}g
Fat: ${plan.fatTarget}g
Weekly Weight Loss Goal: ${plan.weeklyWeightLossGoal}kg

MEAL PLAN
Breakfast Options:
${plan.mealPlan.breakfast.map(item => `• ${item}`).join('\n')}

Lunch Options:
${plan.mealPlan.lunch.map(item => `• ${item}`).join('\n')}

Dinner Options:
${plan.mealPlan.dinner.map(item => `• ${item}`).join('\n')}

Snack Options:
${plan.mealPlan.snacks.map(item => `• ${item}`).join('\n')}

EXERCISE PLAN
${plan.exercisePlan.weeklySchedule}

Cardio Activities:
${plan.exercisePlan.cardio.map(item => `• ${item}`).join('\n')}

Strength Training:
${plan.exercisePlan.strength.map(item => `• ${item}`).join('\n')}

Flexibility:
${plan.exercisePlan.flexibility.map(item => `• ${item}`).join('\n')}

BEHAVIORAL STRATEGIES
${plan.behaviorStrategies.map((item, i) => `${i + 1}. ${item}`).join('\n')}

MILESTONES
• 2 Weeks: ${plan.milestones.week2}
• 1 Month: ${plan.milestones.month1}
• 3 Months: ${plan.milestones.month3}
• 6 Months: ${plan.milestones.month6}

PERSONALIZED TIPS
${plan.personalizedTips.map((item, i) => `${i + 1}. ${item}`).join('\n')}

IMPORTANT WARNINGS
${plan.warningsAndConcerns.map(item => `⚠️ ${item}`).join('\n')}
    `;

    // Create and download file
    const blob = new Blob([planText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weight_loss_plan.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-r from-green-400 to-blue-400 rounded-full animate-pulse mx-auto mb-6"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl">🤖</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            AI is Creating Your Personalized Plan
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Analyzing your profile and medical history to create the perfect weight loss strategy...
          </p>
          <div className="mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !plan) {
    return null;
  }

  const totalWeightLoss = profile.demographics.weight - profile.demographics.goalWeight;
  const weeksToGoal = Math.round(totalWeightLoss / plan.weeklyWeightLossGoal);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Success Header */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Your Personalized Weight Loss Plan is Ready!
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Based on your comprehensive profile, we've created a science-backed plan tailored
              specifically for you. Let's review your roadmap to success.
            </p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-2xl font-bold">{plan.dailyCalories}</div>
            <div className="text-sm opacity-90">Daily Calories</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <div className="text-3xl mb-2">💪</div>
            <div className="text-2xl font-bold">{plan.proteinTarget}g</div>
            <div className="text-sm opacity-90">Daily Protein</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="text-3xl mb-2">⚖️</div>
            <div className="text-2xl font-bold">{plan.weeklyWeightLossGoal}kg</div>
            <div className="text-sm opacity-90">Weekly Goal</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
            <div className="text-3xl mb-2">📅</div>
            <div className="text-2xl font-bold">{weeksToGoal}</div>
            <div className="text-sm opacity-90">Weeks to Goal</div>
          </div>
        </div>

        {/* Main Plan Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Complete Plan</h2>
            <button
              onClick={() => setShowFullPlan(!showFullPlan)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {showFullPlan ? 'Show Summary' : 'Show Full Details'}
            </button>
          </div>

          {!showFullPlan ? (
            // Summary View
            <div className="space-y-6">
              {/* Quick Start Guide */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-lg mb-2">🚀 Quick Start Guide</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Start with {plan.dailyCalories} calories per day</li>
                  <li>• Aim for {plan.proteinTarget}g protein at each meal</li>
                  <li>• Begin with 3 days of exercise this week</li>
                  <li>• Track your meals and weight daily</li>
                </ul>
              </div>

              {/* Today's Action Items */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">📝 Today's Action Items</h3>
                <div className="space-y-2">
                  {[
                    'Download your meal plan',
                    'Set up daily reminders',
                    'Take starting measurements',
                    "Plan tomorrow's meals",
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 text-blue-600" />
                      <span className="text-gray-700">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Key Milestones */}
              <div>
                <h3 className="font-semibold text-lg mb-3">🎯 Your Milestones</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-blue-600">2 Weeks</div>
                    <div className="text-sm text-gray-600">{plan.milestones.week2}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-green-600">1 Month</div>
                    <div className="text-sm text-gray-600">{plan.milestones.month1}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-purple-600">3 Months</div>
                    <div className="text-sm text-gray-600">{plan.milestones.month3}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-medium text-orange-600">6 Months</div>
                    <div className="text-sm text-gray-600">{plan.milestones.month6}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Full Details View
            <div className="space-y-8">
              {/* Nutrition Plan */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">🥗 Nutrition Plan</h3>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{plan.dailyCalories}</div>
                      <div className="text-sm text-gray-600">Calories</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{plan.proteinTarget}g</div>
                      <div className="text-sm text-gray-600">Protein</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{plan.carbTarget}g</div>
                      <div className="text-sm text-gray-600">Carbs</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{plan.fatTarget}g</div>
                      <div className="text-sm text-gray-600">Fat</div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">🌅 Breakfast</h4>
                    <ul className="space-y-1 text-gray-700">
                      {plan.mealPlan.breakfast.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">🥙 Lunch</h4>
                    <ul className="space-y-1 text-gray-700">
                      {plan.mealPlan.lunch.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">🍽️ Dinner</h4>
                    <ul className="space-y-1 text-gray-700">
                      {plan.mealPlan.dinner.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">🥜 Snacks</h4>
                    <ul className="space-y-1 text-gray-700">
                      {plan.mealPlan.snacks.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Exercise Plan */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">🏃‍♀️ Exercise Plan</h3>
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <p className="text-gray-700">{plan.exercisePlan.weeklySchedule}</p>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">❤️ Cardio</h4>
                    <ul className="space-y-1 text-gray-700">
                      {plan.exercisePlan.cardio.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">💪 Strength</h4>
                    <ul className="space-y-1 text-gray-700">
                      {plan.exercisePlan.strength.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">🧘 Flexibility</h4>
                    <ul className="space-y-1 text-gray-700">
                      {plan.exercisePlan.flexibility.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Behavioral Strategies */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">🧠 Success Strategies</h3>
                <div className="space-y-2">
                  {plan.behaviorStrategies.map((strategy, idx) => (
                    <div key={idx} className="flex items-start">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className="text-gray-700">{strategy}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personalized Tips */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">💡 Personalized Tips</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {plan.personalizedTips.map((tip, idx) => (
                    <div key={idx} className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                      <span className="text-gray-700">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {plan.warningsAndConcerns.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">⚠️ Important Reminders</h3>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    {plan.warningsAndConcerns.map((warning, idx) => (
                      <div key={idx} className="text-red-800 mb-2">
                        • {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={handleStartJourney}
            className="px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-blue-700 shadow-lg transform hover:scale-105 transition-all"
          >
            Start Your Journey Now
          </button>

          <button
            onClick={downloadPlan}
            className="px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 shadow-lg"
          >
            📥 Download Plan
          </button>

          <button
            onClick={() => navigate('/patient/chat')}
            className="px-8 py-4 bg-white border-2 border-purple-500 text-purple-600 font-bold rounded-xl hover:bg-purple-50 shadow-lg"
          >
            💬 Discuss with AVA
          </button>
        </div>

        {/* Motivational Footer */}
        <div className="mt-12 text-center">
          <p className="text-lg text-gray-600 italic">
            "Your journey of a thousand miles begins with a single step. You've got this!"
          </p>
          <p className="text-sm text-gray-500 mt-2">- Your TSHLA Medical Support Team</p>
        </div>
      </div>
    </div>
  );
}
