# Example Workflows

This document contains example workflows you can build with N9N.

## 1. Simple Welcome Bot

**Purpose**: Greet users and collect their name.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "hello", matchType: "contains")
    ↓
SEND_MESSAGE ("Hello! 👋 Welcome to our service. What's your name?")
    ↓
WAIT_REPLY (saveAs: "userName", timeout: 300)
    ↓
SEND_MESSAGE ("Nice to meet you, {{variables.userName}}! How can I help you today?")
    ↓
END
```

**Configuration**:

```json
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "TRIGGER_MESSAGE",
      "config": {
        "pattern": "hello",
        "matchType": "contains"
      }
    },
    {
      "id": "send-1",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "Hello! 👋 Welcome to our service. What's your name?"
      }
    },
    {
      "id": "wait-1",
      "type": "WAIT_REPLY",
      "config": {
        "saveAs": "userName",
        "timeoutSeconds": 300,
        "onTimeout": "END"
      }
    },
    {
      "id": "send-2",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "Nice to meet you, {{variables.userName}}! How can I help you today?"
      }
    },
    {
      "id": "end-1",
      "type": "END",
      "config": {
        "outputVariables": ["userName"]
      }
    }
  ]
}
```

---

## 2. Menu Selection Bot

**Purpose**: Present a menu and route based on user choice.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "menu", matchType: "exact")
    ↓
SEND_MESSAGE ("Choose an option:\n1. Support\n2. Sales\n3. About")
    ↓
WAIT_REPLY (saveAs: "selectedOption", timeout: 300)
    ↓
CONDITION (variables.selectedOption === '1')
    ├─ TRUE → SEND_MESSAGE ("Connecting to support...")
    └─ FALSE → CONDITION (variables.selectedOption === '2')
        ├─ TRUE → SEND_MESSAGE ("Connecting to sales...")
        └─ FALSE → SEND_MESSAGE ("Invalid option. Please try again.")
    ↓
END
```

**Configuration**:

```json
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "TRIGGER_MESSAGE",
      "config": {
        "pattern": "menu",
        "matchType": "exact"
      }
    },
    {
      "id": "send-1",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "Choose an option:\n1. Support\n2. Sales\n3. About"
      }
    },
    {
      "id": "wait-1",
      "type": "WAIT_REPLY",
      "config": {
        "saveAs": "selectedOption",
        "timeoutSeconds": 300,
        "onTimeout": "END"
      }
    },
    {
      "id": "condition-1",
      "type": "CONDITION",
      "config": {
        "expression": "variables.selectedOption === '1'"
      }
    },
    {
      "id": "send-support",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "Connecting you to support team... Please wait."
      }
    },
    {
      "id": "condition-2",
      "type": "CONDITION",
      "config": {
        "expression": "variables.selectedOption === '2'"
      }
    },
    {
      "id": "send-sales",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "Connecting you to sales team... Please wait."
      }
    },
    {
      "id": "send-invalid",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "Invalid option. Please type 'menu' to try again."
      }
    },
    {
      "id": "end-1",
      "type": "END",
      "config": {}
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger-1", "target": "send-1" },
    { "id": "e2", "source": "send-1", "target": "wait-1" },
    { "id": "e3", "source": "wait-1", "target": "condition-1" },
    { "id": "e4", "source": "condition-1", "target": "send-support", "label": "true" },
    { "id": "e5", "source": "condition-1", "target": "condition-2", "label": "false" },
    { "id": "e6", "source": "condition-2", "target": "send-sales", "label": "true" },
    { "id": "e7", "source": "condition-2", "target": "send-invalid", "label": "false" },
    { "id": "e8", "source": "send-support", "target": "end-1" },
    { "id": "e9", "source": "send-sales", "target": "end-1" },
    { "id": "e10", "source": "send-invalid", "target": "end-1" }
  ]
}
```

---

## 3. Survey Bot

**Purpose**: Collect multiple pieces of information from user.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "survey", matchType: "exact")
    ↓
SEND_MESSAGE ("Let's start a quick survey! What's your name?")
    ↓
WAIT_REPLY (saveAs: "name", timeout: 300)
    ↓
SEND_MESSAGE ("Thanks {{variables.name}}! How old are you?")
    ↓
WAIT_REPLY (saveAs: "age", timeout: 300)
    ↓
SEND_MESSAGE ("Great! On a scale of 1-10, how satisfied are you with our service?")
    ↓
WAIT_REPLY (saveAs: "satisfaction", timeout: 300)
    ↓
