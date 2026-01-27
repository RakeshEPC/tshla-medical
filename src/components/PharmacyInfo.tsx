/**
 * Pharmacy Information Component
 * Allows patients to view and edit their preferred pharmacy
 * Created: 2026-01-26
 */

import { useState, useEffect } from 'react';
import {
  MapPin,
  Phone,
  Edit2,
  Save,
  X,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface PharmacyData {
  preferred_pharmacy_name: string | null;
  preferred_pharmacy_phone: string | null;
  preferred_pharmacy_address: string | null;
  preferred_pharmacy_fax: string | null;
}

interface PharmacyInfoProps {
  tshlaId: string;
  sessionId: string;
}

export default function PharmacyInfo({ tshlaId, sessionId }: PharmacyInfoProps) {
  const [pharmacy, setPharmacy] = useState<PharmacyData>({
    preferred_pharmacy_name: null,
    preferred_pharmacy_phone: null,
    preferred_pharmacy_address: null,
    preferred_pharmacy_fax: null
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    pharmacyName: '',
    pharmacyPhone: '',
    pharmacyAddress: '',
    pharmacyFax: ''
  });

  useEffect(() => {
    loadPharmacyInfo();
  }, [tshlaId]);

  const loadPharmacyInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/patient-portal/patients/${tshlaId}`, {
        headers: {
          'x-session-id': sessionId
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load pharmacy information');
      }

      const pharmacyData = {
        preferred_pharmacy_name: data.patient.preferred_pharmacy_name,
        preferred_pharmacy_phone: data.patient.preferred_pharmacy_phone,
        preferred_pharmacy_address: data.patient.preferred_pharmacy_address,
        preferred_pharmacy_fax: data.patient.preferred_pharmacy_fax
      };

      setPharmacy(pharmacyData);

      // Initialize edit form
      setEditForm({
        pharmacyName: pharmacyData.preferred_pharmacy_name || '',
        pharmacyPhone: pharmacyData.preferred_pharmacy_phone || '',
        pharmacyAddress: pharmacyData.preferred_pharmacy_address || '',
        pharmacyFax: pharmacyData.preferred_pharmacy_fax || ''
      });

    } catch (err: any) {
      console.error('Error loading pharmacy info:', err);
      setError(err.message || 'Failed to load pharmacy information');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    setError(null);
    setSuccessMessage(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({
      pharmacyName: pharmacy.preferred_pharmacy_name || '',
      pharmacyPhone: pharmacy.preferred_pharmacy_phone || '',
      pharmacyAddress: pharmacy.preferred_pharmacy_address || '',
      pharmacyFax: pharmacy.preferred_pharmacy_fax || ''
    });
    setError(null);
  };

  const savePharmacyInfo = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/patient-portal/patients/${tshlaId}/pharmacy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          pharmacyName: editForm.pharmacyName || null,
          pharmacyPhone: editForm.pharmacyPhone || null,
          pharmacyAddress: editForm.pharmacyAddress || null,
          pharmacyFax: editForm.pharmacyFax || null
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save pharmacy information');
      }

      // Update local state
      setPharmacy({
        preferred_pharmacy_name: editForm.pharmacyName || null,
        preferred_pharmacy_phone: editForm.pharmacyPhone || null,
        preferred_pharmacy_address: editForm.pharmacyAddress || null,
        preferred_pharmacy_fax: editForm.pharmacyFax || null
      });

      setSuccessMessage('Pharmacy information updated successfully!');
      setIsEditing(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      console.error('Error saving pharmacy info:', err);
      setError(err.message || 'Failed to save pharmacy information');
    } finally {
      setIsSaving(false);
    }
  };

  const hasPharmacyInfo = !!(
    pharmacy.preferred_pharmacy_name ||
    pharmacy.preferred_pharmacy_phone ||
    pharmacy.preferred_pharmacy_address
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
        <p className="text-sm text-gray-600">Loading pharmacy information...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Pharmacy Information</h3>
              <p className="text-sm text-gray-600">Your preferred pharmacy for prescriptions</p>
            </div>
          </div>

          {!isEditing && (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
            >
              <Edit2 className="w-4 h-4" />
              {hasPharmacyInfo ? 'Edit' : 'Add Pharmacy'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
            <CheckCircle className="w-4 h-4" />
            <p className="text-sm">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Edit Mode */}
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pharmacy Name *
              </label>
              <input
                type="text"
                value={editForm.pharmacyName}
                onChange={(e) => setEditForm({ ...editForm, pharmacyName: e.target.value })}
                placeholder="e.g., CVS Pharmacy, Walgreens"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={editForm.pharmacyPhone}
                onChange={(e) => setEditForm({ ...editForm, pharmacyPhone: e.target.value })}
                placeholder="(123) 456-7890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                value={editForm.pharmacyAddress}
                onChange={(e) => setEditForm({ ...editForm, pharmacyAddress: e.target.value })}
                placeholder="123 Main St, City, State ZIP"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fax Number (Optional)
              </label>
              <input
                type="tel"
                value={editForm.pharmacyFax}
                onChange={(e) => setEditForm({ ...editForm, pharmacyFax: e.target.value })}
                placeholder="(123) 456-7890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={savePharmacyInfo}
                disabled={isSaving || !editForm.pharmacyName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Pharmacy Info
                  </>
                )}
              </button>

              <button
                onClick={cancelEditing}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div>
            {hasPharmacyInfo ? (
              <div className="space-y-3">
                {pharmacy.preferred_pharmacy_name && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Pharmacy Name</p>
                    <p className="text-base font-medium text-gray-900">
                      {pharmacy.preferred_pharmacy_name}
                    </p>
                  </div>
                )}

                {pharmacy.preferred_pharmacy_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a
                      href={`tel:${pharmacy.preferred_pharmacy_phone}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {pharmacy.preferred_pharmacy_phone}
                    </a>
                  </div>
                )}

                {pharmacy.preferred_pharmacy_address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <p className="text-sm text-gray-700">{pharmacy.preferred_pharmacy_address}</p>
                  </div>
                )}

                {pharmacy.preferred_pharmacy_fax && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fax</p>
                    <p className="text-sm text-gray-700">{pharmacy.preferred_pharmacy_fax}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-2">No Pharmacy Added</p>
                <p className="text-sm text-gray-500 mb-4">
                  Add your preferred pharmacy to help us process your prescriptions faster
                </p>
                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  <Edit2 className="w-4 h-4" />
                  Add Pharmacy Information
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
