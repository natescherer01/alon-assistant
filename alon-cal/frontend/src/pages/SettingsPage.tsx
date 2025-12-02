import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import UserMenu from '../components/UserMenu';
import { getCommonTimezones, formatTimezone, getUserTimezone } from '../utils/dateTime';

export default function SettingsPage() {
  const { user, updateSettings } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'preferences'>('profile');
  const [selectedTimezone, setSelectedTimezone] = useState(user?.timezone || getUserTimezone());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sleep hours state - use ?? to preserve null distinction from empty string
  const [sleepStartTime, setSleepStartTime] = useState(user?.sleepStartTime ?? '');
  const [sleepEndTime, setSleepEndTime] = useState(user?.sleepEndTime ?? '');
  const [isSavingSleep, setIsSavingSleep] = useState(false);
  const [sleepSaveSuccess, setSleepSaveSuccess] = useState(false);
  const [sleepSaveError, setSleepSaveError] = useState<string | null>(null);

  const handleSaveTimezone = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await updateSettings({ timezone: selectedTimezone });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save timezone');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = selectedTimezone !== (user?.timezone || getUserTimezone());

  const handleSaveSleepHours = async () => {
    setIsSavingSleep(true);
    setSleepSaveSuccess(false);
    setSleepSaveError(null);

    // Validation: both fields required if either is set
    if ((sleepStartTime && !sleepEndTime) || (!sleepStartTime && sleepEndTime)) {
      setSleepSaveError('Both sleep start and end times are required');
      setIsSavingSleep(false);
      return;
    }

    try {
      await updateSettings({
        sleepStartTime: sleepStartTime || null,
        sleepEndTime: sleepEndTime || null,
      });
      setSleepSaveSuccess(true);
      setTimeout(() => setSleepSaveSuccess(false), 3000);
    } catch (error) {
      setSleepSaveError(error instanceof Error ? error.message : 'Failed to save sleep hours');
    } finally {
      setIsSavingSleep(false);
    }
  };

  const handleClearSleepHours = async () => {
    setIsSavingSleep(true);
    setSleepSaveSuccess(false);
    setSleepSaveError(null);

    try {
      await updateSettings({
        sleepStartTime: null,
        sleepEndTime: null,
      });
      setSleepStartTime('');
      setSleepEndTime('');
      setSleepSaveSuccess(true);
      setTimeout(() => setSleepSaveSuccess(false), 3000);
    } catch (error) {
      setSleepSaveError(error instanceof Error ? error.message : 'Failed to clear sleep hours');
    } finally {
      setIsSavingSleep(false);
    }
  };

  const hasSleepChanges =
    sleepStartTime !== (user?.sleepStartTime || '') ||
    sleepEndTime !== (user?.sleepEndTime || '');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <h1 className="text-2xl font-bold text-blue-600">Alon-Cal</h1>
              </Link>
            </div>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Settings</h2>
          <p className="text-gray-600">Manage your account settings and preferences.</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'profile'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'account'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Account
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'preferences'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Preferences
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Profile Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={user?.name || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Profile editing coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Account Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        Account Status
                      </h4>
                      <p className="text-sm text-gray-600">
                        Your account is active and in good standing.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-red-900 mb-2">
                        Danger Zone
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Account deletion coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Display Preferences
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timezone
                      </label>
                      <select
                        value={selectedTimezone}
                        onChange={(e) => setSelectedTimezone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {getCommonTimezones().map((tz) => (
                          <option key={tz} value={tz}>
                            {formatTimezone(tz)}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-sm text-gray-500">
                        This timezone will be used for displaying event times and the live clock.
                      </p>
                    </div>

                    {saveSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3" role="alert">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-green-800">Timezone saved successfully!</span>
                        </div>
                      </div>
                    )}

                    {saveError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-sm text-red-800">{saveError}</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-4">
                      <button
                        onClick={handleSaveTimezone}
                        disabled={!hasChanges || isSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sleep Hours Section */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Sleep Hours
                  </h3>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Set your typical sleep hours. Free time calculations will exclude these periods.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="sleepStartTime" className="block text-sm font-medium text-gray-700 mb-2">
                          Sleep Start
                        </label>
                        <input
                          id="sleepStartTime"
                          type="time"
                          value={sleepStartTime}
                          onChange={(e) => setSleepStartTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          aria-label="Sleep start time"
                        />
                      </div>

                      <div>
                        <label htmlFor="sleepEndTime" className="block text-sm font-medium text-gray-700 mb-2">
                          Sleep End
                        </label>
                        <input
                          id="sleepEndTime"
                          type="time"
                          value={sleepEndTime}
                          onChange={(e) => setSleepEndTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          aria-label="Sleep end time"
                        />
                      </div>
                    </div>

                    {sleepSaveSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3" role="alert">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-green-800">Sleep hours saved successfully!</span>
                        </div>
                      </div>
                    )}

                    {sleepSaveError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-sm text-red-800">{sleepSaveError}</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 flex gap-3">
                      <button
                        onClick={handleClearSleepHours}
                        disabled={(!sleepStartTime && !sleepEndTime) || isSavingSleep}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleSaveSleepHours}
                        disabled={!hasSleepChanges || isSavingSleep}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSavingSleep ? 'Saving...' : 'Save Sleep Hours'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
