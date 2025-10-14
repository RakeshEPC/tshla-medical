# Deprecated Services

This folder contains legacy dictation and speech-to-text services that have been replaced by the production-ready Deepgram SDK implementation.

## Archived Services

### Speech-to-Text Services

1. **dictation.service.ts** - Browser Web Speech API
   - **Reason for deprecation**: Basic browser API, not HIPAA-compliant, inconsistent quality
   - **Replaced by**: deepgramSDK.service.ts (nova-2-medical model)
   - **Last used**: Test pages only (QuickQualityTest.tsx)

2. **highQualityDictation.service.ts** - Azure Speech Services
   - **Reason for deprecation**: Quota limits, complex configuration, streaming issues
   - **Replaced by**: deepgramSDK.service.ts
   - **Last used**: Test pages only (QualityTest.tsx)
   - **Note**: Contains useful medical vocabulary corrections - see medicalCorrections.service.ts

3. **awsTranscribe.service.ts** - AWS Transcribe Medical
   - **Reason for deprecation**: Connection complexity, less accurate than Deepgram
   - **Replaced by**: deepgramSDK.service.ts

4. **awsTranscribeMedicalStreamingFixed.service.ts** - AWS Transcribe Medical (Streaming)
   - **Reason for deprecation**: Streaming connection issues, maintenance overhead
   - **Replaced by**: deepgramSDK.service.ts

5. **awsTranscribeSimple.service.ts** - AWS Transcribe Medical (Simplified)
   - **Reason for deprecation**: Still had reliability issues
   - **Replaced by**: deepgramSDK.service.ts

6. **azureSpeech.service.ts** - Azure Cognitive Services Speech
   - **Reason for deprecation**: Quota limitations, complex configuration
   - **Replaced by**: deepgramSDK.service.ts

7. **azureSpeechConfig.service.ts** - Azure Speech Configuration
   - **Reason for deprecation**: Not needed with Deepgram
   - **Replaced by**: deepgramSDK.service.ts

8. **azureSpeechStreamingFixed.service.ts** - Azure Speech (Streaming Fix)
   - **Reason for deprecation**: Maintenance overhead, Deepgram more reliable
   - **Replaced by**: deepgramSDK.service.ts

### AI Processing Services

9. **azureAI.service.ts** - Azure OpenAI Processing
   - **Status**: Still in use for SOAP note generation
   - **Note**: This is NOT deprecated - it's used for AI processing, not transcription

10. **azureOpenAI.service.ts** - Azure OpenAI Direct
    - **Reason for deprecation**: Replaced by azureAI.service.ts with better prompts
    - **Replaced by**: azureAI.service.ts

## Current Production Stack

**Speech-to-Text**: deepgramSDK.service.ts
- Model: nova-2-medical
- Medical vocabulary optimized
- HIPAA-compliant
- Real-time streaming with auto-reconnection
- Speaker diarization for conversations

**AI Processing**: azureAI.service.ts
- GPT-4 for SOAP note generation
- Medical terminology corrections
- Template-based formatting

**Speech Service Router**: speechServiceRouter.service.ts
- Centralized service selection
- Automatic fallback handling
- Configuration management

## Migration Notes

If you need to reference old implementations:
- Medical vocabulary corrections → medicalCorrections.service.ts
- Streaming patterns → deepgramSDK.service.ts
- SOAP generation → azureAI.service.ts

## Why Deepgram?

1. **Medical-grade accuracy**: nova-2-medical model specifically trained for healthcare
2. **HIPAA compliance**: BAA available, secure streaming
3. **Reliability**: Auto-reconnection, better error handling
4. **Features**: Speaker diarization, keyword boosting, smart formatting
5. **Simple integration**: WebSocket proxy pattern, clean API
6. **Cost-effective**: Better accuracy at competitive pricing

## Do Not Delete

These services are kept for:
1. **Reference**: Implementation patterns and lessons learned
2. **Testing**: Test pages still use some services for comparison
3. **Fallback**: Emergency backup if Deepgram has issues
4. **Documentation**: Historical context for architectural decisions

Last updated: October 14, 2025
