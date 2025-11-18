# PCM (Principal Care Management) Dashboard System

**Created:** January 18, 2025
**Version:** 1.0

## Overview

The new PCM Dashboard System provides three super-easy, focused interfaces for managing Principal Care Management (PCM) diabetes care programs:

1. **Patient Dashboard** - Simple interface for patients to track daily tasks and vitals
2. **Provider Dashboard** - Risk-based patient management for physicians
3. **Staff Workflow** - Task-oriented workflow for PCM care coordinators

---

## 🎯 Key Features

### ✅ **Simplified & Mobile-First**
- One-tap actions everywhere
- Visual progress indicators
- Minimal text, maximum clarity
- Designed for phone screens

### ✅ **Real-Time Tracking**
- Daily task completion
- Vital sign logging (blood sugar, weight, BP)
- Medication adherence monitoring
- PCM time tracking for billing compliance

### ✅ **Risk-Based Management**
- Color-coded patient risk levels (🔴 High, 🟡 Medium, 🟢 Low)
- Automatic overdue alerts
- Smart sorting and filtering
- Quick contact actions

### ✅ **Billing Compliance**
- Built-in time tracker
- 30-minute monthly requirement tracking
- Activity type documentation
- Automated reporting

---

## 📱 Patient Dashboard

**URL:** `/pcm/patient`

### What Patients See

#### 1. **Today's Progress Card**
- Visual progress bar showing daily task completion
- Clear count of completed vs total tasks
- Color-coded: Green (80%+), Yellow (50-79%), Red (<50%)

#### 2. **Quick Actions (2 Big Buttons)**
- **Log Vitals** - One-tap access to vital entry
- **Message Care Team** - Direct communication

#### 3. **Today's Actions Checklist**
- Large, tappable checkboxes
- 5-6 daily tasks:
  - ✅ Check blood sugar before breakfast
  - ✅ Take all prescribed medications
  - ✅ Exercise for 30 minutes
  - ✅ Log meals and carb intake
  - ✅ Check feet for any issues

#### 4. **Your Numbers at a Glance**
- Three large cards showing:
  - Blood Sugar (with target indicator)
  - Weight (with goal)
  - Blood Pressure (with target)
- Color-coded status indicators
- Trend arrows (improving/concerning)

#### 5. **Contact Your Care Team**
- 24/7 access messaging
- One-tap phone call
- Provider information displayed

### Quick Vital Entry Modal
When patient taps "Log Vitals":
- **Blood Sugar Input** - Large number entry, instant target validation
- **Weight Input** - Track against goal with visual feedback
- **Blood Pressure Input** - Simple systolic/diastolic entry
- **Notes Field** - Optional notes about how they're feeling
- **Color Indicators** - 🔴🟡🟢 show if values are on target
- **One-Tap Save** - Simple save button

### Design Principles
- **Zero Learning Curve** - Grandma-friendly interface
- **Encouraging** - Positive reinforcement for completed tasks
- **Non-Judgmental** - Yellow/red indicators suggest "monitor" not "failure"
- **Always Accessible** - 24/7 care team contact front and center

---

## 👨‍⚕️ Provider Dashboard

**URL:** `/pcm/provider`

### What Providers See

#### 1. **Key Stats (Top Row)**
- **Overdue Contacts** - Red alert card
- **High Risk Patients** - Orange indicator
- **Need Time (<30 min)** - Yellow warning
- **Average Compliance** - Green success metric

#### 2. **Search & Filter Controls**
- **Search Bar** - Find by name or phone instantly
- **Sort Options:**
  - Risk Level (default)
  - Contact Due Date
  - Medication Compliance
  - PCM Time Logged
- **Filter Options:**
  - All Patients
  - Overdue Only
  - High Risk Only
  - Medium Risk
  - Low Risk

#### 3. **Patient Risk Cards**
Each card shows:

**Header:**
- Patient name, age
- Risk level indicator (🔴🟡🟢)
- Contact due date (with overdue warning)
- Quick action buttons (📞 Call, ✉️ Message)

**Key Metrics Row:**
- **A1C:** Current vs target with trend arrow
- **Med Adherence:** Percentage with color coding
- **PCM Time:** Minutes logged this month (of 30 required)

**Last Contact Notes:**
- Quick preview of last call notes
- Date of last contact

