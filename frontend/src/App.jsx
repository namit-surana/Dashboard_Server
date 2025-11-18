import { useState, useEffect } from 'react';

// Always use relative URL since backend serves frontend
const API_URL = '/api';

function App() {
  const [activeUsers, setActiveUsers] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [complianceQueue, setComplianceQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timePeriod, setTimePeriod] = useState(30);
  const [feedbackFilter, setFeedbackFilter] = useState('all');
  const [expandedFeedback, setExpandedFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'feedback', or 'compliance'
  const [editingUrl, setEditingUrl] = useState(null); // Track which URL is being edited
  const [editedUrlValue, setEditedUrlValue] = useState(''); // Track the edited URL value
  const [editingComplianceName, setEditingComplianceName] = useState(null); // Track which compliance name is being edited
  const [editedComplianceNameValue, setEditedComplianceNameValue] = useState(''); // Track the edited compliance name value
  const [complianceStatusFilter, setComplianceStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'in_progress'
  const [showWebscrapConfirm, setShowWebscrapConfirm] = useState(false); // Show confirmation dialog

  useEffect(() => {
    fetchData();
  }, [timePeriod, feedbackFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch active users
      const usersResponse = await fetch(`${API_URL}/active-users?days=${timePeriod}`);
      const usersData = await usersResponse.json();

      // Fetch stats
      const statsResponse = await fetch(`${API_URL}/stats?days=${timePeriod}`);
      const statsData = await statsResponse.json();

      // Fetch feedbacks
      const feedbacksResponse = await fetch(`${API_URL}/feedbacks?days=${timePeriod}&type=${feedbackFilter}`);
      const feedbacksData = await feedbacksResponse.json();

      // Fetch compliance queue
      const complianceResponse = await fetch(`${API_URL}/compliance-queue`);
      const complianceData = await complianceResponse.json();

      if (usersData.success && statsData.success && feedbacksData.success && complianceData.success) {
        setActiveUsers(usersData.data);
        setStats(statsData.data);
        setFeedbacks(feedbacksData.data);
        setComplianceQueue(complianceData.data);
      } else {
        setError('Failed to fetch data');
      }
    } catch (err) {
      setError('Error connecting to server. Make sure the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (complianceId) => {
    try {
      const response = await fetch(`${API_URL}/compliance-queue/${complianceId}/approve`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        // Update the local state
        setComplianceQueue(complianceQueue.map(item =>
          item.compliance_id === complianceId ? { ...item, status: 'approved' } : item
        ));
      } else {
        alert('Failed to approve: ' + data.error);
      }
    } catch (err) {
      console.error('Error approving:', err);
      alert('Error approving compliance artifact');
    }
  };

  const handleDisapprove = async (complianceId) => {
    try {
      const response = await fetch(`${API_URL}/compliance-queue/${complianceId}/disapprove`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        // Remove the item from the local state since it's deleted from the database
        setComplianceQueue(complianceQueue.filter(item => item.compliance_id !== complianceId));
      } else {
        alert('Failed to disapprove: ' + data.error);
      }
    } catch (err) {
      console.error('Error disapproving:', err);
      alert('Error disapproving compliance artifact');
    }
  };

  const handleRevertToPending = async (complianceId) => {
    try {
      const response = await fetch(`${API_URL}/compliance-queue/${complianceId}/revert`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        // Update the local state
        setComplianceQueue(complianceQueue.map(item =>
          item.compliance_id === complianceId ? { ...item, status: 'pending' } : item
        ));
      } else {
        alert('Failed to revert: ' + data.error);
      }
    } catch (err) {
      console.error('Error reverting:', err);
      alert('Error reverting compliance artifact');
    }
  };

  const handleEditUrl = (complianceId, currentUrl) => {
    setEditingUrl(complianceId);
    setEditedUrlValue(currentUrl || '');
  };

  const handleSaveUrl = async (complianceId) => {
    try {
      const response = await fetch(`${API_URL}/compliance-queue/${complianceId}/update-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: editedUrlValue }),
      });
      const data = await response.json();

      if (data.success) {
        // Update the local state
        setComplianceQueue(complianceQueue.map(item =>
          item.compliance_id === complianceId ? { ...item, url: editedUrlValue } : item
        ));
        setEditingUrl(null);
        setEditedUrlValue('');
      } else {
        alert('Failed to update URL: ' + data.error);
      }
    } catch (err) {
      console.error('Error updating URL:', err);
      alert('Error updating URL');
    }
  };

  const handleCancelEdit = () => {
    setEditingUrl(null);
    setEditedUrlValue('');
  };

  const handleEditComplianceName = (complianceId, currentName) => {
    setEditingComplianceName(complianceId);
    setEditedComplianceNameValue(currentName || '');
  };

  const handleSaveComplianceName = async (complianceId) => {
    try {
      const response = await fetch(`${API_URL}/compliance-queue/${complianceId}/update-name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ compliance_name_translated: editedComplianceNameValue }),
      });
      const data = await response.json();

      if (data.success) {
        // Update the local state
        setComplianceQueue(complianceQueue.map(item =>
          item.compliance_id === complianceId ? { ...item, compliance_name_translated: editedComplianceNameValue } : item
        ));
        setEditingComplianceName(null);
        setEditedComplianceNameValue('');
      } else {
        alert('Failed to update compliance name: ' + data.error);
      }
    } catch (err) {
      console.error('Error updating compliance name:', err);
      alert('Error updating compliance name');
    }
  };

  const handleCancelComplianceNameEdit = () => {
    setEditingComplianceName(null);
    setEditedComplianceNameValue('');
  };

  const handleInitiateWebscrap = () => {
    setShowWebscrapConfirm(true);
  };

  const handleConfirmWebscrap = async () => {
    setShowWebscrapConfirm(false);

    // Show processing message
    alert('Processing started... This may take a while.');

    try {
      const response = await fetch(`${API_URL}/initiate-webscrap`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        if (data.count === 0) {
          alert('No approved items to process.');
        } else {
          alert(`Webscrap pipeline completed!\n\nTotal: ${data.count}\nSuccessful: ${data.successful}\nFailed: ${data.failed}`);
          // Refresh data to show updated statuses
          fetchData();
        }
      } else {
        alert('Failed to initiate pipeline: ' + data.error);
      }
    } catch (err) {
      console.error('Error initiating webscrap:', err);
      alert('Error initiating webscrap pipeline');
    }
  };

  const handleCancelWebscrap = () => {
    setShowWebscrapConfirm(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getTimePeriodText = () => {
    if (timePeriod === 1) return 'Last 24 hours';
    return `Last ${timePeriod} days`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900"> Dashboard</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Time Period Filter */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mr-3">Time Period:</label>
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Stats Cards Row 1 */}
        {!loading && stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Total Users</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">{stats.totalUsers}</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Active Users</div>
                <div className="text-3xl font-bold text-blue-600 mt-2">{stats.activeUsers}</div>
                <div className="text-xs text-gray-500 mt-1">{getTimePeriodText()}</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Active Sessions</div>
                <div className="text-3xl font-bold text-green-600 mt-2">{stats.activeSessions}</div>
                <div className="text-xs text-gray-500 mt-1">{getTimePeriodText()}</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Total Messages</div>
                <div className="text-3xl font-bold text-purple-600 mt-2">{stats.totalMessages}</div>
                <div className="text-xs text-gray-500 mt-1">{getTimePeriodText()}</div>
                {stats.messageTypeCounts && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>text-low:</span>
                        <span>
                          {stats.messageTypeCounts['text-low'] || 0} (
                          {stats.totalMessages > 0
                            ? ((stats.messageTypeCounts['text-low'] || 0) / stats.totalMessages * 100).toFixed(4)
                            : '0.0000'}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>text-minimal:</span>
                        <span>
                          {stats.messageTypeCounts['text-minimal'] || 0} (
                          {stats.totalMessages > 0
                            ? ((stats.messageTypeCounts['text-minimal'] || 0) / stats.totalMessages * 100).toFixed(4)
                            : '0.0000'}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Cards Row 2 - Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Total Feedback</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">{stats.totalFeedback}</div>
                <div className="text-xs text-gray-500 mt-1">{getTimePeriodText()}</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Positive Feedback</div>
                <div className="text-3xl font-bold text-green-600 mt-2">
                  👍 {stats.positiveFeedback}
                </div>
                <div className="text-xs text-gray-500 mt-1">{getTimePeriodText()}</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Negative Feedback</div>
                <div className="text-3xl font-bold text-red-600 mt-2">
                  👎 {stats.negativeFeedback}
                </div>
                <div className="text-xs text-gray-500 mt-1">{getTimePeriodText()}</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Positive Rate</div>
                <div className="text-3xl font-bold text-blue-600 mt-2">{stats.positiveRate}%</div>
                <div className="text-xs text-gray-500 mt-1">{getTimePeriodText()}</div>
              </div>
            </div>
          </>
        )}

        {/* Tab Navigation */}
        {!loading && (
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('users')}
                  className={`${
                    activeTab === 'users'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  Active Users ({activeUsers.length})
                </button>
                <button
                  onClick={() => setActiveTab('feedback')}
                  className={`${
                    activeTab === 'feedback'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  Feedback Analysis ({feedbacks.length})
                </button>
                <button
                  onClick={() => setActiveTab('compliance')}
                  className={`${
                    activeTab === 'compliance'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  Compliance Queue ({complianceQueue.length})
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Active Users Table */}
        {!loading && activeTab === 'users' && activeUsers.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Active Users ({activeUsers.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeUsers.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.company_name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(user.last_activity)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Data State for Users */}
        {!loading && activeTab === 'users' && activeUsers.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-500">No active users found in the last {timePeriod} {timePeriod === 1 ? 'day' : 'days'}</div>
          </div>
        )}

        {/* Compliance Queue Section */}
        {!loading && activeTab === 'compliance' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-semibold text-gray-800">
                  Compliance Queue ({complianceQueue.filter(item =>
                    complianceStatusFilter === 'all' || item.status === complianceStatusFilter
                  ).length})
                </h2>
                <select
                  value={complianceStatusFilter}
                  onChange={(e) => setComplianceStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending Only</option>
                  <option value="approved">Approved Only</option>
                  <option value="in_progress">In Progress Only</option>
                </select>
              </div>
              <div className="flex space-x-4 text-sm">
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mr-2">
                    Pending
                  </span>
                  <span className="text-gray-600">
                    {complianceQueue.filter(item => item.status === 'pending').length}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                    Approved
                  </span>
                  <span className="text-gray-600">
                    {complianceQueue.filter(item => item.status === 'approved').length}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                    In Progress
                  </span>
                  <span className="text-gray-600">
                    {complianceQueue.filter(item => item.status === 'in_progress').length}
                  </span>
                </div>
              </div>
            </div>

            {complianceQueue.filter(item =>
              complianceStatusFilter === 'all' || item.status === complianceStatusFilter
            ).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Compliance Name (Origin)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Compliance Name (Translated)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {complianceQueue
                      .filter(item => complianceStatusFilter === 'all' || item.status === complianceStatusFilter)
                      .map((item) => (
                      <tr key={item.compliance_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{item.compliance_name_origin || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {editingComplianceName === item.compliance_id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editedComplianceNameValue}
                                onChange={(e) => setEditedComplianceNameValue(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter compliance name"
                              />
                              <button
                                onClick={() => handleSaveComplianceName(item.compliance_id)}
                                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelComplianceNameEdit}
                                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="text-sm text-gray-900">{item.compliance_name_translated || 'N/A'}</div>
                              <button
                                onClick={() => handleEditComplianceName(item.compliance_id, item.compliance_name_translated)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingUrl === item.compliance_id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editedUrlValue}
                                onChange={(e) => setEditedUrlValue(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter URL"
                              />
                              <button
                                onClick={() => handleSaveUrl(item.compliance_id)}
                                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                                >
                                  {item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url}
                                </a>
                              ) : (
                                <span className="text-sm text-gray-400">N/A</span>
                              )}
                              <button
                                onClick={() => handleEditUrl(item.compliance_id, item.url)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.status === 'approved' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Approved
                            </span>
                          ) : item.status === 'in_progress' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                              In Progress
                            </span>
                          ) : item.status === 'disapproved' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Disapproved
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            {item.status === 'approved' ? (
                              <button
                                onClick={() => handleRevertToPending(item.compliance_id)}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                              >
                                Revert to Pending
                              </button>
                            ) : item.status === 'in_progress' ? (
                              <span className="text-xs text-gray-500 flex items-center">
                                <svg className="animate-spin h-4 w-4 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleApprove(item.compliance_id)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleDisapprove(item.compliance_id)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  Disapprove
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="text-gray-500">
                  {complianceStatusFilter === 'all'
                    ? 'No compliance artifacts in queue'
                    : `No ${complianceStatusFilter === 'in_progress' ? 'in progress' : complianceStatusFilter} compliance artifacts`
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* Webscrap Pipeline Button - Only show on compliance tab */}
        {!loading && activeTab === 'compliance' && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleInitiateWebscrap}
              disabled={complianceQueue.filter(item => item.status === 'approved').length === 0}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white shadow-lg ${
                complianceQueue.filter(item => item.status === 'approved').length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              Initiate Webscrap Pipeline ({complianceQueue.filter(item => item.status === 'approved').length} approved)
            </button>
          </div>
        )}

        {/* Confirmation Modal */}
        {showWebscrapConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="relative bg-white rounded-lg shadow-xl p-8 m-4 max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Confirm Pipeline Initiation
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to initiate the webscrap pipeline? This will start processing <strong>{complianceQueue.filter(item => item.status === 'approved').length}</strong> approved compliance artifact{complianceQueue.filter(item => item.status === 'approved').length !== 1 ? 's' : ''}.
              </p>
              <div className="flex space-x-4 justify-end">
                <button
                  onClick={handleCancelWebscrap}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  No, Cancel
                </button>
                <button
                  onClick={handleConfirmWebscrap}
                  className="px-4 py-2 border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Yes, Initiate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Section */}
        {!loading && activeTab === 'feedback' && (
          <div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">
                  Feedback Analysis ({feedbacks.length})
                </h2>
                <select
                  value={feedbackFilter}
                  onChange={(e) => setFeedbackFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Feedback</option>
                  <option value="positive">Positive Only</option>
                  <option value="negative">Negative Only</option>
                </select>
              </div>

              {feedbacks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Negative Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Langfuse
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {feedbacks.map((feedback) => {
                        const negativeReason = feedback.negative_reason;
                        const checkedReasons = negativeReason?.checkedReasons || [];
                        const inputReason = negativeReason?.inputReason || '';
                        const isExpanded = expandedFeedback === feedback.chat_feedback_id;
                        const truncatedReason = inputReason.length > 100
                          ? inputReason.substring(0, 100) + '...'
                          : inputReason;

                        return (
                          <tr key={feedback.chat_feedback_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {feedback.first_name} {feedback.last_name}
                              </div>
                              <div className="text-xs text-gray-500">{feedback.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{feedback.company_name || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {feedback.is_positive ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  👍 Positive
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  👎 Negative
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {!feedback.is_positive ? (
                                <div className="text-sm text-gray-900">
                                  {checkedReasons.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {checkedReasons.map((reason, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800"
                                        >
                                          {reason}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {inputReason && (
                                    <div>
                                      <p className="text-sm text-gray-700">
                                        {isExpanded ? inputReason : truncatedReason}
                                      </p>
                                      {inputReason.length > 100 && (
                                        <button
                                          onClick={() => setExpandedFeedback(
                                            isExpanded ? null : feedback.chat_feedback_id
                                          )}
                                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                                        >
                                          {isExpanded ? 'Show less' : 'Show more'}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {checkedReasons.length === 0 && !inputReason && (
                                    <span className="text-gray-400">No reason provided</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{formatDate(feedback.timestamp)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => window.open(`https://langfuse.mangrovesai.com/project/cmgtrxzso0001p608mkuazc2m/sessions/${feedback.session_id}`, '_blank')}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                Show
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="text-gray-500">No feedback found in the last {timePeriod} {timePeriod === 1 ? 'day' : 'days'}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
