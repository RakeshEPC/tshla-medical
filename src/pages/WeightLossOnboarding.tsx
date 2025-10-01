import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { weightLossProfileService } from '../weightloss/weightLossProfile.service';
import type {
  WeightLossProfile,
  Demographics,
  MedicalContext,
  DietaryProfile,
  LifestyleFactors,
  HealthTargets,
  EngagementPreferences,
} from '../weightloss/types';

const ONBOARDING_STEPS = [
  { id: 'demographics', title: 'Basic Information', emoji: '👤' },
  { id: 'medical', title: 'Medical History', emoji: '🏥' },
  { id: 'dietary', title: 'Diet & Culture', emoji: '🍽️' },
  { id: 'lifestyle', title: 'Lifestyle', emoji: '🏃' },
  { id: 'targets', title: 'Health Goals', emoji: '🎯' },
  { id: 'preferences', title: 'Communication', emoji: '💬' },
];

export default function WeightLossOnboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState<WeightLossProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form state for each section
  const [demographics, setDemographics] = useState<Demographics>({
    age: 0,
    sex: 'female',
    height: 170,
    startingWeight: 80,
    targetWeight: 70,
    preferredUnits: { weight: 'kg', height: 'cm' },
  });

  const [medical, setMedical] = useState<MedicalContext>({
    diagnoses: [],
    currentMedications: [],
    labResults: {},
    medicalHistory: {},
  });

  const [dietary, setDietary] = useState<DietaryProfile>({
    dietPattern: 'omnivore',
    foodsToAvoid: {
      allergies: [],
      intolerances: [],
      preferences: [],
      religious: [],
      medical: [],
    },
    staples: {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    },
    cuisinePreferences: [],
  });

  const [lifestyle, setLifestyle] = useState<LifestyleFactors>({
    schedule: {
      wakeTime: '07:00',
      sleepTime: '23:00',
      workShift: 'day',
      mealTimes: {},
    },
    activity: {
      baseline: 'sedentary',
      exerciseHabits: {
        frequency: 'none',
        types: [],
        gymAccess: false,
        homeEquipment: [],
      },
    },
    cooking: {
      homeVsRestaurant: 50,
      skillLevel: 'beginner',
      timeAvailable: 'moderate',
      budget: 'moderate',
    },
    travel: {
      frequency: 'occasional',
      types: 'domestic',
    },
  });

  const [targets, setTargets] = useState<HealthTargets>({
    protein: {
      target: 80,
      calculation: 'per_kg',
      perKg: 1.2,
    },
    steps: {
      minimum: 5000,
      target: 8000,
    },
    sleep: {
      minimumHours: 6,
      targetHours: 8,
    },
    hydration: {
      target: 2000,
    },
    redFlags: {
      dizziness: true,
      vomitingDuration: 24,
      severNausea: true,
      chestPain: true,
      severeWeakness: true,
      customRules: [],
    },
  });

  const [preferences, setPreferences] = useState<EngagementPreferences>({
    communication: {
      bestTimes: ['08:00', '12:00', '18:00'],
      quietHours: {
        start: '22:00',
        end: '07:00',
      },
      frequency: 'daily',
      channels: ['app', 'push'],
    },
    tone: 'coach',
    language: 'en',
    consent: {
      dataSharing: false,
      anonymizedAnalytics: true,
      coachingBoundaries: [],
    },
  });

  useEffect(() => {
    initializeProfile();
  }, []);

  const initializeProfile = () => {
    // For now, create a new profile with a random ID
    const patientId = `patient_${Date.now()}`;
    const existingProfile = weightLossProfileService.loadProfile(patientId);

    if (existingProfile) {
      setProfile(existingProfile);
      // Load existing data
      setDemographics(existingProfile.demographics);
      setMedical(existingProfile.medical);
      setDietary(existingProfile.dietary);
      setLifestyle(existingProfile.lifestyle);
      setTargets(existingProfile.targets);
      setPreferences(existingProfile.preferences);
    } else {
      const newProfile = weightLossProfileService.createProfile(patientId);
      setProfile(newProfile);
    }

    setIsLoading(false);
  };

  const handleNext = () => {
    if (!profile) return;

    // Save current step data
    switch (ONBOARDING_STEPS[currentStep].id) {
      case 'demographics':
        weightLossProfileService.updateProfileSection(
          profile.patientId,
          'demographics',
          demographics
        );
        break;
      case 'medical':
        weightLossProfileService.updateProfileSection(profile.patientId, 'medical', medical);
        break;
      case 'dietary':
        weightLossProfileService.updateProfileSection(profile.patientId, 'dietary', dietary);
        break;
      case 'lifestyle':
        weightLossProfileService.updateProfileSection(profile.patientId, 'lifestyle', lifestyle);
        break;
      case 'targets':
        weightLossProfileService.updateProfileSection(profile.patientId, 'targets', targets);
        break;
      case 'preferences':
        weightLossProfileService.updateProfileSection(
          profile.patientId,
          'preferences',
          preferences
        );
        break;
    }

    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding and navigate to summary
      weightLossProfileService.completeOnboarding(profile.patientId);
      navigate('/weightloss/summary');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderDemographicsStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Let's get to know you</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
          <input
            type="number"
            value={demographics.age || ''}
            onChange={e => setDemographics({ ...demographics, age: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your age"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sex</label>
          <select
            value={demographics.sex}
            onChange={e =>
              setDemographics({
                ...demographics,
                sex: e.target.value as 'male' | 'female' | 'other',
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Height ({demographics.preferredUnits.height})
          </label>
          <input
            type="number"
            value={demographics.height || ''}
            onChange={e => setDemographics({ ...demographics, height: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder={demographics.preferredUnits.height === 'cm' ? '170' : '67'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Starting Weight ({demographics.preferredUnits.weight})
          </label>
          <input
            type="number"
            value={demographics.startingWeight || ''}
            onChange={e =>
              setDemographics({ ...demographics, startingWeight: parseFloat(e.target.value) })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder={demographics.preferredUnits.weight === 'kg' ? '80' : '176'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Weight ({demographics.preferredUnits.weight})
          </label>
          <input
            type="number"
            value={demographics.targetWeight || ''}
            onChange={e =>
              setDemographics({ ...demographics, targetWeight: parseFloat(e.target.value) })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder={demographics.preferredUnits.weight === 'kg' ? '70' : '154'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Units</label>
          <div className="flex space-x-4">
            <button
              onClick={() =>
                setDemographics({ ...demographics, preferredUnits: { weight: 'kg', height: 'cm' } })
              }
              className={`px-4 py-2 rounded-lg ${
                demographics.preferredUnits.weight === 'kg'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Metric (kg/cm)
            </button>
            <button
              onClick={() =>
                setDemographics({
                  ...demographics,
                  preferredUnits: { weight: 'lb', height: 'inches' },
                })
              }
              className={`px-4 py-2 rounded-lg ${
                demographics.preferredUnits.weight === 'lb'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Imperial (lb/in)
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMedicalStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Medical Context</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Current Diagnoses</label>
        <div className="space-y-2">
          {['Type 2 Diabetes', 'PCOS', 'Hypothyroid', 'Hypertension', 'High Cholesterol'].map(
            condition => (
              <label key={condition} className="flex items-center">
                <input
                  type="checkbox"
                  checked={medical.diagnoses.some(d => d.condition === condition)}
                  onChange={e => {
                    if (e.target.checked) {
                      setMedical({
                        ...medical,
                        diagnoses: [...medical.diagnoses, { condition }],
                      });
                    } else {
                      setMedical({
                        ...medical,
                        diagnoses: medical.diagnoses.filter(d => d.condition !== condition),
                      });
                    }
                  }}
                  className="mr-3"
                />
                <span className="text-gray-700">{condition}</span>
              </label>
            )
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Current Medications</label>
        <div className="space-y-2">
          {['Ozempic/Wegovy', 'Mounjaro/Zepbound', 'Metformin', 'Levothyroxine', 'Insulin'].map(
            med => (
              <label key={med} className="flex items-center">
                <input
                  type="checkbox"
                  checked={medical.currentMedications.some(m => m.name === med)}
                  onChange={e => {
                    if (e.target.checked) {
                      const type =
                        med.includes('Ozempic') || med.includes('Mounjaro')
                          ? 'glp1'
                          : med === 'Levothyroxine'
                            ? 'thyroid'
                            : med === 'Insulin'
                              ? 'insulin'
                              : 'other';
                      setMedical({
                        ...medical,
                        currentMedications: [...medical.currentMedications, { name: med, type }],
                      });
                    } else {
                      setMedical({
                        ...medical,
                        currentMedications: medical.currentMedications.filter(m => m.name !== med),
                      });
                    }
                  }}
                  className="mr-3"
                />
                <span className="text-gray-700">{med}</span>
              </label>
            )
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Most Recent A1C</label>
          <input
            type="number"
            step="0.1"
            value={medical.labResults.a1c || ''}
            onChange={e =>
              setMedical({
                ...medical,
                labResults: { ...medical.labResults, a1c: parseFloat(e.target.value) },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 6.5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pregnancy Status</label>
          <select
            value={medical.medicalHistory.pregnancyStatus || 'not_applicable'}
            onChange={e =>
              setMedical({
                ...medical,
                medicalHistory: {
                  ...medical.medicalHistory,
                  pregnancyStatus: e.target.value as any,
                },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="not_applicable">Not Applicable</option>
            <option value="not_pregnant">Not Pregnant</option>
            <option value="pregnant">Currently Pregnant</option>
            <option value="planning">Planning Pregnancy</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderDietaryStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dietary Preferences & Culture</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Diet Pattern</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { value: 'omnivore', label: 'Omnivore', emoji: '🍖' },
            { value: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
            { value: 'vegan', label: 'Vegan', emoji: '🌱' },
            { value: 'pescatarian', label: 'Pescatarian', emoji: '🐟' },
            { value: 'flexitarian', label: 'Flexitarian', emoji: '🥗' },
          ].map(diet => (
            <button
              key={diet.value}
              onClick={() => setDietary({ ...dietary, dietPattern: diet.value as any })}
              className={`p-3 rounded-lg border-2 transition-all ${
                dietary.dietPattern === diet.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-1">{diet.emoji}</div>
              <div className="text-sm font-medium">{diet.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cultural/Religious Diet
        </label>
        <select
          value={dietary.culturalDiet || 'none'}
          onChange={e =>
            setDietary({
              ...dietary,
              culturalDiet: e.target.value === 'none' ? undefined : (e.target.value as any),
            })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="none">None</option>
          <option value="halal">Halal</option>
          <option value="kosher">Kosher</option>
          <option value="jain">Jain</option>
          <option value="hindu_vegetarian">Hindu Vegetarian</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Food Allergies</label>
        <div className="flex flex-wrap gap-2">
          {[
            'Peanuts',
            'Tree Nuts',
            'Dairy',
            'Eggs',
            'Soy',
            'Wheat/Gluten',
            'Shellfish',
            'Fish',
          ].map(allergy => (
            <button
              key={allergy}
              onClick={() => {
                const allergies = dietary.foodsToAvoid.allergies;
                if (allergies.includes(allergy)) {
                  setDietary({
                    ...dietary,
                    foodsToAvoid: {
                      ...dietary.foodsToAvoid,
                      allergies: allergies.filter(a => a !== allergy),
                    },
                  });
                } else {
                  setDietary({
                    ...dietary,
                    foodsToAvoid: {
                      ...dietary.foodsToAvoid,
                      allergies: [...allergies, allergy],
                    },
                  });
                }
              }}
              className={`px-3 py-1 rounded-full text-sm ${
                dietary.foodsToAvoid.allergies.includes(allergy)
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {allergy}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Cuisines</label>
        <div className="flex flex-wrap gap-2">
          {[
            'American',
            'Mexican',
            'Italian',
            'Chinese',
            'Indian',
            'Thai',
            'Japanese',
            'Mediterranean',
          ].map(cuisine => (
            <button
              key={cuisine}
              onClick={() => {
                const cuisines = dietary.cuisinePreferences;
                if (cuisines.includes(cuisine)) {
                  setDietary({
                    ...dietary,
                    cuisinePreferences: cuisines.filter(c => c !== cuisine),
                  });
                } else {
                  setDietary({
                    ...dietary,
                    cuisinePreferences: [...cuisines, cuisine],
                  });
                }
              }}
              className={`px-3 py-1 rounded-full text-sm ${
                dietary.cuisinePreferences.includes(cuisine)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {cuisine}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderLifestyleStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Your Lifestyle</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Wake Time</label>
          <input
            type="time"
            value={lifestyle.schedule.wakeTime}
            onChange={e =>
              setLifestyle({
                ...lifestyle,
                schedule: { ...lifestyle.schedule, wakeTime: e.target.value },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sleep Time</label>
          <input
            type="time"
            value={lifestyle.schedule.sleepTime}
            onChange={e =>
              setLifestyle({
                ...lifestyle,
                schedule: { ...lifestyle.schedule, sleepTime: e.target.value },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Work Schedule</label>
          <select
            value={lifestyle.schedule.workShift}
            onChange={e =>
              setLifestyle({
                ...lifestyle,
                schedule: { ...lifestyle.schedule, workShift: e.target.value as any },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="day">Day Shift</option>
            <option value="night">Night Shift</option>
            <option value="rotating">Rotating Shifts</option>
            <option value="flexible">Flexible/Remote</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Activity Level</label>
          <select
            value={lifestyle.activity.baseline}
            onChange={e =>
              setLifestyle({
                ...lifestyle,
                activity: { ...lifestyle.activity, baseline: e.target.value as any },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="sedentary">Sedentary (desk job)</option>
            <option value="lightly_active">Lightly Active</option>
            <option value="moderately_active">Moderately Active</option>
            <option value="very_active">Very Active</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Exercise Frequency</label>
          <select
            value={lifestyle.activity.exerciseHabits.frequency}
            onChange={e =>
              setLifestyle({
                ...lifestyle,
                activity: {
                  ...lifestyle.activity,
                  exerciseHabits: {
                    ...lifestyle.activity.exerciseHabits,
                    frequency: e.target.value as any,
                  },
                },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">No Regular Exercise</option>
            <option value="occasional">Occasional</option>
            <option value="1-2x_week">1-2 times/week</option>
            <option value="3-4x_week">3-4 times/week</option>
            <option value="5+_week">5+ times/week</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Gym Access</label>
          <div className="flex space-x-4">
            <button
              onClick={() =>
                setLifestyle({
                  ...lifestyle,
                  activity: {
                    ...lifestyle.activity,
                    exerciseHabits: { ...lifestyle.activity.exerciseHabits, gymAccess: true },
                  },
                })
              }
              className={`px-4 py-2 rounded-lg ${
                lifestyle.activity.exerciseHabits.gymAccess
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() =>
                setLifestyle({
                  ...lifestyle,
                  activity: {
                    ...lifestyle.activity,
                    exerciseHabits: { ...lifestyle.activity.exerciseHabits, gymAccess: false },
                  },
                })
              }
              className={`px-4 py-2 rounded-lg ${
                !lifestyle.activity.exerciseHabits.gymAccess
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              No
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          How much do you cook at home? ({lifestyle.cooking.homeVsRestaurant}%)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="10"
          value={lifestyle.cooking.homeVsRestaurant}
          onChange={e =>
            setLifestyle({
              ...lifestyle,
              cooking: { ...lifestyle.cooking, homeVsRestaurant: parseInt(e.target.value) },
            })
          }
          className="w-full"
        />
        <div className="flex justify-between text-sm text-gray-600">
          <span>All Restaurant</span>
          <span>50/50</span>
          <span>All Home Cooking</span>
        </div>
      </div>
    </div>
  );

  const renderTargetsStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Health Targets & Goals</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Daily Protein Target (g)
          </label>
          <input
            type="number"
            value={targets.protein.target}
            onChange={e =>
              setTargets({
                ...targets,
                protein: { ...targets.protein, target: parseInt(e.target.value) },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="80"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Protein per kg body weight
          </label>
          <input
            type="number"
            step="0.1"
            value={targets.protein.perKg}
            onChange={e =>
              setTargets({
                ...targets,
                protein: { ...targets.protein, perKg: parseFloat(e.target.value) },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="1.2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Daily Steps
          </label>
          <input
            type="number"
            value={targets.steps.minimum}
            onChange={e =>
              setTargets({
                ...targets,
                steps: { ...targets.steps, minimum: parseInt(e.target.value) },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="5000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Target Daily Steps</label>
          <input
            type="number"
            value={targets.steps.target}
            onChange={e =>
              setTargets({
                ...targets,
                steps: { ...targets.steps, target: parseInt(e.target.value) },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="8000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Sleep (hours)
          </label>
          <input
            type="number"
            step="0.5"
            value={targets.sleep.minimumHours}
            onChange={e =>
              setTargets({
                ...targets,
                sleep: { ...targets.sleep, minimumHours: parseFloat(e.target.value) },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="6"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Sleep (hours)
          </label>
          <input
            type="number"
            step="0.5"
            value={targets.sleep.targetHours}
            onChange={e =>
              setTargets({
                ...targets,
                sleep: { ...targets.sleep, targetHours: parseFloat(e.target.value) },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="8"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Daily Water Goal (ml)
          </label>
          <input
            type="number"
            step="250"
            value={targets.hydration.target}
            onChange={e =>
              setTargets({
                ...targets,
                hydration: { ...targets.hydration, target: parseInt(e.target.value) },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="2000"
          />
        </div>
      </div>

      <div>
        <h3 className="font-medium text-gray-900 mb-3">Red Flag Symptoms (auto-escalate)</h3>
        <div className="space-y-2">
          {[
            { key: 'dizziness', label: 'Severe Dizziness' },
            { key: 'severNausea', label: 'Severe Nausea' },
            { key: 'chestPain', label: 'Chest Pain' },
            { key: 'severeWeakness', label: 'Severe Weakness' },
          ].map(flag => (
            <label key={flag.key} className="flex items-center">
              <input
                type="checkbox"
                checked={targets.redFlags[flag.key as keyof typeof targets.redFlags] as boolean}
                onChange={e =>
                  setTargets({
                    ...targets,
                    redFlags: { ...targets.redFlags, [flag.key]: e.target.checked },
                  })
                }
                className="mr-3"
              />
              <span className="text-gray-700">{flag.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPreferencesStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Communication Preferences</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Coaching Tone</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { value: 'coach', label: 'Coach', emoji: '🏆', desc: 'Supportive & instructional' },
            {
              value: 'cheerleader',
              label: 'Cheerleader',
              emoji: '📣',
              desc: 'Enthusiastic & motivating',
            },
            {
              value: 'matter_of_fact',
              label: 'Matter of Fact',
              emoji: '📊',
              desc: 'Direct & data-focused',
            },
            { value: 'tough_love', label: 'Tough Love', emoji: '💪', desc: 'Firm & challenging' },
            { value: 'medical', label: 'Medical', emoji: '🏥', desc: 'Clinical & professional' },
          ].map(tone => (
            <button
              key={tone.value}
              onClick={() => setPreferences({ ...preferences, tone: tone.value as any })}
              className={`p-3 rounded-lg border-2 transition-all ${
                preferences.tone === tone.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-1">{tone.emoji}</div>
              <div className="text-sm font-medium">{tone.label}</div>
              <div className="text-xs text-gray-500">{tone.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Message Frequency</label>
        <select
          value={preferences.communication.frequency}
          onChange={e =>
            setPreferences({
              ...preferences,
              communication: { ...preferences.communication, frequency: e.target.value as any },
            })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="minimal">Minimal (weekly summary)</option>
          <option value="daily">Daily check-ins</option>
          <option value="multiple_daily">Multiple times daily</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Quiet Hours Start</label>
          <input
            type="time"
            value={preferences.communication.quietHours.start}
            onChange={e =>
              setPreferences({
                ...preferences,
                communication: {
                  ...preferences.communication,
                  quietHours: { ...preferences.communication.quietHours, start: e.target.value },
                },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Quiet Hours End</label>
          <input
            type="time"
            value={preferences.communication.quietHours.end}
            onChange={e =>
              setPreferences({
                ...preferences,
                communication: {
                  ...preferences.communication,
                  quietHours: { ...preferences.communication.quietHours, end: e.target.value },
                },
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <h3 className="font-medium text-gray-900 mb-3">Data & Privacy Consent</h3>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.consent.dataSharing}
              onChange={e =>
                setPreferences({
                  ...preferences,
                  consent: { ...preferences.consent, dataSharing: e.target.checked },
                })
              }
              className="mr-3"
            />
            <span className="text-gray-700">Allow sharing data with healthcare provider</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.consent.anonymizedAnalytics}
              onChange={e =>
                setPreferences({
                  ...preferences,
                  consent: { ...preferences.consent, anonymizedAnalytics: e.target.checked },
                })
              }
              className="mr-3"
            />
            <span className="text-gray-700">Contribute anonymized data for research</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (ONBOARDING_STEPS[currentStep].id) {
      case 'demographics':
        return renderDemographicsStep();
      case 'medical':
        return renderMedicalStep();
      case 'dietary':
        return renderDietaryStep();
      case 'lifestyle':
        return renderLifestyleStep();
      case 'targets':
        return renderTargetsStep();
      case 'preferences':
        return renderPreferencesStep();
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Weight Loss Journey Setup
          </h1>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-6">
            {ONBOARDING_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-lg
                  ${
                    index < currentStep
                      ? 'bg-green-500 text-white'
                      : index === currentStep
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }
                `}
                >
                  {index < currentStep ? '✓' : step.emoji}
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div
                    className={`
                    h-1 w-full mx-2
                    ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}
                  `}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}:{' '}
              {ONBOARDING_STEPS[currentStep].title}
            </p>
          </div>
        </div>

        {/* Current Step Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">{renderCurrentStep()}</div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`
              px-8 py-3 rounded-lg font-semibold transition-all
              ${
                currentStep === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
              }
            `}
          >
            Back
          </button>

          <button
            onClick={handleNext}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-blue-700 transition-all shadow-lg"
          >
            {currentStep === ONBOARDING_STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
