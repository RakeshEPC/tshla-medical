/**
 * Educational content for PumpDrive results page
 * Helps users understand their recommendations and make informed decisions
 */

export interface EducationalContent {
  title: string;
  description: string;
  details?: string;
  icon?: string;
}

export const resultInterpretation = {
  matchScore: {
    title: "What Does Match Score Mean?",
    description: "Your match score (0-100%) shows how well this pump aligns with YOUR specific needs, lifestyle, and preferences.",
    details: `
      • 90-100%: Excellent match - This pump addresses nearly all your priorities
      • 80-89%: Very good match - Meets most of your key requirements
      • 70-79%: Good match - Satisfies many important needs
      • Below 70%: May require compromises on some priorities

      Remember: A high score means this pump fits YOUR situation well, based on what you told us matters most to you.
    `,
    icon: "📊"
  },
  confidenceScore: {
    title: "Understanding Confidence Level",
    description: "Confidence reflects how certain our AI is about this recommendation based on your clear preferences and the available data.",
    details: `
      • High confidence (85-100%): Your preferences clearly point to this pump
      • Medium confidence (70-84%): Good match, but multiple options could work well
      • Lower confidence (<70%): Several pumps may suit your needs equally

      Lower confidence isn't bad - it means you have flexibility and options!
    `,
    icon: "🎯"
  },
  howToUse: {
    title: "What to Do With This Information",
    description: "These results are designed to guide your conversation with your healthcare provider - not replace it.",
    details: `
      1. Review your top recommendation and understand why it was chosen
      2. Read through the alternatives to see other options
      3. Note questions that come up as you review
      4. Discuss these results with your diabetes care team
      5. Your doctor will consider medical factors we don't have access to
      6. Together, you'll make the final decision

      This is a starting point for an informed conversation, not a prescription.
    `,
    icon: "💡"
  }
};

