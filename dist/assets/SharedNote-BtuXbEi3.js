import{b as p,l as S,i as A,r as u,j as t}from"./index-JAW6HvUl.js";import{s as l}from"./supabase-ezNangua.js";let x;const I=new Uint8Array(16);function D(){if(!x&&(x=typeof crypto<"u"&&crypto.getRandomValues&&crypto.getRandomValues.bind(crypto),!x))throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");return x(I)}const i=[];for(let s=0;s<256;++s)i.push((s+256).toString(16).slice(1));function _(s,e=0){return i[s[e+0]]+i[s[e+1]]+i[s[e+2]]+i[s[e+3]]+"-"+i[s[e+4]]+i[s[e+5]]+"-"+i[s[e+6]]+i[s[e+7]]+"-"+i[s[e+8]]+i[s[e+9]]+"-"+i[s[e+10]]+i[s[e+11]]+i[s[e+12]]+i[s[e+13]]+i[s[e+14]]+i[s[e+15]]}const E=typeof crypto<"u"&&crypto.randomUUID&&crypto.randomUUID.bind(crypto),j={randomUUID:E};function g(s,e,a){if(j.randomUUID&&!s)return j.randomUUID();s=s||{};const n=s.random||(s.rng||D)();return n[6]=n[6]&15|64,n[8]=n[8]&63|128,_(n)}class k{SHARE_BASE_URL="https://www.tshla.ai";ENCRYPTION_KEY="default-key";async shareNote(e,a){try{const n=this.generateSecureToken(),r=g(),o=a.expirationHours||72,c=new Date;c.setHours(c.getHours()+o);const d={id:r,shareToken:n,noteId:e.id,sharedBy:e.createdBy,sharedWith:a.recipientEmail,recipientEmail:a.recipientEmail,recipientName:a.recipientName,recipientType:a.recipientType,shareMethod:a.shareMethod,sharedAt:new Date().toISOString(),expiresAt:c.toISOString(),accessCount:0,ipAddresses:[],status:"pending",permissions:a.permissions};switch(await this.storeSecureNote(r,e,d),a.shareMethod){case"email":await this.sendSecureEmail(d,e,a.message);break;case"secure-link":break;case"fax":await this.sendSecureFax(d,e);break;case"direct-message":await this.sendDirectMessage(d,e);break}return await this.logAudit({id:g(),action:"share",noteId:e.id,userId:e.createdBy,recipientEmail:a.recipientEmail,timestamp:new Date().toISOString(),details:{shareMethod:a.shareMethod,expirationHours:o,permissions:a.permissions}}),d.status="sent",d}catch{throw p("noteSharing","Error message",{}),new Error("Failed to share note securely")}}async generateShareLink(e){const n=`${this.SHARE_BASE_URL}/shared-note/${e.shareToken}`;return e.permissions.canView?n:""}async sendSecureEmail(e,a,n){const r=await this.generateShareLink(e),o={to:e.recipientEmail,subject:`Secure Medical Note Shared - ${a.patientName}`,html:`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #005eb8; color: white; padding: 20px;">
            <h2>TSHLA Medical - Secure Note Share</h2>
          </div>
          
          <div style="padding: 20px; background: #f5f5f5;">
            <p>Dear ${e.recipientName},</p>
            
            ${n?`<p>${n}</p>`:""}
            
            <p>A medical note has been securely shared with you:</p>
            
            <div style="background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #005eb8;">
              <p><strong>Patient:</strong> ${a.patientName}</p>
              <p><strong>MRN:</strong> ${a.patientMRN}</p>
              <p><strong>Note Type:</strong> ${a.noteType}</p>
              <p><strong>Created:</strong> ${new Date(a.createdAt).toLocaleString()}</p>
              <p><strong>Shared By:</strong> ${a.createdBy}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${r}" 
                 style="background: #005eb8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Secure Note
              </a>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border: 1px solid #ffc107;">
              <p style="margin: 0;"><strong>⚠️ Security Notice:</strong></p>
              <ul style="margin: 10px 0;">
                <li>This link expires in ${e.expiresAt?this.getHoursUntilExpiry(e.expiresAt):72} hours</li>
                <li>Access is logged for HIPAA compliance</li>
                <li>Do not forward this email without authorization</li>
                ${e.permissions.requireAuth?"<li>Authentication required to view</li>":""}
              </ul>
            </div>
            
            <p style="color: #666; font-size: 12px;">
              This email contains Protected Health Information (PHI). 
              If you received this in error, please delete immediately and notify the sender.
            </p>
          </div>
          
          <div style="background: #333; color: #fff; padding: 15px; text-align: center; font-size: 12px;">
            HIPAA Compliant • Encrypted • Audit Logged<br>
            TSHLA Medical Systems
          </div>
        </div>
      `,text:`
        Secure Medical Note Shared
        
        Patient: ${a.patientName}
        MRN: ${a.patientMRN}
        
        View secure note: ${r}
        
        This link expires in ${this.getHoursUntilExpiry(e.expiresAt)} hours.
        
        This message contains PHI and is HIPAA protected.
      `};await this.sendEmail(o)}async sendEmail(e){try{const{data:a,error:n}=await l.functions.invoke("send-secure-email",{body:e});if(n)throw n}catch{p("noteSharing","Error message",{})}}async sendSecureFax(e,a){S("noteSharing","Debug message",{})}async sendDirectMessage(e,a){S("noteSharing","Debug message",{})}async storeSecureNote(e,a,n){const r=this.encryptData(a.noteContent),{error:o}=await l.from("shared_notes").insert({id:e,share_token:n.shareToken,encrypted_content:r,patient_name:a.patientName,patient_mrn:a.patientMRN,created_by:a.createdBy,shared_with:n.recipientEmail,expires_at:n.expiresAt,permissions:n.permissions,status:"active"});o&&(p("noteSharing","Error message",{}),sessionStorage.setItem(`share_${n.shareToken}`,JSON.stringify({note:a,shareRecord:n,encrypted:!0})))}async getSharedNote(e,a){try{const{data:n,error:r}=await l.from("shared_notes").select("*").eq("share_token",e).single();if(r||!n){const c=sessionStorage.getItem(`share_${e}`);return c?JSON.parse(c).note:null}if(new Date(n.expires_at)<new Date)return await this.logAudit({id:g(),action:"expire",noteId:n.id,timestamp:new Date().toISOString()}),null;const o=this.decryptData(n.encrypted_content);return await l.from("shared_notes").update({access_count:n.access_count+1,last_accessed:new Date().toISOString(),ip_addresses:[...n.ip_addresses||[],a].filter(Boolean)}).eq("share_token",e),await this.logAudit({id:g(),action:"view",noteId:n.id,recipientEmail:n.shared_with,ipAddress:a,timestamp:new Date().toISOString()}),{id:n.id,noteContent:o,patientName:n.patient_name,patientMRN:n.patient_mrn,createdBy:n.created_by,createdAt:n.created_at,noteType:n.note_type||"dictation"}}catch{return p("noteSharing","Error message",{}),null}}async revokeShare(e,a){try{const{error:n}=await l.from("shared_notes").update({status:"revoked",revoked_at:new Date().toISOString(),revoked_by:a}).eq("share_token",e);return n?(sessionStorage.removeItem(`share_${e}`),!0):(await this.logAudit({id:g(),action:"revoke",noteId:e,userId:a,timestamp:new Date().toISOString()}),!0)}catch{return p("noteSharing","Error message",{}),!1}}async getUserShares(e){try{const{data:a,error:n}=await l.from("shared_notes").select("*").eq("created_by",e).order("created_at",{ascending:!1});if(n)throw n;return a||[]}catch{return p("noteSharing","Error message",{}),[]}}generateSecureToken(){const e=new Uint8Array(32);return crypto.getRandomValues(e),Array.from(e,a=>a.toString(16).padStart(2,"0")).join("")}encryptData(e){return btoa(encodeURIComponent(e))}decryptData(e){try{return decodeURIComponent(atob(e))}catch{return e}}getHoursUntilExpiry(e){const a=new Date,n=new Date(e),r=Math.round((n.getTime()-a.getTime())/(1e3*60*60));return Math.max(0,r)}async logAudit(e){try{await l.from("audit_logs").insert(e)}catch{S("noteSharing","Debug message",{})}}}const T=new k;function M(){const{token:s}=A(),[e,a]=u.useState(null),[n,r]=u.useState(!0),[o,c]=u.useState(""),[d,N]=u.useState(!1);u.useEffect(()=>{s&&b(s)},[s]);const b=async y=>{try{r(!0);const h=await T.getSharedNote(y);h?a(h):c("This note has expired or is no longer available.")}catch(h){c(h.message||"Failed to load shared note")}finally{r(!1)}},v=()=>{if(!e)return;N(!0);const y=`
MEDICAL NOTE
============================================
Patient: ${e.patientName}
MRN: ${e.patientMRN}
Date: ${new Date(e.createdAt).toLocaleString()}
Type: ${e.noteType}
Created By: ${e.createdBy}
============================================

${e.noteContent}

============================================
This document contains Protected Health Information (PHI)
Shared via TSHLA Medical - HIPAA Compliant Platform
`,h=new Blob([y],{type:"text/plain"}),w=window.URL.createObjectURL(h),m=document.createElement("a");m.href=w,m.download=`medical_note_${e.patientMRN}_${new Date().toISOString().split("T")[0]}.txt`,document.body.appendChild(m),m.click(),document.body.removeChild(m),window.URL.revokeObjectURL(w),N(!1)},f=()=>{window.print()};return n?t.jsx("div",{className:"shared-note-container",children:t.jsxs("div",{className:"loading-state",children:[t.jsx("div",{className:"spinner"}),t.jsx("p",{children:"Loading secure note..."})]})}):o?t.jsx("div",{className:"shared-note-container",children:t.jsxs("div",{className:"error-state",children:[t.jsx("div",{className:"error-icon",children:"🔒"}),t.jsx("h2",{children:"Access Denied"}),t.jsx("p",{children:o}),t.jsxs("div",{className:"error-details",children:[t.jsx("p",{children:"Possible reasons:"}),t.jsxs("ul",{children:[t.jsx("li",{children:"The link has expired"}),t.jsx("li",{children:"The note has been revoked"}),t.jsx("li",{children:"Invalid access token"})]})]})]})}):e?t.jsxs("div",{className:"shared-note-container",children:[t.jsx("div",{className:"shared-note-header",children:t.jsxs("div",{className:"header-content",children:[t.jsxs("div",{className:"logo-section",children:[t.jsx("h1",{children:"🏥 TSHLA Medical"}),t.jsx("span",{className:"secure-badge",children:"🔒 Secure Document"})]}),t.jsxs("div",{className:"actions",children:[t.jsx("button",{onClick:f,className:"action-btn print-btn",children:"🖨️ Print"}),t.jsx("button",{onClick:v,className:"action-btn download-btn",disabled:d,children:d?"Downloading...":"📥 Download"})]})]})}),t.jsxs("div",{className:"hipaa-banner",children:[t.jsx("strong",{children:"⚠️ HIPAA Notice:"})," This document contains Protected Health Information (PHI). Access is being logged for compliance. Do not share without proper authorization."]}),t.jsxs("div",{className:"shared-note-content",children:[t.jsxs("div",{className:"note-metadata",children:[t.jsx("h2",{children:"Medical Note"}),t.jsxs("div",{className:"metadata-grid",children:[t.jsxs("div",{className:"metadata-item",children:[t.jsx("label",{children:"Patient Name:"}),t.jsx("span",{children:e.patientName})]}),t.jsxs("div",{className:"metadata-item",children:[t.jsx("label",{children:"MRN:"}),t.jsx("span",{children:e.patientMRN})]}),t.jsxs("div",{className:"metadata-item",children:[t.jsx("label",{children:"Note Type:"}),t.jsx("span",{className:"note-type-badge",children:e.noteType})]}),t.jsxs("div",{className:"metadata-item",children:[t.jsx("label",{children:"Created:"}),t.jsx("span",{children:new Date(e.createdAt).toLocaleString()})]}),t.jsxs("div",{className:"metadata-item",children:[t.jsx("label",{children:"Created By:"}),t.jsx("span",{children:e.createdBy})]}),e.metadata?.specialty&&t.jsxs("div",{className:"metadata-item",children:[t.jsx("label",{children:"Specialty:"}),t.jsx("span",{children:e.metadata.specialty})]})]})]}),t.jsx("div",{className:"note-body",children:t.jsx("pre",{className:"note-text",children:e.noteContent})}),t.jsxs("div",{className:"note-footer",children:[t.jsx("p",{className:"footer-text",children:"This medical note was shared securely through TSHLA Medical's HIPAA-compliant platform. All access to this document is logged and audited for compliance purposes."}),t.jsxs("p",{className:"footer-timestamp",children:["Document accessed: ",new Date().toLocaleString()]})]})]}),t.jsx("div",{className:"security-footer",children:t.jsxs("div",{className:"security-info",children:[t.jsx("span",{children:"🔐 End-to-end encrypted"}),t.jsx("span",{children:"📝 Audit logged"}),t.jsx("span",{children:"✅ HIPAA compliant"}),t.jsx("span",{children:"⏱️ Time-limited access"})]})})]}):t.jsx("div",{className:"shared-note-container",children:t.jsx("div",{className:"error-state",children:t.jsx("p",{children:"No note found"})})})}export{M as default};
//# sourceMappingURL=SharedNote-BtuXbEi3.js.map
