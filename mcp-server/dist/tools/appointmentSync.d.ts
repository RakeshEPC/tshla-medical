interface Appointment {
    id: string;
    doctorName: string;
    doctorId?: string;
    patientName: string;
    patientId?: string;
    date: string;
    time: string;
    duration: number;
    visitType: string;
    visitReason: string;
    status: string;
    location?: string;
    isVirtual?: boolean;
}
interface SyncResult {
    success: boolean;
    message: string;
    processed: number;
    added: number;
    updated: number;
    skipped: number;
    errors: string[];
}
export declare function syncAppointments(appointments: Appointment[], mode?: 'merge' | 'replace'): Promise<SyncResult>;
export {};
//# sourceMappingURL=appointmentSync.d.ts.map