export const pumpFeatureEducation: Record<string, EducationalContent> = {
  automation: {
    title: "Automated Insulin Delivery (AID)",
    description: "The pump automatically adjusts insulin based on CGM readings to help keep blood sugar in range.",
    details: `Modern insulin pumps can automatically increase or decrease background insulin delivery based on your continuous glucose monitor readings. This happens every few minutes, 24/7, helping reduce highs and lows while you sleep, work, or go about your day.

Some systems are more aggressive (make bigger adjustments faster) while others are more conservative. Neither is "better" - it depends on your comfort level and diabetes patterns.`,
    icon: "🤖"
  },
  tubing: {
    title: "Tubing vs. Tubeless",
    description: "How the pump connects to your body affects convenience, discretion, and daily wear.",
    details: `
Tubed pumps: Connect via a thin tube to an infusion set on your body. The pump can be clipped to clothing or a belt.
• Pros: Larger insulin reservoir, easier to disconnect for swimming/intimacy
• Cons: Tubing can get caught on things, may be visible under tight clothing

Tubeless (patch) pumps: Stick directly on your skin, controlled wirelessly
• Pros: No tubing to snag, more discreet, great for active lifestyles
• Cons: Entire unit disposed of when insulin runs out, adhesive stays on 3 days`,
    icon: "🔌"
  },
  cgmCompatibility: {
    title: "CGM Compatibility",
    description: "Which continuous glucose monitors work with this pump for automated insulin delivery.",
    details: `Not all pumps work with all CGMs. Some only work with one specific CGM brand, while others offer more flexibility.

Important considerations:
• Does it work with the CGM you already use and like?
• If not, would you be willing to switch?
• Some CGMs require a separate receiver; others use your phone
• Insurance may cover certain CGM/pump combinations better than others

Your choice of pump may determine which CGM you use (or vice versa).`,
    icon: "📱"
  },
  phoneControl: {
    title: "Phone Control & Connectivity",
    description: "Whether you can give insulin doses, view data, and control settings from your smartphone.",
    details: `
Full phone control: Deliver bolus doses directly from your phone app
• Super convenient - no need to pull out a separate device
• Discreet dosing in social situations
• Requires keeping phone charged and nearby

View-only apps: See pump data and CGM readings, but can't dose insulin
• Helpful for monitoring, but less convenient for dosing
• Some people prefer keeping dosing on a dedicated device

No phone required: Some pumps work entirely standalone
• May appeal if you prefer not mixing diabetes with phone`,
    icon: "📲"
  },
  batteryType: {
    title: "Battery Type",
    description: "How the pump is powered and what maintenance it requires.",
    details: `
Rechargeable batteries:
• Charge every few days like a phone
• No battery replacements to buy
• Must remember to charge (or have backup pump/insulin plan)

Replaceable AAA batteries:
• Swap in standard batteries when needed
• No waiting for charging
• Need to keep spare batteries on hand

Integrated pod systems:
• Battery built into disposable pod
• No charging or battery swaps
• Automatically replaced when you change pods`,
    icon: "🔋"
  },
  exerciseMode: {
    title: "Exercise & Activity Features",
    description: "Special settings to help manage blood sugar during and after physical activity.",
    details: `Exercise makes blood sugar management tricky. Many pumps offer special modes:

Temporary target raises: Tell the pump you want a higher target during exercise
• Reduces insulin delivery to prevent lows
• Can be scheduled ahead or activated on demand

Exercise profiles: Pre-programmed settings for different activity types
• "Cardio" mode for running, biking
• "Strength" mode for weight training
• Some pumps "learn" your patterns over time

How long it takes to activate and how customizable it is varies by pump.`,
    icon: "🏃"
  },
  reservoirSize: {
    title: "Insulin Reservoir Capacity",
    description: "How much insulin the pump holds and how often you'll need to refill.",
    details: `
Large reservoirs (300 units):
• Refill less often - may last 5-7 days
• Better if you use a lot of insulin
• Gives more flexibility between changes

Medium reservoirs (200 units):
• Balance of convenience and size
• Good for average insulin users
• Typically 3-5 days between refills

Small reservoirs (pods, ~200 units):
• Usually 3-day pods
• Built-in refill schedule
• May waste insulin if you use very little

Consider: How much insulin do you use per day? Multiply by 3-4 days to estimate needs.`,
    icon: "💧"
  },
  waterResistance: {
    title: "Water Resistance & Swimming",
    description: "Whether you can shower, swim, or get wet while wearing the pump.",
    details: `
Waterproof (submersible):
• Can wear in shower, pool, ocean
• No need to disconnect for water activities
• One less thing to think about

Water-resistant only:
• Splashes OK, but should disconnect for swimming
• Must remove or protect during showers
• Quick disconnects available for tubed pumps

For active water enthusiasts (swimming, surfing, water sports), waterproof is often a must-have.`,
    icon: "🏊"
  },
  bolusSpeed: {
    title: "Bolus Delivery & Speed",
    description: "How quickly the pump can deliver mealtime insulin and how easy it is to dose.",
    details: `
Fast bolus delivery:
• Large doses delivered in seconds to minutes
• More convenient at mealtimes
• Some people prefer knowing insulin is "in"

Slower delivery:
• May take several minutes for large doses
• Some find it less noticeable on the body
• Less of a difference for smaller doses

Ease of dosing:
• How many button clicks to give insulin?
• Can you dose from your phone?
• Is it easy to do discreetly at a restaurant?`,
    icon: "⚡"
  }
};

