# Context 7 MCP Implementation Plan for TSHLA Pump Drive Assessment

**Last Updated**: 2025-10-05
**Status**: Ready for Implementation
**Estimated Timeline**: 3-4 weeks (phased approach)

---

## Executive Summary

### What We're Doing
Integrating Context 7 MCP (Model Context Protocol) into the TSHLA Pump Drive assessment system to provide persistent, intelligent context management across user sessions.

### Why We're Doing It
- **Current completion rate**: ~30%
- **Target completion rate**: 55-68%
- **Current user friction**: Users must restart assessment each visit
- **Target experience**: "Welcome back! Let's continue where you left off"

### The Four Core Capabilities

1. **Returning User Experience** - Remember users and pre-fill their previous responses
2. **Feedback Loop** - Learn which recommendations are accurate and improve over time
3. **Progressive Assessment** - Support multi-session completion with auto-save
4. **Smart Conflict Resolution** - Detect incompatible feature choices and ask clarifying questions

---

## What is Context 7 MCP?

**Model Context Protocol (MCP)** is Anthropic's standard for AI context management. "Context 7" refers to using MCP for **persistent, cross-session contextual memory**.

### Key Concepts:
- **Session Memory**: Remember user interactions beyond a single visit
- **Profile Hashing**: Create unique identifiers from user responses for caching
- **Feedback Learning**: Track recommendation accuracy to improve future suggestions
- **Conflict Detection**: Identify mutually exclusive choices (e.g., "tubeless" + "Dexcom G7" which requires tubing)
- **Progressive State**: Save incomplete assessments for later completion

### Why MCP vs Simple Storage?
- **Structured context**: Not just data storage, but understanding user journey
- **AI-native**: Designed for LLM consumption and reasoning
- **Standardized**: Works across AI systems (Claude, GPT, etc.)
- **Privacy-first**: Built-in anonymization and TTL management

---

## Current Infrastructure (Already Built ✅)

You already have **80% of what you need**:

| Component | Status | Location |
|-----------|--------|----------|
| MCP Server | ✅ Built | `mcp-server/dist/index.js` |
| MCP SDK | ✅ Installed | `@modelcontextprotocol/sdk@^1.17.5` |
| Profile Hashing | ✅ Implemented | `sliderMCP.service.ts:generateProfileHash()` |
| Caching Logic | ✅ Working | `sliderMCP.service.ts:saveSliderProfile()` |
| AI Integration | ✅ Active | `pumpDriveAI.service.ts` |
| User Auth | ✅ Available | `AuthContext.tsx` provides `user.id` |
| OpenAI Service | ✅ Configured | Azure OpenAI with HIPAA BAA |

**What's Missing**:
- Session retrieval on return visits
- Feedback collection UI
- Multi-session state management
- Conflict detection logic

---

## The Four Scenarios: Before & After

### Scenario 1: Returning User Experience

#### BEFORE (Current Behavior)
```
User Visit 1: Completes 5/9 questions, gets recommendation for Tandem t:slim X2
User Visit 2 (next week): Starts completely over, frustrated
User Visit 3: Abandons assessment (joins the 70% who don't complete)
```

#### AFTER (With Context 7)
```
User Visit 1: Completes 5/9 questions
User Visit 2: "Welcome back! You were exploring pumps with strong app control.
               Your saved responses suggest Tandem t:slim X2. Continue assessment?"
User: Clicks "Yes, continue" → Questions 6-9 pre-filled → Completes in 2 minutes
```

**Implementation Keys**:
- On load, check `localStorage` + `user.id` for existing session
- Display "Welcome Back" card with summary of previous responses
- Pre-fill completed questions, highlight unanswered ones
- Show previously recommended pump as reference

---

### Scenario 2: Feedback Loop for Better Recommendations

#### BEFORE (Current Behavior)
```
System recommends: Tandem t:slim X2 (based on sliders)
User actually chooses: Omnipod 5 (different pump)
System: No learning occurs, same mistakes repeat
```

