import{i as J,u as W,r as n,b as Q,j as s}from"./index-JAW6HvUl.js";import{g as X}from"./patientData.service-CnIeW3dA.js";import{t as L}from"./templateStorage-1vthnjN2.js";function ee(){const{patientId:r}=J(),m=W(),[u,h]=n.useState(!1),[l,y]=n.useState(""),[w,v]=n.useState(""),[g,V]=n.useState(null),[T,k]=n.useState(elevenLabsService.getVoice()),[I,O]=n.useState(!1),[d,C]=n.useState(""),[S,M]=n.useState([]),[p,N]=n.useState(null),[f,j]=n.useState(""),[E,P]=n.useState(!1),[c,$]=n.useState(!1),[i,_]=n.useState(),[D,x]=n.useState("");n.useEffect(()=>{if(r){const e=X(r);if(_(e),e){const t=`PATIENT SUMMARY
====================
Name: ${e.name}
MRN: ${e.mrn}
DOB: ${e.dob}

ACTIVE DIAGNOSES:
${e.diagnosis.map(a=>`• ${a}`).join(`
`)}

CURRENT MEDICATIONS:
${e.medications.map(a=>`• ${a.name} ${a.dosage} - ${a.frequency} (${a.indication})`).join(`
`)}

RECENT LAB RESULTS:
${e.labResults.slice(0,3).map(a=>`• ${a.test}: ${a.value} (Normal: ${a.normal}) - ${a.date}`).join(`
`)}

VITALS (Last Visit):
• BP: ${e.vitalSigns.bp}
• HR: ${e.vitalSigns.hr} bpm
• Temp: ${e.vitalSigns.temp}
• Weight: ${e.vitalSigns.weight}
• BMI: ${e.vitalSigns.bmi}
${e.vitalSigns.glucose?`• Glucose: ${e.vitalSigns.glucose}`:""}

${e.mentalHealth?`MENTAL HEALTH SCREENING:
• PHQ-9 Score: ${e.mentalHealth.phq9Score}
• GAD-7 Score: ${e.mentalHealth.gad7Score}
• Last Screening: ${e.mentalHealth.lastScreening}`:""}

====================
TODAY'S VISIT - ${new Date().toLocaleDateString()}
====================

`;x(t)}}},[r]),n.useEffect(()=>{const e=L.getTemplates();M(e),e.length>0&&!d&&(C(e[0].id),N(e[0]))},[]),n.useEffect(()=>{if(d){const e=S.find(t=>t.id===d);N(e||null)}},[d,S]),n.useEffect(()=>{if("webkitSpeechRecognition"in window||"SpeechRecognition"in window){const e=window.webkitSpeechRecognition||window.SpeechRecognition,t=new e;t.continuous=!0,t.interimResults=!0,t.lang="en-US",t.onresult=a=>{let R="",b="";for(let o=a.resultIndex;o<a.results.length;o++){const A=a.results[o][0].transcript;a.results[o].isFinal?b+=A+" ":R+=A}b?(y(o=>o+b),x(o=>o+b),v("")):v(R)},t.onerror=a=>{Q("DictationPage","Error message",{}),h(!1),elevenLabsService.speak("Speech recognition error. Please try again.")},t.onend=()=>{h(!1)},V(t)}return()=>{g&&g.stop()}},[]);const H=()=>{if(!g){elevenLabsService.speak("Speech recognition not supported in this browser"),alert("Speech recognition not supported in this browser");return}u?(g.stop(),h(!1),v(""),elevenLabsService.speak("Recording stopped")):(g.start(),h(!0),elevenLabsService.speak("Recording started. Please speak clearly."))},B=e=>{k(e),elevenLabsService.setVoice(e),elevenLabsService.testVoice(e)},U=e=>{C(e);const t=S.find(a=>a.id===e);N(t||null),L.trackUsage(e)},Y=async()=>{P(!0),elevenLabsService.speak("Processing with AI using selected template. Please wait.");const e=p;setTimeout(()=>{let t="";e&&e.sections?(t=`**${e.name} - ${new Date().toLocaleDateString()}**
**Patient:** ${i?.name||"Unknown"}
**MRN:** ${i?.mrn||"Unknown"}
**Provider:** Dr. ${localStorage.getItem("doctor_name")||"Provider"}

`,e.sections.chief_complaint&&(t+=`**CHIEF COMPLAINT:**
${e.sections.chief_complaint}${l.slice(0,100)}

`),e.sections.history_present_illness&&(t+=`**HISTORY OF PRESENT ILLNESS:**
${e.sections.history_present_illness}${l.slice(100,300)||"Patient reports symptoms as documented in chief complaint."}

`),e.sections.review_of_systems&&(t+=`**REVIEW OF SYSTEMS:**
${e.sections.review_of_systems}

`),e.sections.past_medical_history&&(t+=`**PAST MEDICAL HISTORY:**
${i?.diagnosis.join(", ")||e.sections.past_medical_history}

`),e.sections.medications&&(t+=`**MEDICATIONS:**
${i?.medications.map(a=>`• ${a.name} ${a.dosage} - ${a.frequency}`).join(`
`)||e.sections.medications}

`),e.sections.allergies&&(t+=`**ALLERGIES:**
${e.sections.allergies}

`),e.sections.physical_exam&&(t+=`**PHYSICAL EXAMINATION:**
${e.sections.physical_exam}
${i?`Current Vitals: BP ${i.vitalSigns.bp}, HR ${i.vitalSigns.hr}, Temp ${i.vitalSigns.temp}`:""}

`),e.sections.assessment&&(t+=`**ASSESSMENT:**
${e.sections.assessment||i?.diagnosis.join(`
`)||"Clinical assessment based on examination"}

`),e.sections.plan&&(t+=`**PLAN:**
${e.sections.plan}
${i?.medications.length?"• Continue current medications":""}
• Follow up as scheduled

`),t+=`**Dictation Notes:**
${l}

**Time:** ${new Date().toLocaleTimeString()}
**Template Used:** ${e.name} (${e.specialty})`):t=`
**SOAP Note - ${new Date().toLocaleDateString()}**
**Patient:** ${i?.name||r}
**MRN:** ${i?.mrn||"Unknown"}

**SUBJECTIVE:**
${l.slice(0,200)||"Patient presents with chief complaint..."}

**OBJECTIVE:**
- Vital Signs: ${i?`BP ${i.vitalSigns.bp}, HR ${i.vitalSigns.hr}, Temp ${i.vitalSigns.temp}`:"See vitals"}
- Current Medications: ${i?.medications.map(a=>a.name).join(", ")||"See medication list"}
- Active Diagnoses: ${i?.diagnosis.join(", ")||"See problem list"}

**ASSESSMENT:**
${i?.diagnosis[0]||"Primary diagnosis"} - stable on current regimen

**PLAN:**
- Continue current medications
- Follow up in 3 months
- Labs: ${i?.labResults[0]?.test||"Routine labs"} at next visit

**Provider:** Dr. ${localStorage.getItem("doctor_name")||"Provider"}
**Time:** ${new Date().toLocaleTimeString()}
      `.trim(),j(t),$(!0),P(!1),elevenLabsService.speak("AI processing complete. Note is ready for review.")},2e3)},F=async()=>{const e=c?f:D+l,t=`visit-${Date.now()}`;localStorage.setItem(t,JSON.stringify({patientId:r,note:e,template:d,templateName:p?.name,timestamp:new Date().toISOString()})),localStorage.setItem("last-visit",t),elevenLabsService.speak("Note saved successfully."),m("/doctor")},G=()=>{const e=localStorage.getItem("last-visit")||"1";m(`/print/${e}`)},q=()=>{const e=localStorage.getItem("last-visit")||"1";m(`/visit-summary/${e}`)};return s.jsxs("div",{className:"min-h-screen bg-gray-50",children:[s.jsx("div",{className:"bg-white shadow-sm border-b",children:s.jsx("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",children:s.jsxs("div",{className:"flex justify-between items-center h-16",children:[s.jsxs("div",{className:"flex items-center space-x-4",children:[s.jsx("button",{onClick:()=>m("/doctor"),className:"text-gray-600 hover:text-gray-900",children:"← Back"}),s.jsx("h1",{className:"text-lg font-semibold",children:"Medical Dictation"}),s.jsx("span",{className:"text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded",children:i?`${i.name} (${i.mrn})`:`Patient ID: ${r}`})]}),s.jsx("button",{onClick:()=>O(!I),className:"px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700",children:"⚙️ Voice Settings"})]})})}),I&&s.jsx("div",{className:"bg-white shadow-lg border-b",children:s.jsx("div",{className:"max-w-4xl mx-auto px-4 py-4",children:s.jsxs("div",{className:"flex items-center space-x-4",children:[s.jsx("label",{className:"text-sm font-medium text-gray-700",children:"Voice:"}),s.jsx("select",{value:T,onChange:e=>B(e.target.value),className:"flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500",children:ELEVENLABS_VOICES.map(e=>s.jsxs("option",{value:e.id,children:[e.name," - ",e.description]},e.id))}),s.jsx("button",{onClick:()=>elevenLabsService.testVoice(T),className:"px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200",children:"🔊 Test"})]})})}),s.jsx("div",{className:"max-w-6xl mx-auto px-4 py-6",children:s.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-6",children:[s.jsx("div",{className:"lg:col-span-1",children:s.jsxs("div",{className:"bg-white rounded-lg shadow-sm p-4 sticky top-4",children:[s.jsx("h3",{className:"text-sm font-semibold mb-3 text-gray-800",children:"Patient Summary"}),i?s.jsxs("div",{className:"space-y-3 text-xs",children:[s.jsxs("div",{children:[s.jsx("p",{className:"font-medium text-gray-600",children:"Demographics"}),s.jsx("p",{children:i.name}),s.jsxs("p",{children:["DOB: ",i.dob]}),s.jsxs("p",{children:["MRN: ",i.mrn]})]}),s.jsxs("div",{children:[s.jsx("p",{className:"font-medium text-gray-600",children:"Active Diagnoses"}),i.diagnosis.map((e,t)=>s.jsxs("p",{className:"text-gray-700",children:["• ",e]},t))]}),s.jsxs("div",{children:[s.jsx("p",{className:"font-medium text-gray-600",children:"Current Medications"}),i.medications.slice(0,5).map((e,t)=>s.jsxs("p",{className:"text-gray-700",children:["• ",e.name," ",e.dosage]},t))]}),s.jsxs("div",{children:[s.jsx("p",{className:"font-medium text-gray-600",children:"Recent Labs"}),i.labResults.slice(0,3).map((e,t)=>s.jsxs("p",{className:"text-gray-700",children:["• ",e.test,": ",e.value]},t))]}),s.jsxs("div",{children:[s.jsx("p",{className:"font-medium text-gray-600",children:"Last Vitals"}),s.jsxs("p",{children:["BP: ",i.vitalSigns.bp]}),s.jsxs("p",{children:["HR: ",i.vitalSigns.hr]}),i.vitalSigns.glucose&&s.jsxs("p",{children:["Glucose: ",i.vitalSigns.glucose]})]})]}):s.jsx("p",{className:"text-gray-500 text-sm",children:"Loading patient data..."})]})}),s.jsxs("div",{className:"lg:col-span-2 space-y-4",children:[s.jsxs("div",{className:"bg-white rounded-lg shadow-sm p-4",children:[s.jsxs("div",{className:"flex items-center space-x-4",children:[s.jsx("label",{className:"text-sm font-medium text-gray-700",children:"Template:"}),s.jsx("select",{value:d,onChange:e=>U(e.target.value),className:"flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",children:S.map(e=>s.jsxs("option",{value:e.id,children:[e.name," - ",e.specialty,e.is_system_template?" (System)":" (Custom)"]},e.id))}),s.jsx("button",{onClick:()=>m("/template-builder"),className:"px-3 py-2 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200",children:"Create Template"})]}),p&&s.jsxs("p",{className:"text-xs text-gray-500 mt-2",children:["Type: ",p.template_type," | Used: ",p.usage_count||0," ","times"]})]}),s.jsxs("div",{className:"bg-white rounded-lg shadow-sm p-4",children:[s.jsxs("div",{className:"flex items-center justify-between mb-3",children:[s.jsx("h2",{className:"text-sm font-semibold",children:"Voice Dictation"}),u&&s.jsxs("div",{className:"flex items-center space-x-2",children:[s.jsx("div",{className:"w-3 h-3 bg-red-500 rounded-full animate-pulse"}),s.jsx("span",{className:"text-sm text-red-600",children:"Recording..."})]})]}),s.jsxs("div",{className:"flex space-x-4",children:[s.jsx("button",{onClick:H,className:`px-6 py-3 rounded-lg font-medium transition ${u?"bg-red-600 text-white hover:bg-red-700":"bg-green-600 text-white hover:bg-green-700"}`,children:u?"⏹ Stop Recording":"🎤 Start Recording"}),s.jsx("button",{onClick:Y,disabled:!l||E,className:"px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed",children:E?"⏳ Processing...":"🤖 Process with AI"})]}),w&&s.jsx("div",{className:"mt-4 p-3 bg-blue-50 rounded-lg",children:s.jsx("p",{className:"text-sm text-blue-700 italic",children:w})})]}),s.jsxs("div",{className:"bg-white rounded-lg shadow-sm p-4",children:[s.jsxs("div",{className:"flex justify-between items-center mb-3",children:[s.jsx("h3",{className:"text-sm font-semibold",children:c?"AI Processed Note":"Note Content (Patient Summary + Today's Dictation)"}),s.jsxs("div",{className:"space-x-2",children:[c&&s.jsx("button",{onClick:()=>$(!1),className:"text-xs text-blue-600 hover:text-blue-700",children:"View Original"}),!c&&l&&s.jsx("button",{onClick:()=>x(e=>e.replace(/TODAY'S VISIT.*$/s,`TODAY'S VISIT - ${new Date().toLocaleDateString()}
====================

`)),className:"text-xs text-red-600 hover:text-red-700",children:"Clear Today's Dictation"})]})]}),s.jsx("textarea",{value:c?f:D,onChange:e=>c?j(e.target.value):x(e.target.value),className:"w-full h-96 p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono",placeholder:"Patient summary will appear here, followed by today's dictation..."})]}),s.jsxs("div",{className:"flex justify-between",children:[s.jsx("div",{className:"space-x-3",children:s.jsx("button",{onClick:()=>{if(y(""),j(""),$(!1),i){const e=`PATIENT SUMMARY
====================
Name: ${i.name}
MRN: ${i.mrn}
DOB: ${i.dob}

ACTIVE DIAGNOSES:
${i.diagnosis.map(t=>`• ${t}`).join(`
`)}

CURRENT MEDICATIONS:
${i.medications.map(t=>`• ${t.name} ${t.dosage} - ${t.frequency} (${t.indication})`).join(`
`)}

====================
TODAY'S VISIT - ${new Date().toLocaleDateString()}
====================

`;x(e)}},className:"px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50",children:"Clear All"})}),s.jsxs("div",{className:"space-x-3",children:[c&&s.jsxs(s.Fragment,{children:[s.jsx("button",{onClick:G,className:"px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700",children:"🖨️ Print Note"}),s.jsx("button",{onClick:q,className:"px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700",children:"📊 Create Summary"})]}),s.jsx("button",{onClick:F,disabled:!l&&!f,className:"px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed",children:"💾 Save & Complete"})]})]})]})]})})]})}export{ee as default};
//# sourceMappingURL=DictationPage-C-oErHH2.js.map
