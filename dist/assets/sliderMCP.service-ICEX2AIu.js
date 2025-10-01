import{l,g as f,b as h}from"./index-CFDQeSWK.js";import{o as S}from"./openai.service-CgQn0nV5.js";class y{sessionId="";constructor(){this.sessionId=this.generateSessionId()}generateSessionId(){return`slider_${Date.now()}_${Math.random().toString(36).substr(2,9)}`}generateProfileHash(t,r,s){const e=Object.keys(t).sort().map(o=>`${o}:${t[o]}`).join(","),i=(r||[]).map(o=>o.title||o.id||"").sort().join(","),c=(s||"").toLowerCase().replace(/[^a-z0-9]/g,""),d=`sliders:${e}|features:${i}|story:${c}`;return btoa(d).replace(/[^a-zA-Z0-9]/g,"").substring(0,32)}async saveSliderProfile(t){l("sliderMCP","Debug message",{});const r={sessionId:this.sessionId,responses:Object.entries(t).map(([s,e])=>({sliderId:s,value:e,timestamp:Date.now(),category:s})),profileHash:this.generateProfileHash(t,[],""),createdAt:Date.now()};try{const s=JSON.stringify(r),e={success:!0,profileId:`profile_${Date.now()}`,profileHash:r.profileHash};return f("sliderMCP","Info message",{}),localStorage.setItem(`slider_profile_${e.profileId}`,s),{profileId:e.profileId,profileHash:e.profileHash}}catch{throw h("sliderMCP","Error message",{}),new Error("Failed to save slider profile")}}async getSliderRecommendation(t){l("sliderMCP","Debug message",{});try{const r=this.checkLocalCache(t);return r?(l("sliderMCP","Debug message",{}),r):(l("sliderMCP","Debug message",{}),null)}catch{return h("sliderMCP","Error message",{}),null}}checkLocalCache(t){try{const r=`slider_rec_${t}`,s=localStorage.getItem(r);if(s){const e=JSON.parse(s),i=Date.now()-36e5;if(e.createdAt>i)return e.recommendation}return null}catch{return null}}async generateRecommendation(t,r=[]){l("sliderMCP","Debug message",{});const s=Date.now(),e=this.getFreeTextResponse(),i=this.generateProfileHash(t,r,e);let c=await this.getSliderRecommendation(i);if(c)return{profile:{sessionId:this.sessionId,responses:Object.entries(t).map(([a,n])=>({sliderId:a,value:n,timestamp:Date.now(),category:a})),profileHash:i,createdAt:Date.now()},recommendation:c,cacheKey:i,processingTime:Date.now()-s,source:"cache"};const d=r.length>0?r:this.getSelectedFeatures(),o=sessionStorage.getItem("pumpDriveFreeText"),u=o?JSON.parse(o)?.currentSituation:"",g=this.buildEnhancedAIPrompt(t,d,u);try{const a=await S.processText(g,{model:"gpt-4",temperature:.7,maxTokens:2e3}),n=this.parseAIResponse(a,t);return await this.cacheRecommendation(i,n),{profile:{sessionId:this.sessionId,responses:Object.entries(t).map(([m,p])=>({sliderId:m,value:p,timestamp:Date.now(),category:m})),profileHash:i,createdAt:Date.now()},recommendation:n,cacheKey:i,processingTime:Date.now()-s,source:"ai"}}catch{throw h("sliderMCP","Error message",{}),new Error("Failed to generate pump recommendation")}}getSelectedFeatures(){try{const t=sessionStorage.getItem("selectedPumpFeatures");return t?JSON.parse(t):[]}catch{return[]}}getFreeTextResponse(){try{const t=sessionStorage.getItem("pumpDriveFreeText");return t&&JSON.parse(t).currentSituation||""}catch{return""}}buildEnhancedAIPrompt(t,r,s){let e=`🎯 COMPLETE USER ASSESSMENT - INSULIN PUMP RECOMMENDATION

You are helping a person with diabetes choose the perfect insulin pump based on their complete assessment. Please provide a highly personalized recommendation based on ALL the information below.

CRITICAL ANALYSIS INSTRUCTIONS:
- DO NOT use any pre-calculated scores or ranking biases
- Analyze the patient's responses objectively without any pre-programmed scoring systems
- Base recommendations purely on objective analysis of patient needs against pump specifications

ANALYSIS PRIORITY HIERARCHY:
1. **EXPLICIT FEATURE SELECTIONS**: Features the patient specifically selected carry the highest weight
   - If patient selected "Apple Watch bolusing" → ONLY Twiist supports this (major factor)
   - If patient selected "2 ounces weight" → ONLY Twiist offers this (major factor)
   - If patient selected "swap batteries" → Favor pumps with replaceable batteries
2. **PERSONAL STORY KEYWORDS**: Specific medical/lifestyle needs mentioned in free text
3. **SLIDER PREFERENCES**: General lifestyle ratings are lower priority than explicit selections

CRITICAL PUMP FACTS:
- Apple Watch bolusing: ONLY Twiist supports this feature
- Lightest weight (2 oz): ONLY Twiist offers this
- Tandem Mobi: iPhone-only, no Apple Watch control, not 2 oz
- If patient selected both "Apple Watch" AND "2 oz" features → Twiist should be heavily favored unless major contraindications exist

`;const{activity:i,techComfort:c,simplicity:d,discreteness:o,timeDedication:u}=t;if(e+=`📊 USER'S LIFESTYLE PREFERENCES (1-10 scale):

🏃 Activity Level: ${i}/10
`,i<=3?e+="   → Mostly sedentary, prefers comfort and stability":i>=7?e+="   → Very active lifestyle, needs durable and flexible solutions":e+="   → Moderately active, balanced lifestyle needs",e+=`
📱 Technology Love: ${c}/10
`,c<=3?e+="   → Prefers simple, basic technology with minimal complexity":c>=7?e+="   → Loves technology, early adopter, wants advanced features":e+="   → Comfortable with technology but not obsessed",e+=`
🎛️ Complexity Preference: ${d}/10
`,d<=3?e+="   → Wants simple, straightforward devices with minimal options":d>=7?e+="   → Enjoys advanced features, data, and control options":e+="   → Likes some features but not overwhelming complexity",e+=`
🤫 Privacy/Discreteness: ${o}/10
`,o<=3?e+="   → Device must be completely hidden, very concerned about visibility":o>=7?e+="   → Doesn't care who sees it, function over appearance":e+="   → Prefers discreet but okay if sometimes visible",e+=`
⏰ Time for Device Care: ${u}/10
`,u<=3?e+="   → Wants set-and-forget simplicity with minimal maintenance":u>=7?e+="   → Happy to spend time optimizing and maintaining for best results":e+="   → Willing to do basic maintenance but not excessive work",r.length>0){const g=r.reduce((a,n)=>{const m=n.category||"other";return a[m]||(a[m]=[]),a[m].push(n),a},{});e+=`

⭐ SPECIFIC FEATURES THE USER SELECTED:
The user carefully chose ${r.length} features that appeal to them:

`,Object.entries(g).forEach(([a,n])=>{e+=`${{power:"🔋 Power & Charging",design:"🎨 Design & Size",interface:"📱 Controls & Interface",convenience:"✨ Convenience Features",automation:"🤖 Automation Level"}[a]||a.toUpperCase()}:
`,n.forEach(p=>{e+=`   ${p.emoji} ${p.title} - ${p.description}
`}),e+=`
`}),e+=`🎯 FEATURE ANALYSIS INSTRUCTIONS:
Consider the selected features as important factors in your analysis, but evaluate all pumps objectively. Selected features should influence your recommendation, but not create automatic rankings. Balance feature preferences with other factors like lifestyle, medical needs, and overall suitability.`}else e+=`

⭐ FEATURE SELECTIONS: User did not select specific features, so base recommendation purely on lifestyle preferences.`;return s?.trim()?(e+=`

💭 USER'S PERSONAL STORY & CONTEXT:
"${s.trim()}"

🧠 ANALYSIS INSTRUCTIONS:
1. Identify specific concerns, fears, or challenges mentioned
2. Note what excites them or what they're looking forward to
3. Understand their current situation and pain points
4. Look for hints about their personality and values
5. Address their emotional needs in addition to technical requirements`,s?.toLowerCase().includes("tight")&&s?.toLowerCase().includes("control")&&(e+=`

🚨 CRITICAL: User explicitly wants TIGHTEST CONTROL
This overrides other preferences. Recommend Control-IQ (Tandem) or SmartGuard (Medtronic) as top choices.`)):e+=`

💭 PERSONAL STORY: User chose not to share their personal story.`,e+=`

🤖 RECOMMENDATION INSTRUCTIONS:

Available pumps: Omnipod 5, Tandem t:slim X2, Tandem Mobi, Medtronic 780G, Beta Bionics iLet, Twiist

PUMP SPECIFICATIONS (USE FOR DECISIONS):
Twiist:
- Weight: 2 ounces
- Algorithm: Modern adaptive logic (More aggressive: basal modulations similar to microboluses)
- Frequency: Adjusts every 5 minutes
- Battery: Rechargeable (4 replaceable batteries)
- Tubing: Tubed (compact)
- Water: Water-resistant (splash proof, not submersible)
- Unique: Apple Watch bolusing, Only 2 ounces, Emoji-based bolusing

Omnipod 5:
- Weight: Pod weight (tubeless)
- Algorithm: On-pod adapting algorithm (Continuously learns, uses CGM data)
- Frequency: Adjusts basal insulin delivery every 5 minutes
- Battery: Pod battery (disposable - no charging)
- Tubing: Tubeless pod
- Water: IP28 (Submersible up to 8 feet for up to 60 mins)
- Unique: No tubing, Low pod profile, Activity feature

Tandem t:slim X2:
- Weight: Standard tubed pump
- Algorithm: Control-IQ (MOST AGGRESSIVE, adjusts every 5 minutes)
- Frequency: Every 5 minutes with predictive adjustments
- Battery: Rechargeable
- Tubing: Traditional tubing
- Water: Water-resistant
- Unique: Smartphone integration, Most aggressive control, Advanced data analytics

Medtronic 780G:
- Weight: Standard tubed pump
- Algorithm: SmartGuard (Very aggressive, predictive)
- Frequency: Continuous monitoring with adjustments
- Battery: Rechargeable
- Tubing: Traditional tubing
- Water: Water-resistant
- Unique: Guardian CGM integration, Predictive low glucose suspend

iLet:
- Weight: Standard tubed pump
- Algorithm: Bionic Pancreas (Moderate, meal announcements only)
- Frequency: Adaptive dosing
- Battery: Rechargeable
- Tubing: Traditional tubing
- Water: Standard resistance
- Unique: Minimal user input, Automated dosing decisions

Tandem Mobi:
- Weight: Compact tubed pump
- Algorithm: Control-IQ (same as t:slim X2)
- Frequency: Every 5 minutes
- Battery: Rechargeable
- Tubing: Shorter tubing design
- Water: Water-resistant
- Unique: Smaller form factor, Same advanced algorithm as t:slim X2

CONTROL ALGORITHM RANKINGS (TIGHTEST TO LOOSEST):
1. Tandem Control-IQ (t:slim X2 & Mobi) - Most aggressive, adjusts every 5 minutes
2. Medtronic SmartGuard (780G) - Very aggressive, predictive
3. Omnipod 5 SmartAdjust - Moderate, adjusts every 5 minutes
4. Twiist Modern Logic - Moderate, more aggressive basal modulations
5. iLet Bionic Pancreas - Moderate, meal announcements only

When user wants "tightest control", prioritize pumps 1-2 above.

Please provide a comprehensive recommendation that:
1. 🎯 CONSIDER: Evaluate pumps with selected features favorably, but maintain objective analysis across all options
2. PRIORITIZES all pumps matching their selected features over those that don't
3. CONSIDERS their lifestyle slider preferences
4. ADDRESSES their personal story and concerns (if shared) 
5. EXPLAINS the "why" behind each recommendation
6. PROVIDES actionable next steps

CRITICAL SCORING RULE: Unique features = Automatic top ranking for that pump. No exceptions unless severe contradictions exist.

Respond with JSON in this exact format:
{
  "topPumps": [
    {
      "pumpId": "omnipod5",
      "pumpName": "Omnipod 5",
      "score": 95,
      "matchFactors": ["Perfect for active lifestyle", "Selected tubeless design feature"],
      "sliderInfluence": {"activity": 9, "techComfort": 8, "simplicity": 7, "discreteness": 8, "timeDedication": 9}
    }
  ],
  "personalizedInsights": ["Your high activity score and tubeless feature selection makes Omnipod ideal..."],
  "nextSteps": ["Schedule demo with Omnipod", "Check insurance coverage for tubeless pumps"],
  "confidence": 92
}`,e}buildAIPrompt(t){return this.buildEnhancedAIPrompt(t,[],"")}parseAIResponse(t,r){try{let s=t;if(t.includes("```json")){const i=t.match(/```json\s*([\s\S]*?)\s*```/);i&&(s=i[1])}else if(t.includes("```")){const i=t.match(/```\s*([\s\S]*?)\s*```/);i&&(s=i[1])}const e=JSON.parse(s);return{profileId:this.sessionId,topPumps:e.topPumps||[],personalizedInsights:e.personalizedInsights||[],nextSteps:e.nextSteps||[],confidence:e.confidence||85}}catch(s){throw h("sliderMCP","Error parsing AI response - no fallback available",{error:s}),new Error("Failed to parse AI recommendation. Please try again.")}}checkForWeightPreference(){try{const t=sessionStorage.getItem("pumpDriveFreeText");if(t){const s=JSON.parse(t),e=`${s.currentSituation||""} ${s.concerns||""} ${s.priorities||""}`.toLowerCase();if(e.includes("light")||e.includes("weight")||e.includes("2 oz")||e.includes("ounce")||e.includes("smallest")||e.includes("small")||e.includes("compact"))return l("sliderMCP","Debug message",{}),!0}const r=sessionStorage.getItem("pumpdrive_responses")||sessionStorage.getItem("pumpDriveResponses");if(r){const s=JSON.parse(r),e=Object.values(s).join(" ").toLowerCase();return e.includes("light")||e.includes("smallest")||e.includes("2 oz")}return!1}catch{return!1}}generateFallbackRecommendation(t){throw new Error("Fallback scoring removed. AI recommendation service must be used.")}async cacheRecommendation(t,r){try{const s=`slider_rec_${t}`,e={recommendation:r,createdAt:Date.now()};localStorage.setItem(s,JSON.stringify(e)),l("sliderMCP","Debug message",{})}catch{h("sliderMCP","Error message",{})}}getCacheStats(){return{totalCached:Object.keys(localStorage).filter(r=>r.startsWith("slider_rec_")).length,sessionId:this.sessionId,lastGenerated:Date.now()}}clearAllCache(){l("sliderMCP","Debug message",{}),Object.keys(localStorage).filter(r=>r.startsWith("slider_rec_")||r.startsWith("slider_profile_")).forEach(r=>{localStorage.removeItem(r)}),sessionStorage.removeItem("pumpDriveSliders"),sessionStorage.removeItem("pumpDriveSelectedFeatures"),sessionStorage.removeItem("pumpDriveFreeText"),sessionStorage.removeItem("selectedPumpFeatures"),f("sliderMCP","Info message",{})}}const v=new y;export{v as s};
//# sourceMappingURL=sliderMCP.service-ICEX2AIu.js.map