**View Details Button:**
- Click to see full patient detail modal

### Patient Detail Modal
When provider clicks on a patient:
- **Quick Actions** - Call, Message buttons
- **Full Vital Metrics** - A1C, BP, Weight, Adherence
- **Last Contact Notes** - Complete notes from last call
- **Action History** - Recent PCM activities

### Provider Workflow
1. **Morning Review** - Check overdue and high-risk patients
2. **Prioritize** - Sort by risk level or due date
3. **Quick Contact** - One-tap call or message
4. **Document** - Staff logs the interaction
5. **Monitor** - Track progress over time

---

## 👩‍💼 Staff Workflow Dashboard

**URL:** `/pcm/staff`

### What Staff See

#### 1. **Daily Stats**
- **To Contact** - Patients needing calls (red)
- **In Progress** - Active calls (yellow)
- **Completed Today** - Finished calls (green)
- **Time Logged** - Total PCM time today

#### 2. **Kanban Board (3 Columns)**

**Column 1: Not Contacted** (Red Header)
- Patients due for contact (sorted by due date)
- Overdue patients flagged with red badge
- "Start Call" button for each patient

**Column 2: In Progress** (Yellow Header)
- Currently active calls
- Shows patient's key metrics
- Pulsing indicator for active patient

**Column 3: Completed** (Green Header)
- Calls completed today
- Success indicator

### Starting a Call
When staff clicks "Start Call":

**Patient moves to "In Progress" column**

**Bottom Panel Opens with:**

#### Left Side: Call Documentation
1. **Patient Quick Info**
   - A1C, BP, Medication Adherence at a glance

2. **Call Outcome Selection** (4 options)
   - ✅ Completed
   - 📞 No Answer
   - 📞 Voicemail
   - 📅 Rescheduled

3. **Call Notes Field** (Required)
   - Document conversation
   - Patient concerns
   - Action items
   - Care plan updates

4. **Complete Call Button**
   - Saves notes and moves to "Completed"

#### Right Side: Time Tracker
- **Auto Timer** - Start/Pause/Stop controls
- **Activity Type Selection:**
  - 📞 Phone Call
  - 🤝 Care Coordination
  - 💊 Medication Review
  - 🧪 Lab Review
  - 📝 Documentation
  - ⚕️ Other PCM Activity

- **Monthly Progress Bar**
  - Visual indicator of 30-minute requirement
  - Color changes: Red (<20), Yellow (20-29), Green (30+)

- **Recent Entries**
  - Last 5 time entries for this patient
  - Running total for the month

### Staff Workflow Process
1. **Review Board** - See all patients needing contact
2. **Start Call** - Click patient card
3. **Make Contact** - Call patient
4. **Start Timer** - Begin tracking time
5. **Document** - Select outcome, write notes
6. **Save** - Complete call and log time
7. **Next Patient** - Move to next card

---

## 🗂️ File Structure

```
src/
├── components/
│   └── pcm/
│       ├── QuickVitalEntry.tsx          # Patient vital logging modal
│       ├── PatientRiskCard.tsx          # Provider patient card
│       └── TimeTracker.tsx              # PCM time tracking widget
│
├── pages/
│   ├── SimplePCMPatientDashboard.tsx    # Patient-facing dashboard
│   ├── PCMProviderDashboard.tsx         # Provider management view
│   └── PCMStaffWorkflow.tsx             # Staff workflow board
│
├── services/
│   └── pcm.service.ts                   # PCM data management service
│
└── types/
    └── pcm.types.ts                     # PCM type definitions
```

---

## 🚀 Getting Started

### For Development

1. **Navigate to Patient Dashboard:**
```bash
http://localhost:5173/pcm/patient
```

2. **Navigate to Provider Dashboard:**
```bash
http://localhost:5173/pcm/provider
```

3. **Navigate to Staff Workflow:**
```bash
http://localhost:5173/pcm/staff
```

### Production URLs
- Patient: `https://[your-domain]/pcm/patient`
- Provider: `https://[your-domain]/pcm/provider`
- Staff: `https://[your-domain]/pcm/staff`

---

## 📊 Data Flow

### Current Implementation (Demo Mode)
- Uses **localStorage** for data persistence
- Includes **demo data** for 5 sample patients
- Perfect for testing and demonstration

