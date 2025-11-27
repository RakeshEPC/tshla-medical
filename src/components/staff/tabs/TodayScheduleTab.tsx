/**
 * Today's Schedule Tab
 * Shows appointments for selected date
 */

import DailyPatientList from '../../doctor/DailyPatientList';
import { useSchedule } from '../../../hooks/useSchedule';

interface TodayScheduleTabProps {
  selectedDate: Date;
  selectedProvider: string;
  onDateChange: (date: Date) => void;
  onProviderChange: (provider: string) => void;
}

export default function TodayScheduleTab({
  selectedDate,
  selectedProvider,
  onDateChange,
  onProviderChange
}: TodayScheduleTabProps) {
  const { appointments, isLoading } = useSchedule({
    selectedProviders: selectedProvider === 'ALL' ? ['ALL'] : [selectedProvider],
    date: selectedDate,
    autoRefresh: true
  });

  return (
    <div>
      <DailyPatientList
        appointments={appointments}
        isLoading={isLoading}
        selectedDate={selectedDate}
      />
    </div>
  );
}