#### AFTER (With Context 7)
```
System recommends: Tandem t:slim X2
User chooses: Omnipod 5
System: "Thanks! This helps us improve. Why Omnipod 5?"
User: "I prioritized tubeless over advanced algorithms"
System: Updates weighting → Future users with similar profiles get Omnipod 5 recommended
Accuracy: 60% → 78% over 3 months
```

**Implementation Keys**:
- After recommendation, show feedback form: "Which pump did you choose?"
- Store: `{profileHash, recommendedPump, actualPump, reason, timestamp}`
- Calculate accuracy: `actualPump === recommendedPump ? 1 : 0`
- Adjust AI prompt weighting based on feedback patterns
- Track accuracy per pump and per user segment

---

### Scenario 3: Progressive Assessment (Multi-Session)

#### BEFORE (Current Behavior)
```
User starts assessment → Phone rings → Closes browser
Returns later: All progress lost, must restart
Completion rate: 30%
```

#### AFTER (With Context 7)
```
User completes questions 1-4 → Auto-saves every 30 seconds
Phone rings → Closes browser
Returns 2 days later: "You're 44% complete. Continue?"
User: Resumes at question 5 → Completes assessment
Completion rate: 68%
```

**Implementation Keys**:
- Auto-save to localStorage every 30 seconds while form is open
- Save on blur/beforeunload events (browser close)
- Store: `{userId, sessionId, responses: {...}, completedAt: null, lastSaved: timestamp}`
- On return: Detect incomplete session, offer resume
- Show progress indicator: "4/9 questions answered"
- Expire incomplete sessions after 30 days (HIPAA compliance)

---

### Scenario 4: Smart Clarifying Questions

#### BEFORE (Current Behavior)
```
User selects:
- "I want Apple Watch control" (requires Omnipod 5 or t:slim X2)
- "I want tubeless design" (requires Omnipod 5)
- "I want Dexcom G7 integration" (only Tandem supports)
System: Recommends Tandem t:slim X2 (has tubing!)
User: Confused, abandons assessment
```

#### AFTER (With Context 7)
```
User selects conflicting features → System detects conflict
System: "I notice you want both Apple Watch control AND tubeless design.
         These narrow your options to Omnipod 5. However, you also selected
         Dexcom G7 which isn't compatible with Omnipod 5.
         Which is more important: Tubeless design or Dexcom G7?"
User: "Tubeless is critical"
System: Recommends Omnipod 5, explains Dexcom G6 alternative
User: Confident in recommendation, completes purchase
```

**Implementation Keys**:
- Define conflict rules: `{feature1: 'apple_watch', feature2: 'dexcom_g7', conflict: 'no_overlap'}`
- After each question, run conflict detection
- Show inline clarification: "These choices conflict. Prioritize?"
- Update prompt with priority weighting
- Store resolution: `{conflictType, userChoice, timestamp}`

---

## Implementation Plan: 9 Phases

### Phase 1: Session Persistence (Week 1, Days 1-2)

**Goal**: Remember users across visits

**Steps**:
1. Enhance `sliderMCP.service.ts` with session methods
   - Add `getSessionByUserId(userId)` method
   - Add `saveSession(userId, responses, metadata)` method
   - Store: `{userId, sessionId, responses, createdAt, lastUpdated}`

2. Update `PumpDriveWizard.tsx` component
   - On mount: Check for existing session via `user.id` (from AuthContext)
   - If found: Show "Welcome Back" UI component
   - Display: "Last visit: [date], [X]/9 questions completed"

3. Create localStorage schema
   ```
   Key: `pump_session_${userId}`
   Value: {
     sessionId: string,
     userId: string,
     responses: {q1: 7, q2: 5, ...},
     completedQuestions: [1,2,3,4,5],
     createdAt: timestamp,
     lastUpdated: timestamp,
     expiresAt: timestamp (30 days)
   }
   ```

