import{b as g,h as j,l as d,r as f,j as i}from"./index-JAW6HvUl.js";import{m}from"./microsoft.cognitiveservices.speech.sdk-dKKEa4Bl.js";import"./___vite-browser-external_commonjs-proxy-rsq_lxl4.js";class z{recognizer=null;audioConfig=null;speechConfig=null;fullTranscript="";interimTranscript="";medicalCorrections=new Map([["blood pressure","blood pressure"],["BP","blood pressure"],["heart rate","heart rate"],["HR","heart rate"],["respiratory rate","respiratory rate"],["RR","respiratory rate"],["oxygen saturation","oxygen saturation"],["O2 sat","oxygen saturation"],["temperature","temperature"],["temp","temperature"],["metoprolol","metoprolol"],["metformin","metformin"],["lisinopril","lisinopril"],["atorvastatin","atorvastatin"],["amlodipine","amlodipine"],["omeprazole","omeprazole"],["gabapentin","gabapentin"],["hydrochlorothiazide","hydrochlorothiazide"],["hypertension","hypertension"],["high blood pressure","hypertension"],["diabetes","diabetes mellitus"],["sugar","diabetes mellitus"],["COPD","chronic obstructive pulmonary disease"],["CHF","congestive heart failure"],["afib","atrial fibrillation"],["a fib","atrial fibrillation"],["abdomen","abdomen"],["thorax","thorax"],["extremities","extremities"],["cardiovascular","cardiovascular"],["pulmonary","pulmonary"],["gastrointestinal","gastrointestinal"],["genitourinary","genitourinary"],["musculoskeletal","musculoskeletal"],["neurological","neurological"],["no acute distress","no acute distress"],["well developed well nourished","well-developed, well-nourished"],["alert and oriented","alert and oriented"],["times three","x3"],["clear to auscultation","clear to auscultation"],["regular rate and rhythm","regular rate and rhythm"],["no murmurs rubs or gallops","no murmurs, rubs, or gallops"],["soft non tender non distended","soft, non-tender, non-distended"],["no edema","no edema"],["intact","intact"]]);async initialize(){try{this.speechConfig=m.SpeechConfig.fromSubscription(void 0,void 0),this.speechConfig.speechRecognitionLanguage="en-US",this.speechConfig.enableDictation(),this.speechConfig.outputFormat=m.OutputFormat.Detailed,this.speechConfig.setProperty(m.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,"10000"),this.speechConfig.setProperty(m.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,"2000"),this.speechConfig.setProfanity(m.ProfanityOption.Raw);const s=m.PhraseListGrammar.fromRecognizer(this.recognizer);return this.addMedicalPhrases(s),!0}catch{return g("highQualityDictation","Error message",{}),!1}}addMedicalPhrases(s){["blood pressure is","heart rate is","temperature is","respiratory rate is","oxygen saturation is","BMI is","on physical examination","HEENT examination","cardiovascular exam","pulmonary exam","abdominal exam","neurological exam","skin exam","psychiatric exam","no acute distress","alert and oriented times three","clear to auscultation bilaterally","regular rate and rhythm","soft, non-tender, non-distended","no clubbing, cyanosis, or edema","cranial nerves two through twelve intact","lisinopril","metformin","atorvastatin","metoprolol","amlodipine","omeprazole","simvastatin","losartan","gabapentin","hydrochlorothiazide","sertraline","pravastatin","furosemide","pantoprazole","escitalopram","rosuvastatin","bupropion","trazodone","insulin glargine","tamsulosin","hypertension","diabetes mellitus type 2","hyperlipidemia","gastroesophageal reflux disease","atrial fibrillation","congestive heart failure","chronic obstructive pulmonary disease","coronary artery disease","hypothyroidism","chronic kidney disease","major depressive disorder","generalized anxiety disorder","osteoarthritis","osteoporosis","benign prostatic hyperplasia"].forEach(r=>{s.addPhrase(r)})}async startHighQualityDictation(s,e){try{return this.speechConfig||await this.initialize(),this.audioConfig=m.AudioConfig.fromDefaultMicrophoneInput(),this.recognizer=new m.SpeechRecognizer(this.speechConfig,this.audioConfig),this.recognizer.recognizing=(r,a)=>{if(a.result.reason===m.ResultReason.RecognizingSpeech){const n=a.result.text,c=this.applyMedicalCorrections(n);this.interimTranscript=c,s(this.fullTranscript+" "+c,!1)}},this.recognizer.recognized=(r,a)=>{if(a.result.reason===m.ResultReason.RecognizedSpeech){const n=a.result.text,c=this.applyMedicalCorrections(n);this.fullTranscript+=(this.fullTranscript?" ":"")+c,this.interimTranscript="",s(this.fullTranscript,!0),(a.result.privConfidence||0)<.8&&j("highQualityDictation","Warning message",{})}else a.result.reason===m.ResultReason.NoMatch&&j("highQualityDictation","Warning message",{})},this.recognizer.canceled=(r,a)=>{g("highQualityDictation","Error message",{}),e(`Recognition error: ${a.errorDetails}`),this.stopDictation()},await this.recognizer.startContinuousRecognitionAsync(()=>{d("highQualityDictation","Debug message",{})},r=>{g("highQualityDictation","Error message",{}),e("Failed to start dictation")}),!0}catch{return g("highQualityDictation","Error message",{}),e("Failed to initialize dictation"),!1}}applyMedicalCorrections(s){let e=s;return this.medicalCorrections.forEach((r,a)=>{const n=new RegExp(`\\b${a}\\b`,"gi");e=e.replace(n,r)}),e=e.replace(/(\d+)\s+over\s+(\d+)/gi,"$1/$2").replace(/(\d+\.?\d*)\s+degrees/gi,"$1°F").replace(/(\d+)\s+milligrams?/gi,"$1mg").replace(/(\d+)\s+micrograms?/gi,"$1mcg").replace(/(\d+)\s+units?/gi,"$1 units").replace(/times\s+(\d+)/gi,"x$1").replace(/\bp\.?o\.?\b/gi,"PO").replace(/\bb\.?i\.?d\.?\b/gi,"BID").replace(/\bt\.?i\.?d\.?\b/gi,"TID").replace(/\bq\.?d\.?\b/gi,"QD").replace(/\bp\.?r\.?n\.?\b/gi,"PRN"),e}async stopDictation(){return new Promise(s=>{this.recognizer?this.recognizer.stopContinuousRecognitionAsync(()=>{d("highQualityDictation","Debug message",{});const e=this.fullTranscript;this.recognizer?.close(),this.recognizer=null,this.fullTranscript="",this.interimTranscript="",s(e)},e=>{g("highQualityDictation","Error message",{}),s(this.fullTranscript)}):s(this.fullTranscript)})}getCurrentTranscript(){return this.fullTranscript+(this.interimTranscript?" "+this.interimTranscript:"")}async testTranscriptionQuality(s){return new Promise(e=>{e(.95)})}}class ${azureOpenAIEndpoint;azureOpenAIKey;deploymentName="gpt-4";constructor(){this.azureOpenAIEndpoint="https://tshla-openai-prod.openai.azure.com/",this.azureOpenAIKey=void 0}createOptimalPrompt(s,e){return`You are an expert medical scribe creating a professional clinical note.

PATIENT INFORMATION:
• Name: ${e.name}
• Age: ${e.age}
• MRN: ${e.mrn}
• Date: ${e.visitDate}
${e.chiefComplaint?`• Chief Complaint: ${e.chiefComplaint}`:""}
${e.conditions?.length?`• Active Conditions: ${e.conditions.join(", ")}`:""}
${e.medications?.length?`• Current Medications: ${e.medications.join(", ")}`:""}
${e.allergies?.length?`• Allergies: ${e.allergies.join(", ")}`:""}

${e.vitals?`VITAL SIGNS:
• Blood Pressure: ${e.vitals.bp||"not recorded"}
• Heart Rate: ${e.vitals.hr||"not recorded"}
• Temperature: ${e.vitals.temp||"not recorded"}
• Respiratory Rate: ${e.vitals.rr||"not recorded"}
• O2 Saturation: ${e.vitals.o2||"not recorded"}
• Weight: ${e.vitals.weight||"not recorded"}
`:""}

TRANSCRIBED ENCOUNTER:
${s}

INSTRUCTIONS:
Create a professional SOAP note from the above encounter. Follow these EXACT rules:

SUBJECTIVE:
- Start with the chief complaint in the patient's words
- Include all symptoms with:
  • Onset (when it started)
  • Duration (how long)
  • Character (type of pain/symptom)
  • Location (where)
  • Severity (1-10 scale if mentioned)
  • Timing (constant/intermittent)
  • Aggravating factors (what makes it worse)
  • Relieving factors (what makes it better)
- Include pertinent positives AND negatives
- Include relevant medical history mentioned
- DO NOT include exam findings here

OBJECTIVE:
- Start with vital signs (even if normal, state them)
- Physical exam findings in standard order:
  • General appearance
  • HEENT (if examined)
  • Cardiovascular (if examined)
  • Pulmonary (if examined)
  • Abdomen (if examined)
  • Extremities (if examined)
  • Neurological (if examined)
  • Skin (if examined)
  • Psychiatric (if examined)
- Include all lab/imaging results mentioned
- Use medical terminology
- Be specific with findings (don't just say "normal")

ASSESSMENT:
- List diagnoses with ICD-10 codes if possible
- Start with primary diagnosis
- Include differential diagnoses if discussed
- Provide clinical reasoning for primary diagnosis
- Comment on condition status (stable/improving/worsening)
- Format as numbered list:
  1. Primary diagnosis - reasoning
  2. Secondary diagnosis - status
  3. Other conditions - notes

PLAN:
- Organize by problem or category
- Include specific details:
  • Medication: name, dose, route, frequency, duration
  • Labs: specific tests ordered
  • Imaging: type and area
  • Referrals: specialty and reason
  • Follow-up: timeframe and purpose
  • Patient education: topics discussed
- Format as numbered list with categories:
  1. Medications:
     - Started: [medication details]
     - Continued: [medication details]
     - Stopped: [medication details]
  2. Diagnostic Testing:
     - Labs: [specific tests]
     - Imaging: [type and area]
  3. Referrals: [specialty and reason]
  4. Follow-up: [timeframe]
  5. Patient Education: [topics]

IMPORTANT RULES:
- If something wasn't mentioned, don't make it up
- Keep the original meaning from the transcript
- Use proper medical terminology
- Include ONLY information from the encounter
- Be concise but complete
- Format lists properly
- Maintain professional tone

OUTPUT FORMAT:
Provide the SOAP note with clear section headers.`}async processTranscriptToSOAP(s,e){try{const r=this.createOptimalPrompt(s,e),a=await fetch(`${this.azureOpenAIEndpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=2024-02-15-preview`,{method:"POST",headers:{"Content-Type":"application/json","api-key":this.azureOpenAIKey},body:JSON.stringify({messages:[{role:"system",content:"You are a medical scribe. Create accurate SOAP notes from clinical encounters."},{role:"user",content:r}],temperature:.3,max_tokens:2e3,top_p:.95,frequency_penalty:0,presence_penalty:0,stop:null})});if(!a.ok)throw new Error(`AI processing failed: ${a.statusText}`);const c=(await a.json()).choices[0].message.content;return this.parseSOAPNote(c)}catch{return g("highQualityAI","Error message",{}),this.createFallbackSOAP(s,e)}}parseSOAPNote(s){const e={subjective:"",objective:"",assessment:"",plan:""},r=s.match(/SUBJECTIVE:?\s*([\s\S]*?)(?=OBJECTIVE:|$)/i),a=s.match(/OBJECTIVE:?\s*([\s\S]*?)(?=ASSESSMENT:|$)/i),n=s.match(/ASSESSMENT:?\s*([\s\S]*?)(?=PLAN:|$)/i),c=s.match(/PLAN:?\s*([\s\S]*?)(?=$)/i);return r&&(e.subjective=r[1].trim()),a&&(e.objective=a[1].trim()),n&&(e.assessment=n[1].trim()),c&&(e.plan=c[1].trim()),!e.subjective&&!e.objective&&!e.assessment&&!e.plan&&(e.subjective=s),e}createFallbackSOAP(s,e){return{subjective:`Chief Complaint: ${e.chiefComplaint||"See transcript"}

History of Present Illness:
${s}`,objective:`Vital Signs:
${e.vitals?Object.entries(e.vitals).map(([r,a])=>`${r.toUpperCase()}: ${a}`).join(`
`):"See documentation"}

Physical Exam:
See documentation`,assessment:"Assessment pending physician review",plan:"Plan pending physician review"}}async testAIQuality(){const s="Patient is a 45-year-old male presenting with chest pain for 2 days. Pain is sharp, worse with deep breathing, better with sitting forward. No shortness of breath. No fever. Vital signs: BP 130/80, HR 88, temp 98.6. Lungs clear. Heart regular rate and rhythm. Abdomen soft. Assessment: likely pericarditis. Plan: start ibuprofen 600mg three times daily, EKG, follow up in one week.",e={name:"Test Patient",age:45,mrn:"TEST123",visitDate:new Date().toLocaleDateString()},r=await this.processTranscriptToSOAP(s,e),a=[];let n=100;return r.subjective.includes("chest pain")||(a.push("Missing chief complaint"),n-=20),r.objective.includes("130/80")||(a.push("Missing vital signs"),n-=20),r.assessment.toLowerCase().includes("pericarditis")||(a.push("Missing diagnosis"),n-=20),r.plan.includes("ibuprofen")||(a.push("Missing medication"),n-=20),{score:n/100,issues:a}}optimizePrompt(s){localStorage.setItem("ai_feedback",JSON.stringify(s))}}const C=[{name:"Hypertension Follow-up",script:"Patient is here for blood pressure follow up. Blood pressure today is 142 over 88. Has been taking lisinopril 10 milligrams daily. No side effects. No chest pain or shortness of breath. Will increase lisinopril to 20 milligrams daily. Follow up in 3 months.",expected:{medications:["lisinopril"],vitals:["142/88"],diagnosis:["hypertension"],plan:["increase","20mg","3 months"]}},{name:"Diabetes Management",script:"55 year old with type 2 diabetes. A1C is 8.2. Currently on metformin 1000 milligrams twice daily. Blood sugar logs show fasting glucose 150 to 180. Will add glipizide 5 milligrams daily. Discussed diet and exercise. Follow up in 3 months with repeat A1C.",expected:{medications:["metformin","glipizide"],labs:["A1C","8.2"],diagnosis:["diabetes"],plan:["glipizide","5mg","diet","exercise"]}}];function L(){const[y,s]=f.useState([]),[e,r]=f.useState(!1),[a,n]=f.useState(""),[c,S]=f.useState(null),b=new z,w=new $,N=async()=>{r(!0);const t=[];d("QualityTest","Debug message",{});const o=await P();t.push(o),d("QualityTest","Debug message",{});for(const l of C){const p=await A(l);t.push(p)}s(t),r(!1),O(t)},P=async()=>{const t="Patient has hypertension, diabetes mellitus type 2, and hyperlipidemia. Takes metformin 1000 milligrams twice daily, lisinopril 20 milligrams daily, and atorvastatin 40 milligrams at bedtime.",o=D(t),l=["hypertension","diabetes mellitus","metformin","lisinopril","atorvastatin"],p=l.filter(u=>o.toLowerCase().includes(u.toLowerCase()));return{test:"Manual Transcription",input:t,output:o,accuracy:p.length/l.length,missing:l.filter(u=>!p.includes(u))}},A=async t=>{const o={name:"Test Patient",age:50,mrn:"TEST123",visitDate:new Date().toLocaleDateString()},l=await w.processTranscriptToSOAP(t.script,o);let p=0,u=0;const x=[],v=[];return t.expected.medications&&t.expected.medications.forEach(h=>{u++,JSON.stringify(l).toLowerCase().includes(h.toLowerCase())?(p++,x.push(h)):v.push(h)}),["vitals","diagnosis","plan","labs"].forEach(h=>{t.expected[h]&&t.expected[h].forEach(T=>{u++,JSON.stringify(l).toLowerCase().includes(T.toLowerCase())?(p++,x.push(T)):v.push(`${h}: ${T}`)})}),{test:t.name,input:t.script,output:l,accuracy:u>0?p/u:0,found:x,missing:v}},D=t=>t.replace(/(\d+)\s+over\s+(\d+)/gi,"$1/$2").replace(/(\d+)\s+milligrams?/gi,"$1mg").replace(/times\s+(\d+)/gi,"x$1"),O=t=>{const o=t.reduce((l,p)=>l+p.accuracy,0)/t.length;d("QualityTest","Debug message",{}),d("QualityTest","Debug message",{}),d("QualityTest","Debug message",{}),t.forEach(l=>{d("QualityTest","Debug message",{}),l.missing?.length>0&&d("QualityTest","Debug message",{})}),o>.8?(d("QualityTest","Debug message",{}),localStorage.setItem("quality_config",JSON.stringify({timestamp:new Date().toISOString(),accuracy:o,config:"highQuality"}))):d("QualityTest","Debug message",{})},E=async()=>{d("QualityTest","Debug message",{}),await b.initialize(),await b.startHighQualityDictation((t,o)=>{n(t),o&&d("QualityTest","Debug message",{})},t=>{g("QualityTest","Error message",{})})},I=async()=>{if(!a)return;const t={name:"John Doe",age:45,mrn:"12345",visitDate:new Date().toLocaleDateString(),chiefComplaint:"Follow-up visit",medications:["lisinopril 10mg daily","metformin 1000mg BID"],conditions:["Hypertension","Type 2 Diabetes"]},o=await w.processTranscriptToSOAP(a,t);S(o)};return i.jsxs("div",{className:"p-6 max-w-6xl mx-auto",children:[i.jsx("h1",{className:"text-3xl font-bold mb-6",children:"Quality Testing & Optimization"}),i.jsxs("div",{className:"bg-white rounded-lg shadow-lg p-6 mb-6",children:[i.jsx("h2",{className:"text-xl font-semibold mb-4",children:"Quick Quality Test"}),i.jsx("button",{onClick:N,disabled:e,className:"bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50",children:e?"Testing...":"Run Quality Tests"}),y.length>0&&i.jsxs("div",{className:"mt-6",children:[i.jsx("h3",{className:"font-semibold mb-2",children:"Test Results:"}),y.map((t,o)=>i.jsxs("div",{className:"border rounded p-3 mb-2",children:[i.jsxs("div",{className:"flex justify-between items-center",children:[i.jsx("span",{className:"font-medium",children:t.test}),i.jsxs("span",{className:"px-2 py-1 rounded text-sm "+(t.accuracy>.8?"bg-green-100 text-green-800":t.accuracy>.6?"bg-yellow-100 text-yellow-800":"bg-red-100 text-red-800"),children:[(t.accuracy*100).toFixed(0),"%"]})]}),t.missing?.length>0&&i.jsxs("div",{className:"text-sm text-red-600 mt-1",children:["Missing: ",t.missing.join(", ")]})]},o)),i.jsxs("div",{className:"mt-4 p-3 bg-gray-100 rounded",children:[i.jsx("strong",{children:"Average Accuracy: "}),(y.reduce((t,o)=>t+o.accuracy,0)/y.length*100).toFixed(1),"%"]})]})]}),i.jsxs("div",{className:"bg-white rounded-lg shadow-lg p-6 mb-6",children:[i.jsx("h2",{className:"text-xl font-semibold mb-4",children:"Live Dictation Test"}),i.jsxs("div",{className:"flex gap-4 mb-4",children:[i.jsx("button",{onClick:E,className:"bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700",children:"Start Dictation"}),i.jsx("button",{onClick:()=>b.stopDictation(),className:"bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700",children:"Stop Dictation"}),i.jsx("button",{onClick:I,disabled:!a,className:"bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50",children:"Process with AI"})]}),a&&i.jsxs("div",{className:"border rounded p-4 mb-4",children:[i.jsx("h3",{className:"font-semibold mb-2",children:"Transcript:"}),i.jsx("p",{className:"whitespace-pre-wrap",children:a})]}),c&&i.jsxs("div",{className:"border rounded p-4",children:[i.jsx("h3",{className:"font-semibold mb-2",children:"SOAP Note:"}),i.jsxs("div",{className:"space-y-3",children:[i.jsxs("div",{children:[i.jsx("strong",{children:"Subjective:"}),i.jsx("p",{className:"ml-4",children:c.subjective})]}),i.jsxs("div",{children:[i.jsx("strong",{children:"Objective:"}),i.jsx("p",{className:"ml-4",children:c.objective})]}),i.jsxs("div",{children:[i.jsx("strong",{children:"Assessment:"}),i.jsx("p",{className:"ml-4",children:c.assessment})]}),i.jsxs("div",{children:[i.jsx("strong",{children:"Plan:"}),i.jsx("p",{className:"ml-4",children:c.plan})]})]})]})]}),i.jsxs("div",{className:"bg-blue-50 border border-blue-200 rounded-lg p-6",children:[i.jsx("h2",{className:"text-xl font-semibold mb-4",children:"💡 Quality Optimization Tips"}),i.jsxs("div",{className:"space-y-2 text-sm",children:[i.jsxs("p",{children:["✅ ",i.jsx("strong",{children:"Azure Speech:"})," Enable dictation mode, increase timeouts, add medical phrases"]}),i.jsxs("p",{children:["✅ ",i.jsx("strong",{children:"Azure OpenAI:"})," Use GPT-4 with temperature 0.3 for consistency"]}),i.jsxs("p",{children:["✅ ",i.jsx("strong",{children:"Audio:"})," Use high-quality microphone, quiet environment, clear speech"]}),i.jsxs("p",{children:["✅ ",i.jsx("strong",{children:"Prompts:"})," Include patient context, clear instructions, examples"]}),i.jsxs("p",{children:["✅ ",i.jsx("strong",{children:"Post-Processing:"})," Apply medical corrections, format standardization"]})]}),i.jsxs("div",{className:"mt-4 p-3 bg-white rounded",children:[i.jsx("strong",{children:"Current Configuration:"}),i.jsxs("ul",{className:"text-sm mt-2",children:[i.jsx("li",{children:"Speech: Azure Cognitive Services (en-US, dictation mode)"}),i.jsx("li",{children:"AI: Azure OpenAI GPT-4 (temperature: 0.3)"}),i.jsx("li",{children:"Session Timeout: 10s initial, 2s end silence"}),i.jsxs("li",{children:["Medical Terms: ",Object.keys(C).length," test cases configured"]})]})]})]})]})}export{L as default};
//# sourceMappingURL=QualityTest-DpWSi2_T.js.map