SEND_MESSAGE ("Thank you for your feedback, {{variables.name}}!\n\nSummary:\nName: {{variables.name}}\nAge: {{variables.age}}\nSatisfaction: {{variables.satisfaction}}/10")
    ↓
END
```

---

## 4. Age Verification Bot

**Purpose**: Verify user age before proceeding.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "start", matchType: "exact")
    ↓
SEND_MESSAGE ("Welcome! Please enter your age:")
    ↓
WAIT_REPLY (saveAs: "age", timeout: 300)
    ↓
CONDITION (variables.age >= 18)
    ├─ TRUE → SEND_MESSAGE ("Access granted! Welcome.")
    └─ FALSE → SEND_MESSAGE ("Sorry, you must be 18 or older.")
    ↓
END
```

**Configuration**:

```json
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "TRIGGER_MESSAGE",
      "config": {
        "pattern": "start",
        "matchType": "exact"
      }
    },
    {
      "id": "send-1",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "Welcome! Please enter your age:"
      }
    },
    {
      "id": "wait-1",
      "type": "WAIT_REPLY",
      "config": {
        "saveAs": "age",
        "timeoutSeconds": 300,
        "onTimeout": "END"
      }
    },
    {
      "id": "condition-1",
      "type": "CONDITION",
      "config": {
        "expression": "Number(variables.age) >= 18"
      }
    },
    {
      "id": "send-granted",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "✅ Access granted! Welcome to our service."
      }
    },
    {
      "id": "send-denied",
      "type": "SEND_MESSAGE",
      "config": {
        "message": "❌ Sorry, you must be 18 or older to use this service."
      }
    },
    {
      "id": "end-1",
      "type": "END",
      "config": {
        "outputVariables": ["age"]
      }
    }
  ]
}
```

---

## 5. Appointment Booking Bot

**Purpose**: Collect information to book an appointment.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "book", matchType: "contains")
    ↓
SEND_MESSAGE ("I'll help you book an appointment! What's your full name?")
    ↓
WAIT_REPLY (saveAs: "fullName", timeout: 300)
    ↓
SEND_MESSAGE ("Thanks {{variables.fullName}}! What's your phone number?")
    ↓
WAIT_REPLY (saveAs: "phone", timeout: 300)
    ↓
SEND_MESSAGE ("What date would you like? (DD/MM/YYYY)")
    ↓
WAIT_REPLY (saveAs: "date", timeout: 300)
    ↓
SEND_MESSAGE ("What time? (HH:MM)")
    ↓
WAIT_REPLY (saveAs: "time", timeout: 300)
    ↓
SEND_MESSAGE ("Perfect! Appointment confirmed:\n\n👤 Name: {{variables.fullName}}\n📞 Phone: {{variables.phone}}\n📅 Date: {{variables.date}}\n🕐 Time: {{variables.time}}\n\nWe'll send you a reminder!")
    ↓
END
```

---

## 6. FAQ Bot with Multiple Triggers

**Purpose**: Answer common questions.

**Multiple Workflows**:

### Workflow 1: Hours
```
TRIGGER_MESSAGE (pattern: "hours|horario|when", matchType: "regex")
    ↓
SEND_MESSAGE ("We're open Monday-Friday, 9am-6pm")
    ↓
END
```

### Workflow 2: Location
```
TRIGGER_MESSAGE (pattern: "location|address|where", matchType: "regex")
    ↓
SEND_MESSAGE ("We're located at 123 Main Street, City")
    ↓
END
```

### Workflow 3: Pricing
```
TRIGGER_MESSAGE (pattern: "price|cost|how much", matchType: "regex")
    ↓
SEND_MESSAGE ("Our pricing starts at $99/month. Type 'plans' for details.")
    ↓
END
```

---

## 7. Feedback Collection with Rating

**Purpose**: Collect structured feedback.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "feedback", matchType: "exact")
    ↓
SEND_MESSAGE ("We'd love your feedback! Rate us 1-5 ⭐")
    ↓
WAIT_REPLY (saveAs: "rating", timeout: 300)
    ↓
CONDITION (variables.rating >= 4)
    ├─ TRUE → SEND_MESSAGE ("Thank you for the great rating! 🎉")
    └─ FALSE → SEND_MESSAGE ("We're sorry to hear that. What can we improve?")
                    ↓
                WAIT_REPLY (saveAs: "improvement", timeout: 300)
                    ↓
                SEND_MESSAGE ("Thank you for your feedback. We'll work on it!")
    ↓
END
```

---

## 8. Multi-Language Support

**Purpose**: Detect language and respond accordingly.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "hello|hola|olá", matchType: "regex")
    ↓