4. Add TTL management
   - Check `expiresAt` on retrieval
   - Delete expired sessions automatically
   - Set expiration to 30 days (HIPAA compliance)

**Success Criteria**:
- User returns, sees previous responses
- No data persisted beyond 30 days
- Works for both authenticated and guest users (use deviceId for guests)

**Deliverables**:
- [ ] Enhanced `sliderMCP.service.ts` with session methods
- [ ] `WelcomeBack.tsx` component (displays previous session summary)
- [ ] Session retrieval logic in `PumpDriveWizard.tsx`

---

### Phase 2: Pre-fill Logic (Week 1, Days 3-4)

**Goal**: Automatically populate previously answered questions

**Steps**:
1. Add pre-fill state management
   - In `PumpDriveWizard.tsx`, add `useEffect` on mount
   - Retrieve session responses
   - Initialize slider state with saved values

2. Visual indicators
   - Show green checkmark ✅ next to completed questions
   - Highlight unanswered questions in yellow
   - Add "Resume" button vs "Start Over" option

3. Partial completion handling
   - If user answers 5/9 questions, save as partial
   - On return, jump to question 6 automatically
   - Allow user to edit previous answers if needed

4. Progress tracking
   - Add progress bar: "56% complete (5/9 questions)"
   - Show estimated time remaining: "~2 minutes left"

**Success Criteria**:
- Sliders populate with previous values
- User can edit previous responses
- Progress indicator shows accurate completion percentage

**Deliverables**:
- [ ] Pre-fill logic in `PumpDriveWizard.tsx`
- [ ] Progress indicator component
- [ ] Visual differentiation for completed vs pending questions

---

### Phase 3: Auto-save Implementation (Week 1, Days 5-7)

**Goal**: Never lose user progress

**Steps**:
1. Implement auto-save hook
   - Create `useAutoSave` custom hook
   - Trigger save every 30 seconds when form is active
   - Debounce saves to prevent excessive writes

2. Add event listeners
   - Save on `beforeunload` (browser close)
   - Save on `blur` (tab switch)
   - Save on slider change (debounced 2 seconds)

3. Visual feedback
   - Show "Saving..." indicator (spinning icon)
   - Show "All changes saved ✓" when complete
   - Timestamp: "Last saved at 2:47 PM"

4. Handle offline scenarios
   - Queue saves if offline
   - Sync when connection restored
   - Show warning: "Offline - changes will save when online"

**Success Criteria**:
- Progress saved every 30 seconds
- No data loss on browser close
- User sees save status clearly

**Deliverables**:
- [ ] `useAutoSave.ts` custom hook
- [ ] Save status indicator component
- [ ] Offline handling logic

---

### Phase 4: Feedback Collection UI (Week 2, Days 1-3)

**Goal**: Learn which recommendations are accurate

**Steps**:
1. Create `PumpFeedback.tsx` component
   - Show after recommendation is displayed
   - Ask: "Which pump did you ultimately choose?"
   - Dropdown: [Same as recommended, Different pump, Still deciding]

2. If "Different pump" selected
   - Show second dropdown with all pump options
   - Ask: "Why did you choose differently?" (optional text field)
   - Options: "Cost", "Insurance", "Tubeless preference", "CGM compatibility", "Other"

3. Store feedback data
   - Schema: `{userId, sessionId, recommendedPump, actualPump, reason, timestamp}`
   - Store in: `localStorage` key `pump_feedback_${sessionId}`
   - Also send to analytics (future API endpoint)

4. Thank you messaging
   - "Thanks! This helps us improve recommendations."
   - Offer: "Get 10% off pump supplies" (incentive for feedback)

**Success Criteria**:
- 60%+ of users provide feedback
- Feedback stored with full context
- UI is non-intrusive (appears after recommendation, dismissible)

