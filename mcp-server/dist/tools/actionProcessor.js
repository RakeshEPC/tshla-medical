const ACTION_PATTERNS = {
    medication: [
        /start\s+(\w+)/gi,
        /prescribe\s+(\w+)/gi,
        /continue\s+(\w+)/gi,
        /increase\s+(\w+)/gi,
        /decrease\s+(\w+)/gi,
        /stop\s+(\w+)/gi,
        /discontinue\s+(\w+)/gi,
        /switch\s+to\s+(\w+)/gi,
        /change\s+(\w+)\s+to/gi,
        /add\s+(\w+)\s+medication/gi
    ],
    lab: [
        /order\s+(lab|labs|blood\s+work|blood\s+test)/gi,
        /check\s+(A1C|HbA1c|glucose|cholesterol|lipid|TSH|thyroid)/gi,
        /repeat\s+(lab|labs|blood\s+work)/gi,
        /get\s+(lab|labs|blood\s+work)/gi,
        /schedule\s+(lab|labs|blood\s+work)/gi,
        /obtain\s+(CBC|CMP|BMP|UA|urinalysis)/gi
    ],
    referral: [
        /refer\s+to\s+(\w+)/gi,
        /consult\s+(\w+)/gi,
        /send\s+to\s+(\w+)/gi,
        /schedule\s+with\s+(\w+)/gi,
        /see\s+(\w+\s+specialist)/gi
    ],
    followUp: [
        /follow[\s-]?up\s+in\s+(\d+\s+\w+)/gi,
        /return\s+in\s+(\d+\s+\w+)/gi,
        /see\s+back\s+in\s+(\d+\s+\w+)/gi,
        /schedule\s+follow[\s-]?up/gi,
        /come\s+back\s+in\s+(\d+\s+\w+)/gi
    ]
};
export async function processActionItems(actionText, source, doctorId) {
    const actions = [];
    const lines = actionText.split(/[.\n]/).filter(line => line.trim());
    const summary = {
        totalActions: 0,
        byType: {},
        byPriority: {}
    };
    let actionIdCounter = 1;
    for (const line of lines) {
        // Check for medication actions
        for (const pattern of ACTION_PATTERNS.medication) {
            const matches = line.matchAll(pattern);
            for (const match of matches) {
                const action = {
                    id: `action-${Date.now()}-${actionIdCounter++}`,
                    type: 'medication',
                    action: determineActionFromText(match[0]),
                    details: match[0],
                    doctorId,
                    priority: determinePriority(match[0]),
                    status: 'pending',
                    createdAt: new Date().toISOString()
                };
                // Extract medication name if possible
                if (match[1]) {
                    action.details = `${action.action}: ${match[1]}`;
                }
                actions.push(action);
                summary.totalActions++;
                summary.byType['medication'] = (summary.byType['medication'] || 0) + 1;
                summary.byPriority[action.priority] = (summary.byPriority[action.priority] || 0) + 1;
            }
        }
        // Check for lab actions
        for (const pattern of ACTION_PATTERNS.lab) {
            const matches = line.matchAll(pattern);
            for (const match of matches) {
                const action = {
                    id: `action-${Date.now()}-${actionIdCounter++}`,
                    type: 'lab',
                    action: 'Order Lab',
                    details: match[0],
                    doctorId,
                    priority: determinePriority(match[0]),
                    status: 'pending',
                    createdAt: new Date().toISOString()
                };
                if (match[1]) {
                    action.details = `Order: ${match[1]}`;
                }
                actions.push(action);
                summary.totalActions++;
                summary.byType['lab'] = (summary.byType['lab'] || 0) + 1;
                summary.byPriority[action.priority] = (summary.byPriority[action.priority] || 0) + 1;
            }
        }
        // Check for referral actions
        for (const pattern of ACTION_PATTERNS.referral) {
            const matches = line.matchAll(pattern);
            for (const match of matches) {
                const action = {
                    id: `action-${Date.now()}-${actionIdCounter++}`,
                    type: 'referral',
                    action: 'Referral',
                    details: match[0],
                    doctorId,
                    priority: 'medium',
                    status: 'pending',
                    createdAt: new Date().toISOString()
                };
                if (match[1]) {
                    action.details = `Refer to: ${match[1]}`;
                }
                actions.push(action);
                summary.totalActions++;
                summary.byType['referral'] = (summary.byType['referral'] || 0) + 1;
                summary.byPriority[action.priority] = (summary.byPriority[action.priority] || 0) + 1;
            }
        }
        // Check for follow-up actions
        for (const pattern of ACTION_PATTERNS.followUp) {
            const matches = line.matchAll(pattern);
            for (const match of matches) {
                const action = {
                    id: `action-${Date.now()}-${actionIdCounter++}`,
                    type: 'follow-up',
                    action: 'Schedule Follow-up',
                    details: match[0],
                    doctorId,
                    priority: 'low',
                    status: 'pending',
                    createdAt: new Date().toISOString()
                };
                if (match[1]) {
                    action.details = `Follow-up in: ${match[1]}`;
                    action.dueDate = calculateDueDate(match[1]);
                }
                actions.push(action);
                summary.totalActions++;
                summary.byType['follow-up'] = (summary.byType['follow-up'] || 0) + 1;
                summary.byPriority[action.priority] = (summary.byPriority[action.priority] || 0) + 1;
            }
        }
    }
    return {
        success: actions.length > 0,
        actions,
        summary
    };
}
function determineActionFromText(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('start'))
        return 'Start Medication';
    if (lowerText.includes('stop') || lowerText.includes('discontinue'))
        return 'Stop Medication';
    if (lowerText.includes('increase'))
        return 'Increase Dose';
    if (lowerText.includes('decrease'))
        return 'Decrease Dose';
    if (lowerText.includes('continue'))
        return 'Continue Medication';
    if (lowerText.includes('switch') || lowerText.includes('change'))
        return 'Change Medication';
    if (lowerText.includes('prescribe'))
        return 'Prescribe';
    if (lowerText.includes('add'))
        return 'Add Medication';
    return 'Medication Action';
}
function determinePriority(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('urgent') || lowerText.includes('stat') || lowerText.includes('immediately')) {
        return 'high';
    }
    if (lowerText.includes('stop') || lowerText.includes('discontinue') || lowerText.includes('start')) {
        return 'high';
    }
    if (lowerText.includes('follow-up') || lowerText.includes('routine')) {
        return 'low';
    }
    return 'medium';
}
function calculateDueDate(timeString) {
    const match = timeString.match(/(\d+)\s+(\w+)/);
    if (!match)
        return '';
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const now = new Date();
    let dueDate = new Date(now);
    if (unit.includes('day')) {
        dueDate.setDate(now.getDate() + amount);
    }
    else if (unit.includes('week')) {
        dueDate.setDate(now.getDate() + (amount * 7));
    }
    else if (unit.includes('month')) {
        dueDate.setMonth(now.getMonth() + amount);
    }
    return dueDate.toISOString().split('T')[0];
}
//# sourceMappingURL=actionProcessor.js.map