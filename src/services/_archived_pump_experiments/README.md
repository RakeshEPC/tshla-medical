# Archived PumpDrive & Azure Services

This directory contains experimental and unused service implementations that were archived during the codebase cleanup on October 2, 2025.

## Why These Were Archived

These services were either:
1. **Experimental implementations** that were superseded by better versions
2. **Never used in production** (only in tests or not at all)
3. **Duplicated functionality** available in other active services

## Archived Services

### PumpDrive Services (9 files)
- `pumpDriveCached.service.ts` - Cached version (unused)
- `pumpDriveCategoryRecommendation.service.ts` - Category-based (experimental)
- `pumpDriveEnhanced.service.ts` - Enhanced version (superseded by EnhancedV2)
- `pumpDriveLightweight.service.ts` - Lightweight version (unused)
- `pumpDriveValidated.service.ts` - Validated version (unused)
- `pumpDriveValidation.service.ts` - Validation utilities (unused)
- `pumpAnalysis.service.ts` - Analysis utilities (functionality moved to pumpAssessment)
- `pumpDataPersistence.service.ts` - Data persistence (unused)
- `pumpReportGenerator.service.ts` - Report generation (unused)

### Azure Speech Services (6 files)
- `azureSpeechAmbient.service.ts` - Ambient listening (experimental)
- `azureSpeechConversation.service.ts` - Conversation mode (unused)
- `azureSpeechDictation.service.ts` - Dictation mode (superseded by StreamingFixed)
- `azureSpeechEnhanced.service.ts` - Enhanced version (unused)
- `azureSpeechSimple.service.ts` - Simple version (superseded by base azureSpeech.service)
- `azureSpeechTranscription.service.ts` - Transcription (unused)

## Active Services Still in Use

### PumpDrive (11 services - Core functionality)
1. `pumpAssessment.service.ts` ✅ Used in PumpDriveResults
2. `pumpAuth.service.ts` ✅ Used in Login/CreateAccount
3. `pumpDataManager.service.ts` ✅ Used in tests
4. `pumpDriveAI.service.ts` ✅ Used in PumpDriveResults
5. `pumpDriveCachedBrowser.service.ts` ✅ Used in tests
6. `pumpDriveEnhancedV2.service.ts` ✅ Used in tests
7. `pumpDriveFeatureBased.service.ts` ✅ Used in PumpDriveResults (PRIMARY)
8. `pumpDrivePureAI.service.ts` ✅ Used in PumpDriveResults
9. `pumpFeatureEngine.service.ts` ✅ Core engine
10. `pumpPersonaEngine.service.ts` ✅ Core engine
11. `pumpRecommendationUnified.service.ts` ✅ Unified recommendations

### Azure Services (5 services - Core functionality)
1. `azureAI.service.ts` ✅ General AI
2. `azureOpenAI.service.ts` ✅ OpenAI integration
3. `azureSpeech.service.ts` ✅ Base speech service
4. `azureSpeechConfig.service.ts` ✅ Configuration
5. `azureSpeechStreamingFixed.service.ts` ✅ Production streaming

## If You Need These Files

These files are:
1. **Still in git history** - You can retrieve them anytime
2. **In this archive directory** - Easy to restore if needed
3. **Documented here** - You know why they were archived

To restore a file:
```bash
mv src/services/_archived_pump_experiments/[filename] src/services/
```

## Cleanup Statistics

**Before Cleanup:**
- 20 PumpDrive service files
- 11 Azure Speech service files
- ~6,000+ lines of duplicated/experimental code

**After Cleanup:**
- 11 PumpDrive service files (9 archived)
- 5 Azure Speech service files (6 archived)
- Clearer architecture and maintenance path

---

**Last Updated**: October 2, 2025
**Archived By**: Automated cleanup process
**Safe to Delete**: After 6 months (April 2026) if never restored