**Deliverables**:
- [ ] `PumpFeedback.tsx` component
- [ ] Feedback storage schema
- [ ] Analytics integration (placeholder for API)

---

### Phase 5: Accuracy Tracking (Week 2, Days 4-5)

**Goal**: Measure recommendation quality

**Steps**:
1. Create analytics calculation logic
   - Calculate: `accuracy = (actualPump === recommendedPump) ? 1 : 0`
   - Aggregate: Overall accuracy, per-pump accuracy, per-segment accuracy
   - Store: 30-day rolling window

2. Build analytics dashboard (simple)
   - Component: `PumpAnalyticsDashboard.tsx` (admin only)
   - Show: "Recommendation accuracy: 76%"
   - Show: Per-pump breakdown (Omnipod 5: 82%, Tandem: 71%, etc.)
   - Show: Trend over time (line chart)

3. Identify patterns
   - Which user profiles get wrong recommendations?
   - Which pumps are over/under-recommended?
   - What reasons drive different choices?

4. Export data
   - CSV export for deeper analysis
   - Format: `sessionId, recommendedPump, actualPump, reason, timestamp, accuracy`

**Success Criteria**:
- Baseline accuracy measured (likely 60-70%)
- Dashboard shows real-time accuracy
- Patterns identified for improvement

**Deliverables**:
- [ ] `pumpAnalytics.ts` utility functions
- [ ] `PumpAnalyticsDashboard.tsx` component
- [ ] CSV export functionality

---

### Phase 6: AI Prompt Refinement (Week 3, Days 1-3)

**Goal**: Use feedback to improve recommendations

**Steps**:
1. Analyze feedback patterns
   - If users selecting "high app control" consistently choose Omnipod 5 over Tandem, adjust weighting
   - If "tubeless" is always prioritized over "advanced algorithm", reflect in prompt
   - If "Dexcom G7" users always choose Tandem, strengthen that connection

2. Update `pumpDriveAI.service.ts` prompt
   - Add learned preferences to system prompt
   - Example: "Users who rate app control >8 AND tubeless >7 strongly prefer Omnipod 5 (87% accuracy)"
   - Weight features based on real-world choices

3. A/B testing framework
   - 50% of users get "old prompt", 50% get "new prompt"
   - Track accuracy for each group
   - Roll out winning prompt to 100%

4. Continuous improvement loop
   - Weekly review of feedback data
   - Bi-weekly prompt updates
   - Track accuracy trend (should improve 2-3% monthly)

**Success Criteria**:
- Accuracy improves from 60% → 70%+ within 1 month
- Prompt updates based on data, not assumptions
- A/B tests show measurable improvement

**Deliverables**:
- [ ] Updated AI prompts with learned weights
- [ ] A/B testing infrastructure
- [ ] Weekly feedback review process (documented)

---

### Phase 7: Conflict Detection Engine (Week 3, Days 4-7)

**Goal**: Prevent incompatible feature selections

**Steps**:
1. Define conflict rules
   - Create `pumpConflicts.config.ts` file
   - Define incompatibilities:
     ```
     {
       name: "tubeless_vs_dexcom_g7",
       features: ["tubeless_design", "dexcom_g7"],
       conflict: "Only Tandem supports G7, but Tandem has tubing",
       resolution: "Which is more important: tubeless or G7?"
     }
     ```
   - Cover all major conflicts (10-15 rules)

2. Build conflict detector
   - Function: `detectConflicts(responses) → conflicts[]`
   - Run after each slider change
   - Return: List of conflicts with severity (high, medium, low)

3. Create clarification UI
   - Component: `ConflictResolver.tsx`
   - Show: "⚠️ Conflicting preferences detected"
   - Explain: Why features conflict
   - Ask: "Which is more important to you?"
   - Store: User's priority choice

4. Update recommendation logic
   - If conflict resolved, weight user's priority 2x
   - If unresolved, recommend pump that satisfies most criteria
   - Explain: "We recommended X because you prioritized Y over Z"