CONDITION (variables.triggerMessage.includes('hola'))
    ├─ TRUE → SEND_MESSAGE ("¡Hola! ¿Cómo puedo ayudarte?")
    └─ FALSE → CONDITION (variables.triggerMessage.includes('olá'))
        ├─ TRUE → SEND_MESSAGE ("Olá! Como posso ajudar?")
        └─ FALSE → SEND_MESSAGE ("Hello! How can I help you?")
    ↓
END
```

---

## 9. Timeout Handling Example

**Purpose**: Demonstrate timeout with fallback.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "quiz", matchType: "exact")
    ↓
SEND_MESSAGE ("Quick quiz! What's 2+2? (You have 30 seconds)")
    ↓
WAIT_REPLY (saveAs: "answer", timeout: 30, onTimeout: "GOTO_NODE", timeoutTargetNodeId: "timeout-msg")
    ↓
CONDITION (variables.answer === '4')
    ├─ TRUE → SEND_MESSAGE ("Correct! 🎉")
    └─ FALSE → SEND_MESSAGE ("Not quite. The answer is 4.")
    ↓
END

[timeout-msg]
SEND_MESSAGE ("Time's up! ⏰ The answer was 4.")
    ↓
END
```

---

## 10. Order Status Checker

**Purpose**: Check order status by ID.

**Flow**:
```
TRIGGER_MESSAGE (pattern: "order", matchType: "contains")
    ↓
SEND_MESSAGE ("I can help you check your order! Please enter your order ID:")
    ↓
WAIT_REPLY (saveAs: "orderId", timeout: 300)
    ↓
SEND_MESSAGE ("Looking up order {{variables.orderId}}...")
    ↓
SEND_MESSAGE ("Order {{variables.orderId}} is currently being processed. Expected delivery: 3-5 business days.")
    ↓
SEND_MESSAGE ("Would you like tracking information? (yes/no)")
    ↓
WAIT_REPLY (saveAs: "wantsTracking", timeout: 300)
    ↓
CONDITION (variables.wantsTracking.toLowerCase() === 'yes')
    ├─ TRUE → SEND_MESSAGE ("Tracking link: https://track.example.com/{{variables.orderId}}")
    └─ FALSE → SEND_MESSAGE ("Okay! Let us know if you need anything else.")
    ↓
END
```

---

## Tips for Building Workflows

### 1. Always Include Timeouts

```json
{
  "type": "WAIT_REPLY",
  "config": {
    "timeoutSeconds": 300,
    "onTimeout": "END"
  }
}
```

### 2. Use Clear Variable Names

```json
{
  "saveAs": "userEmail"  // Good
  "saveAs": "x"          // Bad
}
```

### 3. Provide Fallbacks

Always handle the "false" branch in conditions.

### 4. Keep Messages Concise

WhatsApp users prefer short, clear messages.

### 5. Use Emojis Wisely

Emojis make messages friendly but don't overuse them.

### 6. Test Edge Cases

- Empty responses
- Invalid input
- Timeouts
- Very long messages

### 7. Validate Input

Use conditions to validate user input before proceeding.

---

## Advanced Patterns

### Pattern 1: Retry Logic

```
WAIT_REPLY (saveAs: "email")
    ↓
CONDITION (variables.email.includes('@'))
    ├─ TRUE → Continue
    └─ FALSE → SEND_MESSAGE ("Invalid email. Try again:")
                    ↓
                WAIT_REPLY (saveAs: "email")
                    ↓
                [Continue flow]
```

### Pattern 2: Confirmation Step

```
WAIT_REPLY (saveAs: "data")
    ↓
SEND_MESSAGE ("You entered: {{variables.data}}. Is this correct? (yes/no)")
    ↓
WAIT_REPLY (saveAs: "confirmation")
    ↓
CONDITION (variables.confirmation === 'yes')
    ├─ TRUE → Continue
    └─ FALSE → Go back to input
```

### Pattern 3: Multi-Step Form

```
Collect Field 1 → Collect Field 2 → Collect Field 3 → Show Summary → Confirm → Submit
```

---

## Testing Your Workflows

1. **Test Happy Path**: User follows expected flow
2. **Test Timeouts**: Don't respond within timeout period
3. **Test Invalid Input**: Send unexpected responses
4. **Test Edge Cases**: Empty messages, very long text
5. **Test Cancellation**: User wants to exit mid-flow

---

## Conclusion

These examples demonstrate the flexibility of N9N. You can create:

- Simple Q&A bots
- Complex multi-step forms
- Conditional routing
- Timeout handling
- Multi-language support

Start with simple workflows and gradually add complexity as needed!




