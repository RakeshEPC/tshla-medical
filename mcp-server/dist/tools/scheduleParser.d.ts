interface ParsedAppointment {
    id: string;
    doctorName: string;
    doctorId?: string;
    patientName: string;
    patientAge?: string;
    patientGender?: string;
    patientDOB?: string;
    date: string;
    time: string;
    duration: number;
    visitType: string;
    visitReason: string;
    status: 'scheduled' | 'open' | 'frozen';
    location?: string;
    isVirtual: boolean;
}
interface ParseResult {
    success: boolean;
    appointments: ParsedAppointment[];
    errors: string[];
    summary: {
        totalAppointments: number;
        byDoctor: Record<string, number>;
        openSlots: number;
        virtualVisits: number;
    };
}
export declare function parseScheduleData(scheduleText: string, dateStr?: string): Promise<ParseResult>;
export {};
//# sourceMappingURL=scheduleParser.d.ts.map