export const nextSteps = {
  questionsForProvider: {
    title: "Questions to Ask Your Healthcare Provider",
    questions: [
      "Does this pump work with my current CGM, or would I need to switch?",
      "How does my insurance cover this pump compared to alternatives?",
      "What does the training process look like, and how long does it take?",
      "Do you have other patients using this pump? What has their experience been?",
      "Are there any medical reasons why this pump might not be ideal for me?",
      "What supplies do I need to order, and how often?",
      "What's the backup plan if the pump malfunctions?",
      "How do I get 24/7 technical support if something goes wrong?",
      "Can I try a demo or sample before committing?",
      "What's the process if I want to switch to a different pump later?"
    ]
  },
  whatToExpect: {
    title: "What to Expect Next",
    steps: [
      {
        title: "Insurance Approval",
        description: "Your provider's office will submit paperwork to insurance. This can take 2-6 weeks.",
        icon: "📋"
      },
      {
        title: "Pump Training",
        description: "You'll receive 2-4 hours of training on how to use your new pump, usually in-person with a diabetes educator.",
        icon: "🎓"
      },
      {
        title: "Initial Adjustment Period",
        description: "Expect 2-4 weeks to get settings dialed in. Your care team will help you make adjustments.",
        icon: "⚙️"
      },
      {
        title: "Follow-up Appointments",
        description: "Plan for more frequent check-ins during the first few months as you optimize your settings.",
        icon: "📅"
      }
    ]
  },
  learningResources: {
    title: "Continue Learning",
    description: "These resources can help you learn more about your recommended pump:",
    resources: [
      {
        type: "Manufacturer Website",
        description: "Visit the manufacturer's website for detailed specifications, user guides, and video tutorials"
      },
      {
        type: "Online Communities",
        description: "Connect with other users on Facebook groups, Reddit (r/diabetes), or diabetes forums"
      },
      {
        type: "YouTube Reviews",
        description: "Search for real user reviews and day-in-the-life videos showing the pump in action"
      },
      {
        type: "Your Diabetes Team",
        description: "Schedule time with your endocrinologist and diabetes educator to discuss in detail"
      }
    ]
  }
};

export const decisionFactorsEducation = {
  title: "How We Made This Recommendation",
  description: "Our AI analyzed your responses across multiple dimensions to find the best match.",
  explanation: `
We considered:
• Your lifestyle and daily routines (work, exercise, sleep patterns)
• Your technology comfort level and preferences
• Features you said were most important to you
• Your challenges and goals you described
• How different pumps handle the scenarios you face

The recommendation isn't just about features - it's about finding the pump that fits YOUR life.
  `
};

export const comparisonEducation = {
  title: "Comparing Your Options",
  description: "Here's how to think about the alternatives:",
  guidance: `
The top recommendation scored highest for YOUR specific situation, but that doesn't mean the alternatives are "worse" pumps. They might be:

• Better for different priorities (e.g., if discretion mattered more than cost)
• Equally good options if your needs change
• Worth considering if insurance coverage differs significantly
• Preferred by your specific healthcare provider

Some people find it helpful to research all 3 top options before making a final decision.
  `
};

export const importantDisclaimers = {
  medical: "This recommendation is educational only and not medical advice. Your healthcare provider must approve any insulin pump choice based on your full medical history.",
  insurance: "Insurance coverage varies significantly. A pump that's recommended may have different out-of-pocket costs than alternatives. Always verify coverage before deciding.",
  accuracy: "Pump features and specifications can change. Always verify current details with manufacturers and your healthcare team.",
  individual: "Everyone's diabetes is different. What works well for others may not be ideal for you, and vice versa."
};

export const glossary: Record<string, string> = {
  "Hybrid Closed Loop": "A system that automatically adjusts background insulin but still requires you to manually dose for meals",
  "Basal Rate": "Background insulin delivered continuously throughout the day and night",
  "Bolus": "Extra insulin dose given for meals or to correct high blood sugar",
  "CGM": "Continuous Glucose Monitor - a sensor that checks blood sugar every few minutes",
  "Infusion Set": "The tube and cannula that deliver insulin from a tubed pump into your body",
  "Pod": "A tubeless, disposable pump unit that sticks to your skin and holds insulin",
  "Control-IQ / iLet / SmartGuard": "Brand names for automated insulin delivery algorithms",
  "Carb Ratio": "How many grams of carbs are covered by 1 unit of insulin (e.g., 1:10)",
  "ISF": "Insulin Sensitivity Factor - how much one unit of insulin lowers your blood sugar",
  "Target Range": "The blood sugar range you want the pump to keep you in (e.g., 100-120 mg/dL)"
};