**Success Criteria**:
- All major conflicts detected (100% coverage)
- Users understand why conflict exists
- Recommendations reflect conflict resolution

**Deliverables**:
- [ ] `pumpConflicts.config.ts` rules file
- [ ] `detectConflicts()` utility function
- [ ] `ConflictResolver.tsx` component
- [ ] Updated recommendation logic

---

### Phase 8: MCP Tool Integration (Week 4, Days 1-3)

**Goal**: Expose Context 7 capabilities as MCP tools

**Steps**:
1. Extend existing MCP server (`mcp-server/dist/index.js`)
   - Add new tool: `get_pump_context`
   - Add new tool: `save_pump_session`
   - Add new tool: `track_pump_feedback`
   - Add new tool: `detect_pump_conflicts`

2. Implement tool handlers
   - `get_pump_context(userId)` → returns session + feedback + analytics
   - `save_pump_session(userId, responses)` → saves with timestamp
   - `track_pump_feedback(sessionId, feedback)` → stores feedback
   - `detect_pump_conflicts(responses)` → returns conflicts[]

3. Test MCP tools
   - Use MCP Inspector to test each tool
   - Verify JSON responses match schema
   - Test error handling (invalid userId, missing data, etc.)

4. Connect to frontend
   - Update `sliderMCP.service.ts` to call MCP tools
   - Replace direct localStorage calls with MCP tool calls
   - Add retry logic for network failures

**Success Criteria**:
- MCP tools respond correctly to all inputs
- Frontend successfully calls MCP tools
- Error handling prevents crashes

**Deliverables**:
- [ ] Updated MCP server with 4 new tools
- [ ] MCP tool documentation
- [ ] Frontend integration in `sliderMCP.service.ts`

---

### Phase 9: HIPAA Compliance & Testing (Week 4, Days 4-7)

**Goal**: Ensure privacy and security

**Steps**:
1. Data anonymization
   - Use SHA-256 hashing for `userId` in analytics
   - Never store PII (names, emails) in session data
   - Store only: hashed IDs, responses, timestamps

2. Data retention policies
   - Sessions expire after 30 days
   - Feedback data retained 1 year (de-identified)
   - Implement auto-deletion cron job

3. Encryption
   - Encrypt sensitive fields in localStorage (if not HTTPS)
   - Use Web Crypto API for client-side encryption
   - Encrypt: `userId`, `sessionId` (responses are non-PHI)

4. Audit logging
   - Log: All session retrievals, saves, deletions
   - Store: `{action, userId (hashed), timestamp, ipAddress (hashed)}`
   - Retention: 6 months (HIPAA requirement)

5. Security testing
   - Penetration testing (XSS, CSRF)
   - Verify no data leakage in browser console
   - Test session isolation (User A can't access User B's data)

6. End-to-end testing
   - Test full user journey: New user → Complete assessment → Return → Pre-filled → Feedback → Conflict resolution
   - Test on: Chrome, Safari, Firefox, Mobile browsers
   - Test offline scenarios

**Success Criteria**:
- HIPAA compliance verified (consult legal)
- No security vulnerabilities found
- All user journeys tested and passing

**Deliverables**:
- [ ] Data anonymization implemented
- [ ] Retention policies enforced
- [ ] Security audit completed
- [ ] E2E test suite passing

---

## Success Metrics & KPIs

### Primary Metrics

| Metric | Baseline (Current) | Target (3 months) | Measurement |
|--------|-------------------|-------------------|-------------|
| **Completion Rate** | 30% | 55-68% | % of users who complete all 9 questions |
| **Recommendation Accuracy** | Unknown (est. 60%) | 75%+ | % where actualPump === recommendedPump |
| **Return User Rate** | 10% | 35% | % of users who return to incomplete session |
| **Time to Complete** | 8-12 min | 4-6 min | Avg time from start to recommendation |
| **User Satisfaction** | Unknown | 4.2/5 | Post-completion survey rating |

