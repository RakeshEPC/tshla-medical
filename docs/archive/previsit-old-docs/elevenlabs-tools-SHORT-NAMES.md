# ElevenLabs Tools Configuration - Short Names

## Tool 1: Save Medications

**Function Name:** `save_meds`

**Description:**
```
Store patient medications list
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/medications
```

**Method:** `POST`

**Parameters:**
- `conversation_id` (string, auto) - Conversation ID
- `medications` (array of strings) - Medication list

**Example:**
```json
{
  "conversation_id": "conv_123",
  "medications": ["Metformin 500mg", "Lisinopril 10mg"]
}
```

---

## Tool 2: Save Concerns

**Function Name:** `save_concerns`

**Description:**
```
Store patient health concerns
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/concerns
```

**Method:** `POST`

**Parameters:**
- `conversation_id` (string, auto) - Conversation ID
- `concerns` (array of strings) - Health concerns

**Example:**
```json
{
  "conversation_id": "conv_123",
  "concerns": ["High BP", "Dizziness"]
}
```

---

## Tool 3: Save Questions

**Function Name:** `save_questions`

**Description:**
```
Store patient questions for doctor
```

**URL:**
```
https://tshla-unified-api.redpebble-e4551b7a.eastus.azurecontainerapps.io/api/previsit/data/questions
```

**Method:** `POST`

**Parameters:**
- `conversation_id` (string, auto) - Conversation ID
- `questions` (array of strings) - Questions list

**Example:**
```json
{
  "conversation_id": "conv_123",
  "questions": ["Should I change meds?", "Diet advice?"]
}
```

---

## Setup Instructions:

### In ElevenLabs Dashboard:
1. Go to: **Agents → Patient intake → Tools**
2. Click **"Add Tool"** or **"+ Create"**
3. For each tool above, enter:
   - **Name**: Copy the short function name (e.g., `save_meds`)
   - **Description**: Copy description
   - **URL**: Copy full URL
   - **Method**: POST
   - **Add Parameters**:
     - `conversation_id`: string (system/auto)
     - `medications/concerns/questions`: array of strings

### Update Agent Prompt:
Add to your agent's instructions:
```
When patient lists medications, call save_meds.
When patient describes concerns, call save_concerns.
When patient has questions, call save_questions.
```

---

## All Names Under 64 Characters ✅

- `save_meds` = 9 chars ✅
- `save_concerns` = 13 chars ✅
- `save_questions` = 14 chars ✅

Ready to configure!
