import{u as S,m as T,r as o,b as g,j as e}from"./index-JAW6HvUl.js";import{w as C}from"./weightLossProfile.service-BCodgXN-.js";import{patientService as d}from"./patient.service-CxaGvQcl.js";function W(){const c=S();T();const[l,x]=o.useState(null),[t,u]=o.useState(null),[p,b]=o.useState(!0),[h,y]=o.useState(!1);o.useEffect(()=>{j()},[]);const j=async()=>{try{const s=d.getCurrentPatient();if(!s){c("/patient-login");return}const a=C.getProfile(s.internalId);if(!a){c("/weightloss/onboarding");return}x(a);const r=await v(a);u(r),N(s.internalId,r)}catch{g("WeightLossOnboardingSummary","Error message",{})}finally{b(!1)}},v=async s=>{const a=`
      Based on this comprehensive weight loss patient profile, create a detailed, personalized weight loss plan.
      
      Patient Profile:
      Demographics:
      - Age: ${s.demographics.age}, ${s.demographics.sex}
      - Height: ${s.demographics.height}cm, Current Weight: ${s.demographics.weight}kg
      - Goal Weight: ${s.demographics.goalWeight}kg
      - Target Date: ${s.demographics.targetDate}
      
      Medical Context:
      - Diagnoses: ${s.medical.diagnoses.join(", ")}
      - Medications: ${s.medical.medications.map(r=>r.name).join(", ")}
      - Recent labs: A1C=${s.medical.recentLabs.a1c}, LDL=${s.medical.recentLabs.ldl}
      
      Dietary Profile:
      - Current Diet Pattern: ${s.dietary.currentDiet}
      - Dietary Restrictions: ${s.dietary.restrictions.join(", ")}
      - Allergies: ${s.dietary.foodsToAvoid.allergies.join(", ")}
      - Preferred Cuisines: ${s.dietary.cuisinePreferences.join(", ")}
      - Eating Out Frequency: ${s.dietary.eatingOutFrequency}
      - Water Intake: ${s.dietary.waterIntake}
      - Alcohol: ${s.dietary.alcoholConsumption}
      
      Lifestyle:
      - Work Schedule: ${s.lifestyle.workSchedule}
      - Activity Level: ${s.lifestyle.activityLevel}
      - Exercise: ${s.lifestyle.exerciseFrequency}
      - Sleep: ${s.lifestyle.sleepHours} hours
      - Stress Level: ${s.lifestyle.stressLevel}
      - Cooking Time: ${s.lifestyle.cookingTime}
      - Travel Frequency: ${s.lifestyle.travelFrequency}
      
      Health Targets:
      - Daily Protein: ${s.targets.dailyProtein}g
      - Daily Steps: ${s.targets.dailySteps}
      - Weekly Exercise: ${s.targets.weeklyExerciseMinutes} minutes
      - Sleep Goal: ${s.targets.sleepHours} hours
      - Water Goal: ${s.targets.waterIntake} glasses
      
      Preferences:
      - Check-in Frequency: ${s.preferences.checkInFrequency}
      - Preferred Time: ${s.preferences.preferredCheckInTime}
      - Notification Style: ${s.preferences.notificationStyle}
      - Motivators: ${s.preferences.motivators.join(", ")}
      - Challenges: ${s.preferences.challenges.join(", ")}
      
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
    `;try{const r=await azureAIService.generateSoapNote(a,"");return JSON.parse(r)}catch{return g("WeightLossOnboardingSummary","Error message",{}),w(s)}},w=s=>{const a=s.demographics.sex==="Male"?10*s.demographics.weight+6.25*s.demographics.height-5*s.demographics.age+5:10*s.demographics.weight+6.25*s.demographics.height-5*s.demographics.age-161,r=Math.round(a*1.2-500);return{dailyCalories:r,proteinTarget:Math.round(s.demographics.weight*1.2),carbTarget:Math.round(r*.4/4),fatTarget:Math.round(r*.3/9),weeklyWeightLossGoal:.5,mealPlan:{breakfast:["Greek yogurt parfait with berries and granola","Veggie omelet with whole grain toast","Overnight oats with protein powder and fruits"],lunch:["Grilled chicken salad with mixed greens","Quinoa bowl with roasted vegetables","Turkey and avocado wrap with side salad"],dinner:["Baked salmon with steamed vegetables","Stir-fry tofu with brown rice","Lean beef with sweet potato and green beans"],snacks:["Apple slices with almond butter","Protein shake with banana","Carrot sticks with hummus"]},exercisePlan:{cardio:["30-minute brisk walk","20-minute cycling","15-minute HIIT workout"],strength:["Upper body resistance training","Lower body bodyweight exercises","Core strengthening"],flexibility:["10-minute morning stretch","15-minute yoga session","5-minute post-workout stretch"],weeklySchedule:"Monday/Wednesday/Friday: Cardio + Strength, Tuesday/Thursday: Flexibility + Light cardio, Weekend: Active rest"},behaviorStrategies:["Track all meals in a food diary","Prepare meals in advance on weekends","Find an accountability partner","Set up regular check-ins with healthcare provider"],milestones:{week2:"Establish consistent meal timing and portion control",month1:`Lose ${Math.round(s.demographics.weight*.02)}kg and build exercise habit`,month3:`Reach ${Math.round(s.demographics.weight*.05)}kg weight loss`,month6:`Achieve ${Math.round(s.demographics.weight*.1)}kg total weight loss`},personalizedTips:["Focus on protein at every meal to maintain muscle mass","Stay hydrated - aim for your target water intake daily","Get adequate sleep to support weight loss hormones","Manage stress through meditation or deep breathing","Celebrate non-scale victories like energy and mood improvements"],warningsAndConcerns:["Monitor blood sugar if diabetic - weight loss may affect medication needs","Watch for signs of too rapid weight loss (fatigue, hair loss, mood changes)"]}},N=(s,a)=>{const r=`weight_loss_plan_${s}`;localStorage.setItem(r,JSON.stringify({plan:a,createdAt:new Date().toISOString(),patientId:s}));const n=d.getCurrentPatient();n&&d.updatePatientProgram(n.internalId,"weightloss",{planGenerated:!0,planGeneratedAt:new Date().toISOString()})},f=()=>{c("/weightloss/dashboard")},k=()=>{if(!t||!l)return;const s=`
PERSONALIZED WEIGHT LOSS PLAN
Generated: ${new Date().toLocaleDateString()}

PATIENT INFORMATION
Name: ${d.getCurrentPatient()?.firstName} ${d.getCurrentPatient()?.lastName}
Current Weight: ${l.demographics.weight}kg
Goal Weight: ${l.demographics.goalWeight}kg
Target Date: ${l.demographics.targetDate}

DAILY NUTRITION TARGETS
Calories: ${t.dailyCalories}
Protein: ${t.proteinTarget}g
Carbohydrates: ${t.carbTarget}g
Fat: ${t.fatTarget}g
Weekly Weight Loss Goal: ${t.weeklyWeightLossGoal}kg

MEAL PLAN
Breakfast Options:
${t.mealPlan.breakfast.map(i=>`• ${i}`).join(`
`)}

Lunch Options:
${t.mealPlan.lunch.map(i=>`• ${i}`).join(`
`)}

Dinner Options:
${t.mealPlan.dinner.map(i=>`• ${i}`).join(`
`)}

Snack Options:
${t.mealPlan.snacks.map(i=>`• ${i}`).join(`
`)}

EXERCISE PLAN
${t.exercisePlan.weeklySchedule}

Cardio Activities:
${t.exercisePlan.cardio.map(i=>`• ${i}`).join(`
`)}

Strength Training:
${t.exercisePlan.strength.map(i=>`• ${i}`).join(`
`)}

Flexibility:
${t.exercisePlan.flexibility.map(i=>`• ${i}`).join(`
`)}

BEHAVIORAL STRATEGIES
${t.behaviorStrategies.map((i,m)=>`${m+1}. ${i}`).join(`
`)}

MILESTONES
• 2 Weeks: ${t.milestones.week2}
• 1 Month: ${t.milestones.month1}
• 3 Months: ${t.milestones.month3}
• 6 Months: ${t.milestones.month6}

PERSONALIZED TIPS
${t.personalizedTips.map((i,m)=>`${m+1}. ${i}`).join(`
`)}

IMPORTANT WARNINGS
${t.warningsAndConcerns.map(i=>`⚠️ ${i}`).join(`
`)}
    `,a=new Blob([s],{type:"text/plain"}),r=window.URL.createObjectURL(a),n=document.createElement("a");n.href=r,n.download="weight_loss_plan.txt",document.body.appendChild(n),n.click(),document.body.removeChild(n),window.URL.revokeObjectURL(r)};if(p)return e.jsx("div",{className:"min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center",children:e.jsxs("div",{className:"text-center",children:[e.jsxs("div",{className:"relative",children:[e.jsx("div",{className:"w-32 h-32 bg-gradient-to-r from-green-400 to-blue-400 rounded-full animate-pulse mx-auto mb-6"}),e.jsx("div",{className:"absolute inset-0 flex items-center justify-center",children:e.jsx("span",{className:"text-5xl",children:"🤖"})})]}),e.jsx("h2",{className:"text-2xl font-bold text-gray-900 mb-4",children:"AI is Creating Your Personalized Plan"}),e.jsx("p",{className:"text-gray-600 max-w-md mx-auto",children:"Analyzing your profile and medical history to create the perfect weight loss strategy..."}),e.jsx("div",{className:"mt-6",children:e.jsx("div",{className:"animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"})})]})});if(!l||!t)return null;const P=l.demographics.weight-l.demographics.goalWeight,$=Math.round(P/t.weeklyWeightLossGoal);return e.jsx("div",{className:"min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6",children:e.jsxs("div",{className:"max-w-6xl mx-auto",children:[e.jsx("div",{className:"bg-white rounded-3xl shadow-xl p-8 mb-6",children:e.jsxs("div",{className:"text-center",children:[e.jsx("div",{className:"inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4",children:e.jsx("span",{className:"text-4xl",children:"✅"})}),e.jsx("h1",{className:"text-3xl font-bold text-gray-900 mb-4",children:"Your Personalized Weight Loss Plan is Ready!"}),e.jsx("p",{className:"text-xl text-gray-600 max-w-2xl mx-auto",children:"Based on your comprehensive profile, we've created a science-backed plan tailored specifically for you. Let's review your roadmap to success."})]})}),e.jsxs("div",{className:"grid md:grid-cols-4 gap-4 mb-6",children:[e.jsxs("div",{className:"bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white",children:[e.jsx("div",{className:"text-3xl mb-2",children:"📊"}),e.jsx("div",{className:"text-2xl font-bold",children:t.dailyCalories}),e.jsx("div",{className:"text-sm opacity-90",children:"Daily Calories"})]}),e.jsxs("div",{className:"bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white",children:[e.jsx("div",{className:"text-3xl mb-2",children:"💪"}),e.jsxs("div",{className:"text-2xl font-bold",children:[t.proteinTarget,"g"]}),e.jsx("div",{className:"text-sm opacity-90",children:"Daily Protein"})]}),e.jsxs("div",{className:"bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white",children:[e.jsx("div",{className:"text-3xl mb-2",children:"⚖️"}),e.jsxs("div",{className:"text-2xl font-bold",children:[t.weeklyWeightLossGoal,"kg"]}),e.jsx("div",{className:"text-sm opacity-90",children:"Weekly Goal"})]}),e.jsxs("div",{className:"bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white",children:[e.jsx("div",{className:"text-3xl mb-2",children:"📅"}),e.jsx("div",{className:"text-2xl font-bold",children:$}),e.jsx("div",{className:"text-sm opacity-90",children:"Weeks to Goal"})]})]}),e.jsxs("div",{className:"bg-white rounded-2xl shadow-lg p-8 mb-6",children:[e.jsxs("div",{className:"flex items-center justify-between mb-6",children:[e.jsx("h2",{className:"text-2xl font-bold text-gray-900",children:"Your Complete Plan"}),e.jsx("button",{onClick:()=>y(!h),className:"text-blue-600 hover:text-blue-700 font-medium",children:h?"Show Summary":"Show Full Details"})]}),h?e.jsxs("div",{className:"space-y-8",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-xl font-bold text-gray-900 mb-4",children:"🥗 Nutrition Plan"}),e.jsx("div",{className:"bg-gray-50 rounded-lg p-4 mb-4",children:e.jsxs("div",{className:"grid grid-cols-4 gap-4 text-center",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-2xl font-bold text-gray-900",children:t.dailyCalories}),e.jsx("div",{className:"text-sm text-gray-600",children:"Calories"})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"text-2xl font-bold text-blue-600",children:[t.proteinTarget,"g"]}),e.jsx("div",{className:"text-sm text-gray-600",children:"Protein"})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"text-2xl font-bold text-green-600",children:[t.carbTarget,"g"]}),e.jsx("div",{className:"text-sm text-gray-600",children:"Carbs"})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"text-2xl font-bold text-orange-600",children:[t.fatTarget,"g"]}),e.jsx("div",{className:"text-sm text-gray-600",children:"Fat"})]})]})}),e.jsxs("div",{className:"grid md:grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("h4",{className:"font-semibold mb-2",children:"🌅 Breakfast"}),e.jsx("ul",{className:"space-y-1 text-gray-700",children:t.mealPlan.breakfast.map((s,a)=>e.jsxs("li",{children:["• ",s]},a))})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"font-semibold mb-2",children:"🥙 Lunch"}),e.jsx("ul",{className:"space-y-1 text-gray-700",children:t.mealPlan.lunch.map((s,a)=>e.jsxs("li",{children:["• ",s]},a))})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"font-semibold mb-2",children:"🍽️ Dinner"}),e.jsx("ul",{className:"space-y-1 text-gray-700",children:t.mealPlan.dinner.map((s,a)=>e.jsxs("li",{children:["• ",s]},a))})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"font-semibold mb-2",children:"🥜 Snacks"}),e.jsx("ul",{className:"space-y-1 text-gray-700",children:t.mealPlan.snacks.map((s,a)=>e.jsxs("li",{children:["• ",s]},a))})]})]})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-xl font-bold text-gray-900 mb-4",children:"🏃‍♀️ Exercise Plan"}),e.jsx("div",{className:"bg-blue-50 rounded-lg p-4 mb-4",children:e.jsx("p",{className:"text-gray-700",children:t.exercisePlan.weeklySchedule})}),e.jsxs("div",{className:"grid md:grid-cols-3 gap-4",children:[e.jsxs("div",{children:[e.jsx("h4",{className:"font-semibold mb-2",children:"❤️ Cardio"}),e.jsx("ul",{className:"space-y-1 text-gray-700",children:t.exercisePlan.cardio.map((s,a)=>e.jsxs("li",{children:["• ",s]},a))})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"font-semibold mb-2",children:"💪 Strength"}),e.jsx("ul",{className:"space-y-1 text-gray-700",children:t.exercisePlan.strength.map((s,a)=>e.jsxs("li",{children:["• ",s]},a))})]}),e.jsxs("div",{children:[e.jsx("h4",{className:"font-semibold mb-2",children:"🧘 Flexibility"}),e.jsx("ul",{className:"space-y-1 text-gray-700",children:t.exercisePlan.flexibility.map((s,a)=>e.jsxs("li",{children:["• ",s]},a))})]})]})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-xl font-bold text-gray-900 mb-4",children:"🧠 Success Strategies"}),e.jsx("div",{className:"space-y-2",children:t.behaviorStrategies.map((s,a)=>e.jsxs("div",{className:"flex items-start",children:[e.jsx("span",{className:"text-green-500 mr-3",children:"✓"}),e.jsx("span",{className:"text-gray-700",children:s})]},a))})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-xl font-bold text-gray-900 mb-4",children:"💡 Personalized Tips"}),e.jsx("div",{className:"grid md:grid-cols-2 gap-3",children:t.personalizedTips.map((s,a)=>e.jsx("div",{className:"bg-yellow-50 rounded-lg p-3 border border-yellow-200",children:e.jsx("span",{className:"text-gray-700",children:s})},a))})]}),t.warningsAndConcerns.length>0&&e.jsxs("div",{children:[e.jsx("h3",{className:"text-xl font-bold text-gray-900 mb-4",children:"⚠️ Important Reminders"}),e.jsx("div",{className:"bg-red-50 rounded-lg p-4 border border-red-200",children:t.warningsAndConcerns.map((s,a)=>e.jsxs("div",{className:"text-red-800 mb-2",children:["• ",s]},a))})]})]}):e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"border-l-4 border-green-500 pl-4",children:[e.jsx("h3",{className:"font-semibold text-lg mb-2",children:"🚀 Quick Start Guide"}),e.jsxs("ul",{className:"space-y-2 text-gray-700",children:[e.jsxs("li",{children:["• Start with ",t.dailyCalories," calories per day"]}),e.jsxs("li",{children:["• Aim for ",t.proteinTarget,"g protein at each meal"]}),e.jsx("li",{children:"• Begin with 3 days of exercise this week"}),e.jsx("li",{children:"• Track your meals and weight daily"})]})]}),e.jsxs("div",{className:"bg-blue-50 rounded-lg p-4",children:[e.jsx("h3",{className:"font-semibold text-lg mb-3",children:"📝 Today's Action Items"}),e.jsx("div",{className:"space-y-2",children:["Download your meal plan","Set up daily reminders","Take starting measurements","Plan tomorrow's meals"].map((s,a)=>e.jsxs("label",{className:"flex items-center space-x-3 cursor-pointer",children:[e.jsx("input",{type:"checkbox",className:"w-5 h-5 text-blue-600"}),e.jsx("span",{className:"text-gray-700",children:s})]},a))})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"font-semibold text-lg mb-3",children:"🎯 Your Milestones"}),e.jsxs("div",{className:"grid md:grid-cols-2 gap-3",children:[e.jsxs("div",{className:"border rounded-lg p-3",children:[e.jsx("div",{className:"font-medium text-blue-600",children:"2 Weeks"}),e.jsx("div",{className:"text-sm text-gray-600",children:t.milestones.week2})]}),e.jsxs("div",{className:"border rounded-lg p-3",children:[e.jsx("div",{className:"font-medium text-green-600",children:"1 Month"}),e.jsx("div",{className:"text-sm text-gray-600",children:t.milestones.month1})]}),e.jsxs("div",{className:"border rounded-lg p-3",children:[e.jsx("div",{className:"font-medium text-purple-600",children:"3 Months"}),e.jsx("div",{className:"text-sm text-gray-600",children:t.milestones.month3})]}),e.jsxs("div",{className:"border rounded-lg p-3",children:[e.jsx("div",{className:"font-medium text-orange-600",children:"6 Months"}),e.jsx("div",{className:"text-sm text-gray-600",children:t.milestones.month6})]})]})]})]})]}),e.jsxs("div",{className:"flex flex-wrap gap-4 justify-center",children:[e.jsx("button",{onClick:f,className:"px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-blue-700 shadow-lg transform hover:scale-105 transition-all",children:"Start Your Journey Now"}),e.jsx("button",{onClick:k,className:"px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 shadow-lg",children:"📥 Download Plan"}),e.jsx("button",{onClick:()=>c("/patient/chat"),className:"px-8 py-4 bg-white border-2 border-purple-500 text-purple-600 font-bold rounded-xl hover:bg-purple-50 shadow-lg",children:"💬 Discuss with AVA"})]}),e.jsxs("div",{className:"mt-12 text-center",children:[e.jsx("p",{className:"text-lg text-gray-600 italic",children:`"Your journey of a thousand miles begins with a single step. You've got this!"`}),e.jsx("p",{className:"text-sm text-gray-500 mt-2",children:"- Your TSHLA Medical Support Team"})]})]})})}export{W as default};
//# sourceMappingURL=WeightLossOnboardingSummary-BBj3oBS8.js.map
