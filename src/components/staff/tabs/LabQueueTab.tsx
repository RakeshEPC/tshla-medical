/**
 * Lab Queue Tab
 * Pending and urgent lab orders
 */

import { usePCMLabs } from '../../../hooks/usePCMLabs';

export default function LabQueueTab() {
  const { pendingLabs, isLoading } = usePCMLabs({ autoLoad: true });

  return (
    <div>
      <p className="text-gray-600 mb-4">
        Pending labs: {pendingLabs.length}
      </p>
      {/* Reuse existing PCMLabOrders component here */}
      <div className="text-sm text-gray-500">
        TODO: Import PCMLabOrders component
      </div>
    </div>
  );
}
