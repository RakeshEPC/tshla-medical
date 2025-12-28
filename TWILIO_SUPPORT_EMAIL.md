# Email to Twilio Support - Voice Calling Disabled Issue

---

**Subject:** Urgent: Voice Calling Disabled (Error 10005) - Account AC3a28272c27111a4a99531fff151dcdab

---

**Email Body:**

Hello Twilio Support Team,

I am experiencing a critical issue with my Twilio account where all outbound voice calls are being blocked with error code 10005: "Voice calling has been disabled for this account."

## Account Information

- **Account SID:** AC3a28272c27111a4a99531fff151dcdab
- **Account Name:** My first Twilio account
- **Account Type:** Full (paid account)
- **Current Balance:** $1,327.39 USD

## Issue Details

**Error Code:** 10005
**Error Message:** "Voice calling has been disabled for this account"
**Status Code:** 403

**When it started:** Between December 8, 2025 and December 15, 2025

## Recent History

- **Last successful call:** December 8, 2025 at 16:58:58 UTC
  - Call SID: CA8b07f02e9058b4e04549c15b338e1989
  - Duration: 674 seconds (11+ minutes)
  - Status: Completed successfully
  - Cost: $10.56 USD

- **Test call attempted today:** December 15, 2025
  - From: +18324027671 (my Twilio number)
  - To: +18326073630 (US number)
  - Result: Failed immediately with error 10005

## What I've Verified

✅ Account status shows "active"
✅ Account type shows "Full"
✅ Account balance is $1,327.39 (sufficient funds)
✅ Authentication credentials are correct and working
✅ Geographic permissions for United States are enabled
✅ Phone numbers are active and properly configured
✅ API connectivity is working (can retrieve account details)

## Use Case

I am running a HIPAA-compliant medical application (TSHLA Medical) that uses Twilio for:

1. **Pre-visit patient interviews** - Automated calls to patients before medical appointments
2. **Diabetes education hotline** - Inbound calls from patients for health support
3. **ElevenLabs AI integration** - Voice AI conversations for medical consultations

This service is actively used by healthcare providers and patients. The sudden voice calling restriction is preventing critical healthcare communications.

## Phone Numbers Affected

- **+18324027671** - Primary pre-visit interview number
- **+18324003930** - Diabetes education hotline
- All other phone numbers in my account (7 total)

## Compliance Status

I notice there are A2P 10DLC registration requirements for messaging. However:
- This issue is affecting **voice calls**, not SMS/MMS
- I primarily use these numbers for voice calling, not messaging
- Voice calling was working fine until recently

## Request

Could you please:

1. **Investigate why voice calling was disabled** on my account between December 8-15, 2025
2. **Re-enable voice calling** as soon as possible
3. **Clarify any compliance requirements** I need to complete to prevent future restrictions
4. **Confirm if A2P 10DLC messaging registration** is affecting voice calls (though it shouldn't)

## Urgency

This is a **high-priority healthcare application** affecting patient care. I need voice calling restored urgently to continue providing medical services.

## Additional Information

- **Application:** TSHLA Medical Platform
- **Integration:** Twilio Voice + ElevenLabs Conversational AI
- **Webhooks:** Configured at https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io
- **Use case:** HIPAA-compliant patient communications
- **Region:** United States (Texas)

I am available for immediate verification or compliance steps if needed. Please let me know what information you need to resolve this quickly.

Thank you for your prompt assistance.

Best regards,
Rakesh Patel
TSHLA Medical

---

**Account SID:** AC3a28272c27111a4a99531fff151dcdab
**Contact:** [Your email from Twilio account]
**Phone:** [Your contact phone number]

---

## Supporting Documentation

**API Error Response:**
```json
{
  "code": 10005,
  "message": "Voice calling has been disabled for this account",
  "more_info": "https://www.twilio.com/docs/errors/10005",
  "status": 403
}
```

**Last Successful Call Details:**
```json
{
  "sid": "CA8b07f02e9058b4e04549c15b338e1989",
  "date_created": "Mon, 08 Dec 2025 16:58:58 +0000",
  "date_updated": "Mon, 08 Dec 2025 17:10:17 +0000",
  "direction": "outbound-api",
  "duration": "674",
  "status": "completed",
  "price": "-10.56000"
}
```