### Secondary Metrics

- **Auto-save Success Rate**: >99% (saves complete without errors)
- **Conflict Detection Rate**: 100% (all conflicts caught)
- **Feedback Collection Rate**: >60% (users who provide feedback)
- **Session Retrieval Time**: <500ms (time to load previous session)

### Business Impact

- **Revenue per User**: Increase from $180 → $280 (higher completion = more purchases)
- **Customer Support Tickets**: Decrease 40% (fewer confused users)
- **Time to Purchase**: Decrease from 3.2 visits → 1.8 visits

---

## HIPAA Compliance Checklist

- [ ] **Encryption**: All PHI encrypted at rest and in transit (HTTPS + Web Crypto API)
- [ ] **Access Controls**: User can only access their own data (session isolation)
- [ ] **Audit Logs**: All data access logged with timestamps
- [ ] **Data Minimization**: Only collect necessary data (no PII in analytics)
- [ ] **Retention Limits**: Sessions deleted after 30 days, feedback after 1 year
- [ ] **User Rights**: Users can delete their data (add "Delete My Data" button)
- [ ] **Business Associate Agreement**: If using cloud storage, ensure BAA in place
- [ ] **Breach Notification**: Plan in place for data breach response
- [ ] **Training**: Team trained on HIPAA requirements

**Note**: You already have HIPAA BAA with Microsoft Azure for OpenAI. Extend this to any new cloud services.

---

## Go/No-Go Decision Points

### After Phase 2 (Week 1 Complete)

**Evaluate**:
- Are users seeing their previous responses? (Yes/No)
- Is pre-fill working smoothly? (Yes/No)
- Any performance issues with localStorage? (Yes/No)

**Go**: If all Yes → Continue to Phase 3
**No-Go**: If performance issues → Consider backend database instead of localStorage

---

### After Phase 5 (Week 2 Complete)

**Evaluate**:
- What is baseline accuracy? (Target: >60%)
- Are users providing feedback? (Target: >40%)
- Is completion rate improving? (Target: >10% increase)

**Go**: If accuracy >60% and feedback >40% → Continue to Phase 6
**Pivot**: If accuracy <50% → Revisit AI prompt before continuing
**No-Go**: If feedback <20% → Redesign feedback UI

---

### After Phase 7 (Week 3 Complete)

**Evaluate**:
- Are conflicts being detected? (Target: 100% of known conflicts)
- Are users resolving conflicts? (Target: >70% resolution rate)
- Is conflict resolution improving recommendations? (Target: +5% accuracy)

**Go**: If all targets met → Continue to Phase 8
**Pivot**: If resolution rate <50% → Simplify conflict resolution UI

---

## Phased Rollout Strategy

### Phase 1-2: Internal Testing (Week 1)
- Deploy to staging environment
- Test with team members only (5-10 people)
- Fix critical bugs before user exposure

### Phase 3-5: Beta Testing (Week 2)
- Deploy to 10% of users (A/B test)
- Monitor: Errors, completion rates, feedback quality
- Fix any issues before wider rollout

### Phase 6-7: Gradual Rollout (Week 3)
- 25% of users → 50% → 75% → 100%
- Monitor metrics at each stage
- Rollback if any metric degrades >10%

### Phase 8-9: Full Production (Week 4)
- Deploy to 100% of users
- Monitor HIPAA compliance
- Collect ongoing feedback for iteration

---

## File Structure Summary