### Production Integration (Next Steps)
Replace localStorage calls in `pcm.service.ts` with:
1. **Supabase queries** for real-time data
2. **Patient vitals** table integration
3. **Time tracking** table for billing
4. **Task management** system integration

---

## 🎨 Design Philosophy

### "Less is More"
- Only show what's needed **right now**
- Hide complexity in expandable sections
- Progressive disclosure

### "One-Tap Actions"
- Everything should be **1-2 clicks maximum**
- Large tap targets (mobile-friendly)
- No nested menus

### "Visual First"
- Use **colors, icons, progress bars** instead of text
- Traffic light system (🔴🟡🟢) everyone understands
- Trend arrows show direction at a glance

### "Mobile Optimized"
- Design for **phone screens first**
- Desktop is a bonus, not the primary experience
- Touch-friendly spacing

### "Smart Defaults"
- Pre-fill **everything possible**
- Sensible default values
- Minimal required fields

---

## 🔧 Customization

### Adding New Patient Tasks
In `pcm.service.ts`, modify `getDefaultTasks()`:

```typescript
{
  id: this.generateId(),
  patientId,
  title: 'Your custom task',
  description: 'Task description',
  frequency: 'daily', // or 'weekly', 'monthly'
  completed: false,
  category: 'vitals' // or 'medication', 'exercise', etc.
}
```

### Adjusting Risk Thresholds
In `PatientRiskCard.tsx`, modify risk calculation logic:

```typescript
// Example: Change A1C risk thresholds
if (patient.currentA1C > 9.0) return 'high';
if (patient.currentA1C > 7.5) return 'medium';
return 'low';
```

### Customizing Time Requirements
In `TimeTracker.tsx`, adjust PCM billing requirements:

```typescript
const PCM_REQUIRED_MINUTES = 30; // Change to your requirement
```

---

## 📈 Future Enhancements

### Phase 2 Features
- [ ] Push notifications for patients (reminders)
- [ ] SMS/Email integration for care team messaging
- [ ] Automated risk score calculation (ML-based)
- [ ] Voice input for vital logging
- [ ] Apple Health / Google Fit integration
- [ ] Medication reminder system
- [ ] Provider mobile app
- [ ] Automated monthly reports
- [ ] Family member portal access

### Integration Opportunities
- EHR systems (Epic, Cerner, athenahealth)
- Pharmacy systems for med refills
- Lab systems for automatic result imports
- Telehealth platforms for video visits
- Billing systems for automated PCM billing

---

## 💡 Usage Tips

### For Patients
- **Log vitals daily** - Takes 30 seconds
- **Check off tasks** - Satisfying progress tracking
- **Contact team anytime** - Don't hesitate to reach out
- **Review your numbers** - See progress over time

### For Providers
- **Start each day** reviewing overdue/high-risk patients
- **Use filters** to focus on specific patient groups
- **Quick actions** for rapid workflow
- **Document in real-time** using staff workflow

### For Staff
- **Work the board** from left to right
- **Start timer immediately** when calling
- **Document thoroughly** - required for billing
- **Complete calls promptly** to keep board clear
- **Target 30+ minutes** per patient monthly

---

## ❓ FAQ

**Q: Why separate dashboards for each role?**
A: Each role has different needs. Patients need simplicity, providers need comprehensive oversight, staff need task-oriented workflow.

**Q: Can we customize the daily tasks?**
A: Yes! Edit `pcm.service.ts` to add/remove tasks.

**Q: How does time tracking work for billing?**
A: Staff use the built-in timer when performing PCM activities. System tracks and totals time monthly. 30+ minutes required for billing.

**Q: What if a patient doesn't have a smartphone?**
A: Staff can log vitals on patient's behalf during calls. Desktop version also works for family members.

**Q: Can providers see time tracking?**
A: Yes, on the patient risk card. Shows "PCM Time: X/30 min" for the current month.

---

## 🆘 Support

For questions or issues:
- Check this documentation first
- Review component code comments
- Contact development team

---

## 📝 Change Log

### Version 1.0 (January 18, 2025)
- Initial release
- Patient dashboard with task tracking
- Provider dashboard with risk cards
- Staff workflow with kanban board
- Time tracker component
- Quick vital entry modal
- Demo data and localStorage persistence

---

**Built with ❤️ for better diabetes care**
