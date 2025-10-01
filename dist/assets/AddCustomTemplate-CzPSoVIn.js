import{u as n,r as i,l as s,j as e}from"./index-CFDQeSWK.js";import{t as a}from"./templateStorage-CeXibu8Z.js";function l(){const t=n();return i.useEffect(()=>{a.createTemplate({name:"My Custom SOAP Template",specialty:"Internal Medicine",template_type:"custom",is_shared:!1,is_system_template:!1,sections:{chief_complaint:"Patient presents today with ",history_present_illness:"The patient is a [age] year old [gender] who reports ",review_of_systems:`Constitutional: Denies fever, chills, weight loss
Cardiovascular: Denies chest pain
Respiratory: Denies shortness of breath`,past_medical_history:"Significant for ",medications:`Current medications:
`,allergies:"No known drug allergies",social_history:"Social history is significant for ",family_history:"Family history is notable for ",physical_exam:`Vital Signs: BP ___, HR ___, RR ___, Temp ___, O2 Sat ___
General: Well-appearing, no acute distress
HEENT: Normocephalic, atraumatic
Cardiovascular: Regular rate and rhythm
Pulmonary: Clear to auscultation bilaterally
Abdomen: Soft, non-tender, non-distended
Extremities: No edema
Neurological: Alert and oriented x3`,assessment:`Assessment:
1. `,plan:`Plan:
1. 
2. 
3. Follow up in `},quick_phrases:["No acute distress","Well-appearing","Regular rate and rhythm","Clear bilaterally","Soft, non-tender"]}),s("AddCustomTemplate","Debug message",{}),a.createTemplate({name:"Custom Pump Evaluation",specialty:"Endocrinology",template_type:"pump_custom",is_shared:!0,is_system_template:!1,sections:{chief_complaint:"Insulin pump evaluation and adjustment",history_present_illness:"Patient with Type 1 DM on pump therapy. Current pump: [model]. Settings review: ",review_of_systems:"Glucose control: Average BG ___, Time in range ___%, Episodes of hypoglycemia: ___, Episodes of hyperglycemia: ___",medications:`Insulin pump with current settings:
- Basal rates: ___
- I:C ratios: ___
- ISF: ___
- Target BG: ___`,physical_exam:`Pump site inspection: No signs of infection or lipodystrophy
Skin: No rashes or irritation at infusion sites`,assessment:`Type 1 Diabetes Mellitus on insulin pump therapy
Glycemic control: [Well controlled/Suboptimal/Poor]`,plan:`Pump adjustments:
- Basal rate changes: 
- I:C ratio changes: 
- ISF changes: 
- Continue CGM monitoring
- Follow up in 3 months`},macros:{tir:"Time in range: __%, Time below range: __%, Time above range: __%",settings:"Basal: ___ u/hr, I:C: 1:___, ISF: 1:___"}}),s("AddCustomTemplate","Debug message",{}),alert("Custom templates added successfully! Redirecting to doctor dashboard..."),setTimeout(()=>{t("/doctor")},2e3)},[t]),e.jsx("div",{className:"min-h-screen bg-gray-50 flex items-center justify-center",children:e.jsxs("div",{className:"text-center",children:[e.jsx("h2",{className:"text-2xl font-bold mb-4",children:"Adding Custom Templates..."}),e.jsx("p",{className:"text-gray-600",children:"Templates have been added to your localStorage."}),e.jsx("p",{className:"text-gray-600 mt-2",children:"Redirecting to dashboard..."})]})})}export{l as default};
//# sourceMappingURL=AddCustomTemplate-CzPSoVIn.js.map
