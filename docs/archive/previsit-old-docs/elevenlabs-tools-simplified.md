# ElevenLabs Server Tools Configuration

## Tool 1: Store Medications

**Name:** `store_medications`

**Description:**
```
Store the patient's current medications. Call this when the patient tells you what medications they are taking.
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/medications
```

**Method:** `POST`

**Body Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | Yes | Current conversation ID (auto-populated) |
| `medications` | array of strings | Yes | List of medications patient is taking |

**Example Request Body:**
```json
{
  "conversation_id": "conv_abc123",
  "medications": [
    "Metformin 500mg twice daily",
    "Lisinopril 10mg once daily"
  ]
}
```

---

## Tool 2: Store Concerns

**Name:** `store_concerns`

**Description:**
```
Store the patient's health concerns and symptoms. Call this when the patient describes what they want to discuss with their doctor.
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/concerns
```

**Method:** `POST`

**Body Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | Yes | Current conversation ID (auto-populated) |
| `concerns` | array of strings | Yes | List of health concerns or symptoms |

**Example Request Body:**
```json
{
  "conversation_id": "conv_abc123",
  "concerns": [
    "High blood pressure readings at home",
    "Morning dizziness",
    "Recent weight gain"
  ]
}
```

---

## Tool 3: Store Questions

**Name:** `store_questions`

**Description:**
```
Store questions the patient has for their provider. Call this when the patient mentions questions they want to ask their doctor.
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/questions
```

**Method:** `POST`

**Body Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversation_id` | string | Yes | Current conversation ID (auto-populated) |
| `questions` | array of strings | Yes | List of questions for the provider |

**Example Request Body:**
```json
{
  "conversation_id": "conv_abc123",
  "questions": [
    "Should I continue my current blood pressure medication?",
    "What diet changes would you recommend?"
  ]
}
```

---

## How to Add in ElevenLabs Dashboard

### Step 1: Navigate to Tools
1. Go to https://elevenlabs.io/conversational-ai
2. Click "Agents" → "Patient intake"
3. Click "Tools" tab
4. Click "Add Tool" or "+ Create Tool"

### Step 2: Fill in the Form

The form typically has these fields:

- **Tool Name**: Copy the name above (e.g., `store_medications`)
- **Description**: Copy the description above
- **URL/Endpoint**: Copy the full URL above
- **Method**: Select `POST`
- **Parameters Section**:
  - Add each parameter from the table above
  - For `conversation_id`: Set as auto-populated or system parameter
  - For `medications/concerns/questions`: Set type as "array of strings"

### Step 3: Test
After adding all 3 tools, update your agent prompt to mention:
```
Use store_medications when patient lists medications.
Use store_concerns when patient describes health issues.
Use store_questions when patient asks questions for the doctor.
```

---

## Need Different Format?

If the ElevenLabs UI is asking for a different format, please tell me what fields you see, and I'll create the exact format you need!

Common formats ElevenLabs might accept:
1. **UI Form** (fields in a web form)
2. **JSON Import** (upload a JSON file)
3. **OpenAPI/Swagger** format
4. **Function calling format** (similar to OpenAI functions)

Let me know which format you need!
