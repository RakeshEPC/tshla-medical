interface ActionItem {
    id: string;
    type: 'medication' | 'lab' | 'referral' | 'follow-up' | 'other';
    action: string;
    details: string;
    patientName?: string;
    patientId?: string;
    doctorId?: string;
    doctorName?: string;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'in-progress' | 'completed';
    createdAt: string;
    dueDate?: string;
}
interface ProcessResult {
    success: boolean;
    actions: ActionItem[];
    summary: {
        totalActions: number;
        byType: Record<string, number>;
        byPriority: Record<string, number>;
    };
}
export declare function processActionItems(actionText: string, source?: string, doctorId?: string): Promise<ProcessResult>;
export {};
//# sourceMappingURL=actionProcessor.d.ts.map