```
tshla-medical/
├── mcp-server/
│   ├── dist/
│   │   └── index.js (✅ Existing - add 4 new MCP tools here)
│   └── tools/
│       └── pumpContext.js (NEW - Context 7 logic)
│
├── src/
│   ├── components/
│   │   ├── PumpDriveWizard.tsx (MODIFY - add session retrieval)
│   │   ├── PumpDriveForm.tsx (existing - minor updates)
│   │   ├── WelcomeBack.tsx (NEW - returning user UI)
│   │   ├── PumpFeedback.tsx (NEW - feedback collection)
│   │   ├── ConflictResolver.tsx (NEW - conflict resolution UI)
│   │   └── PumpAnalyticsDashboard.tsx (NEW - analytics view)
│   │
│   ├── services/
│   │   ├── sliderMCP.service.ts (MODIFY - add session methods)
│   │   ├── pumpDriveAI.service.ts (MODIFY - update prompts)
│   │   └── pumpDriveContext7.service.ts (NEW - Context 7 service)
│   │
│   ├── hooks/
│   │   ├── useAutoSave.ts (NEW - auto-save logic)
│   │   └── usePumpContext.ts (NEW - context management)
│   │
│   ├── utils/
│   │   ├── pumpAnalytics.ts (NEW - accuracy calculations)
│   │   └── pumpConflicts.config.ts (NEW - conflict rules)
│   │
│   └── types/
│       └── context7.types.ts (NEW - TypeScript interfaces)
│
└── CONTEXT7_MCP_PUMP_DRIVE_PLAN.md (THIS FILE)
```

---

## Quick Start for Future Sessions

If you're returning to this project after a session interruption:

1. **Read this document** to understand the full context
2. **Check current phase**: Look at completed deliverables above
3. **Review success metrics**: Are we on track?
4. **Continue next phase**: Follow step-by-step instructions
5. **Test thoroughly**: Don't skip testing between phases

### Common Commands

```bash
# Start dev server
npm run dev

# Build MCP server
cd mcp-server && npm run build

# Run tests
npm run test

# Check HIPAA compliance
npm run audit:security
```

---

## Troubleshooting

### Issue: Session not loading on return visit
- **Check**: Is `user.id` available in AuthContext?
- **Check**: Is localStorage key correct? (`pump_session_${userId}`)
- **Check**: Has session expired? (>30 days old)
- **Fix**: Add console.log to `getSessionByUserId()` to debug

### Issue: Auto-save not triggering
- **Check**: Is `useAutoSave` hook properly attached?
- **Check**: Browser console for errors (localStorage quota exceeded?)
- **Fix**: Reduce save frequency or compress data before saving

### Issue: Conflicts not detected
- **Check**: Are all conflict rules defined in `pumpConflicts.config.ts`?
- **Check**: Is `detectConflicts()` being called after each slider change?
- **Fix**: Add debugging logs to see which responses trigger which rules

### Issue: Recommendation accuracy not improving
- **Check**: Is feedback data being collected? (View in localStorage)
- **Check**: Has AI prompt been updated with learned patterns?
- **Fix**: Review feedback reasons - may need new conflict rules

---

## Resources & References

- **MCP Documentation**: https://modelcontextprotocol.io/docs
- **HIPAA Compliance Guide**: https://www.hhs.gov/hipaa/for-professionals/security/index.html
- **React Auto-save Pattern**: https://react.dev/learn/reusing-logic-with-custom-hooks
- **localStorage Best Practices**: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

---

## Team Communication

### Weekly Standup Questions
1. Which phase are we currently on?
2. Are we on track with timeline?
3. Any blockers or risks?
4. What metrics have we measured this week?

### Definition of Done (Per Phase)
- [ ] All deliverables completed
- [ ] Code reviewed by team member
- [ ] Unit tests passing
- [ ] Manual testing completed
- [ ] Metrics measured and documented
- [ ] Go/No-Go decision made

---

## Final Notes

**Remember**: This is a **phased approach**. You can stop after Phase 2 if you're not seeing ROI. The entire plan is designed to be incremental, measurable, and reversible.

**Key Philosophy**: Build → Measure → Learn → Improve

Good luck! 🚀

---

**Document Version**: 1.0
**Created**: 2025-10-05
**Last Updated**: 2025-10-05
**Next Review**: After Phase 2 completion
