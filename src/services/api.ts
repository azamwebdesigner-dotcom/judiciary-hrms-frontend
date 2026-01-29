import {
  Employee,
  Headquarter,
  Tehsil,
  Designation,
  Category,
  Unit,
  Qualification,
  ApiResponse,
  EmploymentBlock
} from '../types';

// Allow overriding the API base URL via environment variable for development flexibility.
// Set `REACT_APP_API_URL` in `.env` (e.g. `REACT_APP_API_URL=http://localhost/judiciary_hrms/api/index.php`).
// Default to the local XAMPP backend URL so the React dev server forwards API
// requests to the PHP backend rather than returning the dev server HTML.
// You can still override with `REACT_APP_API_URL` during development if needed.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost/judiciary_hrms/api/index.php';

export const api = {
  /* ================= CORE REQUEST ================= */
  async _request<T>(
    action: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    id?: string
  ): Promise<T> {
    const url = id
      ? `${API_BASE_URL}?action=${action}&id=${id}`
      : `${API_BASE_URL}?action=${action}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'GET' ? JSON.stringify(data) : undefined,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Try to parse JSON; if response is not JSON (HTML error page), include text in thrown error
      let result: any;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        try {
          result = await response.json();
        } catch (parseErr) {
          throw new Error(`Failed to parse JSON response: ${parseErr}`);
        }
      } else {
        // Response is not JSON, read as text
        const text = await response.text();
        throw new Error(text || `HTTP error! status: ${response.status}`);
      }

      if (result && result.success === false) {
        throw new Error(result.message || JSON.stringify(result));
      }

      return result.data as T;
    } catch (error) {
      // Avoid noisy console logs here; surface errors to the caller so UI can display them.
      throw error;
    }
  },

  async _externalRequest<T>(
    fileName: string,
    params?: URLSearchParams
  ): Promise<T> {
    const baseUrl = API_BASE_URL.replace('/index.php', '');
    const url = params
      ? `${baseUrl}/${fileName}?${params.toString()}`
      : `${baseUrl}/${fileName}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let result: any;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `HTTP error! status: ${response.status}`);
      }

      if (result && result.success === false) {
        throw new Error(result.message || JSON.stringify(result));
      }

      // Return the full result object - different APIs have different response structures
      // Some use {success, data: [...]}, others use {success, employees: [...]}
      return result as T;
    } catch (error) {
      throw error;
    }
  },

  /* ================= UPLOAD ================= */
  uploadPhoto: async (photoDataUrl: string): Promise<{ photoPath: string }> => {
    const baseUrl = API_BASE_URL.replace('/index.php', '');
    const uploadUrl = `${baseUrl}/upload_photo.php`;

    const formData = new FormData();
    formData.append('photoData', photoDataUrl);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Photo upload failed');
    }

    // Return a full URL so the frontend can preview and load the image across origins
    const publicBase = baseUrl.replace(/\/api\/?$/i, '');
    const photoFull = result.photoPath && !result.photoPath.startsWith('http') ? `${publicBase}/${result.photoPath.replace(/^\//, '')}` : result.photoPath;

    return { photoPath: photoFull };
  },

  /* ================= DOCUMENTS ================= */
  uploadDocuments: async (employeeId: string, documents: any[], metadata?: any) => {
    // documents: array of objects containing metadata and `url` (base64 data URL)
    // metadata: { documentType, formData }
    const payload: any = { employeeId, documents };
    if (metadata) {
      payload.documentType = metadata.documentType;
      payload.formData = metadata.formData;
    }
    return api._request('employee_documents', 'POST', payload);
  },

  deleteDocument: async (documentId: string) => {
    return api._request('employee_document_delete', 'DELETE', null, documentId);
  },

  updateDocument: async (doc: { id: string; documentType?: string; description?: string; fileName?: string }) => {
    return api._request('employee_document_update', 'PUT', doc);
  },

  checkAcrOverlap: async (employeeId: string, periodFrom: string, periodTo: string) => {
    const url = `${API_BASE_URL}?action=check_acr_overlap&employeeId=${employeeId}&periodFrom=${periodFrom}&periodTo=${periodTo}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      return result.data || { canAdd: true, message: '', existingCount: 0 };
    } catch (error) {
      throw error;
    }
  },

  /* ================= AUTH ================= */
  login: async (credentials: { username: string; password: string }) => {
    // Call the login endpoint and preserve the top-level `success` field
    const url = `${API_BASE_URL}?action=login`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Normalize to the frontend expected shape: { success, message?, user? }
    return {
      success: !!result.success,
      message: result.message,
      user: result.data?.user
    };
  },
  /* ================= MASTER DATA ================= */
  getMasterData() {
    return this._request<{
      headquarters: Headquarter[];
      tehsils: Tehsil[];
      designations: Designation[];
      categories: Category[];
      units: Unit[];
      qualifications: Qualification[];
    }>('master_data');
  },

  /* ================= HEADQUARTERS ================= */
  addHeadquarter(data: Omit<Headquarter, 'id'>) {
    return this._request<Headquarter>('headquarters', 'POST', data);
  },

  updateHeadquarter(data: Headquarter) {
    return this._request<Headquarter>('headquarters', 'PUT', data);
  },

  deleteHeadquarter(id: string) {
    return this._request<{ success: boolean }>('headquarters', 'DELETE', null, id);
  },

  toggleHeadquarterStatus(id: string, status: 'Active' | 'Inactive') {
    return this._request<Headquarter>('toggle_headquarter_status', 'PUT', { id, status });
  },

  checkHQHasEmployees(hqId: string) {
    return this._request<{ hasEmployees: boolean }>('check_hq_employees', 'GET', null, hqId);
  },

  /* ================= TEHSILS ================= */
  addTehsil(data: Omit<Tehsil, 'id'>) {
    return this._request<Tehsil>('tehsils', 'POST', data);
  },

  updateTehsil(data: Tehsil) {
    return this._request<Tehsil>('tehsils', 'PUT', data);
  },

  deleteTehsil(id: string) {
    return this._request<{ success: boolean }>('tehsils', 'DELETE', null, id);
  },

  toggleTehsilStatus(id: string, status: 'Active' | 'Inactive') {
    return this._request<Tehsil>('toggle_tehsil_status', 'PUT', { id, status });
  },

  checkTehsilHasEmployees(tehsilId: string) {
    return this._request<{ hasEmployees: boolean }>('check_tehsil_employees', 'GET', null, tehsilId);
  },

  /* ================= DESIGNATIONS ================= */
  getDesignations(includeInactive: boolean = false) {
    const params = includeInactive ? '?includeInactive=true' : '';
    return this._request<Designation[]>(`get_designations${params}`, 'GET');
  },

  addDesignation(data: Omit<Designation, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) {
    return this._request<Designation>('designations', 'POST', {
      ...data,
      status: data.status || 'Active',
      bpsRange: data.bpsRange || '1-22'
    });
  },

  updateDesignation(data: Designation) {
    return this._request<Designation>('designations', 'PUT', data);
  },

  deleteDesignation(id: string) {
    return this._request<{ success: boolean }>('designations', 'DELETE', null, id);
  },

  toggleDesignationStatus(id: string, status: 'Active' | 'Inactive') {
    return this._request<Designation>('toggle_designation_status', 'PUT', { status }, id);
  },

  /* ================= CATEGORIES ================= */
  addCategory(data: Omit<Category, 'id'>) {
    return this._request<Category>('categories', 'POST', data);
  },

  updateCategory(data: Category) {
    return this._request<Category>('categories', 'PUT', data);
  },

  deleteCategory(id: string) {
    return this._request<{ success: boolean }>('categories', 'DELETE', null, id);
  },

  /* ================= UNITS ================= */
  addUnit(data: Omit<Unit, 'id'>) {
    return this._request<Unit>('units', 'POST', data);
  },

  updateUnit(data: Unit) {
    return this._request<Unit>('units', 'PUT', data);
  },

  deleteUnit(id: string) {
    return this._request<{ success: boolean }>('units', 'DELETE', null, id);
  },

  /* ================= QUALIFICATIONS ================= */
  addQualification(data: Omit<Qualification, 'id'>) {
    return this._request<Qualification>('qualifications', 'POST', data);
  },

  updateQualification(data: Qualification) {
    return this._request<Qualification>('qualifications', 'PUT', data);
  },

  deleteQualification(id: string) {
    return this._request<{ success: boolean }>('qualifications', 'DELETE', null, id);
  },

  /* ================= SYSTEM USERS ================= */
  getSystemUsers() {
    return this._request<any[]>('system_users');
  },

  createSystemUser(data: any) {
    return this._request<number>('system_users', 'POST', {
      username: data.username,
      full_name: data.full_name,
      password: data.password,
      role: data.role || 'user',
      status: data.status || 'active',
      avatar: data.avatar || null,
      cnic: data.cnic || null,
      email: data.email || null
    });
  },

  updateSystemUser(data: any) {
    return this._request<void>('system_users', 'PUT', {
      id: data.id,
      username: data.username,
      full_name: data.full_name,
      role: data.role,
      status: data.status,
      password: data.password, // Include password if provided (for resets)
      cnic: data.cnic,
      email: data.email
    });
  },

  deleteSystemUser(id: string) {
    return this._request<void>('system_users', 'DELETE', null, id);
  },

  changePassword(userId: string, currentPassword: string, newPassword: string) {
    return this._request<{ success: boolean; message: string }>('change_password', 'POST', {
      userId,
      currentPassword,
      newPassword
    });
  },

  /* ================= EMPLOYEES ================= */
  getEmployees() {
    return this._request<Employee[]>('employees');
  },

  getEmployeeById(id: string) {
    return this._request<Employee>('employees', 'GET', null, id);
  },

  createEmployee(data: Employee) {
    const payload = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    return this._request<number>('employees', 'POST', payload);
  },

  updateEmployee(data: Employee) {
    if (!data.id) {
      throw new Error('Employee ID is required for update');
    }

    const payload = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    return this._request<void>('employees', 'PUT', payload);
  },

  rehireEmployee(employeeId: string, data: {
    previousStatus?: string | null;
    previousStatusDate?: string | null;
    previousToDate?: string | null;
    orderNumber?: string | null;
    orderDate?: string | null;
    postingPlaceTitle?: string | null;
    hqId?: string | null;
    tehsilId?: string | null;
    postingCategoryId?: string | null;
    unitId?: string | null;
    designationId?: string | null;
    bps?: string | null;
  }) {
    return this._request<Employee>('rehire_employee', 'POST', {
      employeeId,
      ...data
    });
  },

  deleteEmployee(id: string, role: string) {
    return this._externalRequest<{ success: boolean; message: string }>('delete_employee.php', new URLSearchParams({ id, role }));
  },

  checkCnic(cnic: string, excludeId?: string, type: 'employee' | 'system_user' = 'employee') {
    const action = `check_cnic&cnic=${encodeURIComponent(cnic)}&type=${type}${excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''
      }`;
    return this._request<{ exists: boolean; id?: string }>(
      action,
      'GET'
    );
  },

  /* ================= POSTING PLACES ================= */
  getPostingPlaces() {
    return this._request<string[]>('posting_places');
  },

  /* ================= REPORTS ================= */
  generateReport(employeeId: string, mode: string = 'profile', includeDocs: boolean = false) {
    const baseUrl = API_BASE_URL.replace('/index.php', '');
    const params = new URLSearchParams();
    params.set('action', 'download_report');
    params.set('id', employeeId);
    params.set('mode', mode);
    if (includeDocs) params.set('includeDocs', '1');

    const reportUrl = `${baseUrl}/generate_report.php?${params.toString()}`;

    return fetch(reportUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      }
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json().then(data => {
        if (!data.success) {
          throw new Error(data.message || 'Failed to generate report');
        }
        return data;
      });
    }).catch(error => {
      console.error('Report generation error:', error);
      throw error;
    });
  },

  getReport: async (action: string) => {
    return api._externalRequest<{ html: string; filename: string }>('reports.php', new URLSearchParams({ action }));
  },

  /* ================= ADVANCED DASHBOARD ================= */
  getDashboardStats: async (hqId?: string, tehsilId?: string) => {
    const params = new URLSearchParams();
    if (hqId) params.append('hqId', hqId);
    if (tehsilId) params.append('tehsilId', tehsilId);
    return api._externalRequest<any>('dashboard_stats.php', params);
  },

  getDashboardPostingPlaces: async (hqId?: string) => {
    const params = new URLSearchParams();
    if (hqId) params.append('hqId', hqId);
    return api._externalRequest<any>('dashboard_posting_places.php', params);
  },

  getDashboardPostingPlaceHistory: async (postingPlaceTitle: string, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    params.append('postingPlaceTitle', postingPlaceTitle);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return api._externalRequest<any>('dashboard_posting_place_history.php', params);
  },

  getCascadeTehsils: async (hqId: string) => {
    const params = new URLSearchParams();
    params.append('hqId', hqId);
    return api._externalRequest<any>('dashboard_cascade_tehsils.php', params);
  },

  getRetirementAlerts: async (hqId?: string, tehsilId?: string, threshold: number = 3) => {
    const params = new URLSearchParams();
    if (hqId) params.append('hqId', hqId);
    if (tehsilId) params.append('tehsilId', tehsilId);
    params.append('threshold', threshold.toString());
    return api._externalRequest<any>('dashboard_retirement_alerts.php', params);
  },

  getDashboardChartData: async (groupBy: string = 'status', hqId?: string, tehsilId?: string) => {
    const params = new URLSearchParams();
    params.append('groupBy', groupBy);
    if (hqId) params.append('hqId', hqId);
    if (tehsilId) params.append('tehsilId', tehsilId);
    return api._externalRequest<any>('dashboard_chart_data.php', params);
  },

  getDashboardTrends: async (hqId?: string) => {
    const params = new URLSearchParams();
    if (hqId) params.append('hqId', hqId);
    return api._externalRequest<any>('dashboard_trends.php', params);
  },

  getDashboardAdvancedMetrics: async (hqId?: string, tehsilId?: string) => {
    const params = new URLSearchParams();
    if (hqId) params.append('hqId', hqId);
    if (tehsilId) params.append('tehsilId', tehsilId);
    return api._externalRequest<any>('dashboard_advanced_metrics.php', params);
  },

  getEmployeeCompliance: async (employeeId: string) => {
    const params = new URLSearchParams();
    params.append('action', 'get_employee_compliance');
    params.append('employee_id', employeeId);
    return api._externalRequest<any>('compliance_api.php', params);
  },

  getDashboardPostingPlacesHierarchical: async (
    hqId?: string,
    tehsilId?: string,
    drillType: string = 'overview',
    categoryId?: string,
    unitId?: string,
    activeType?: string,
    locationFilter?: string,
    dateFrom?: string,
    dateTo?: string,
    courtTitle?: string
  ) => {
    const params = new URLSearchParams();
    if (hqId) params.append('hqId', hqId);
    if (tehsilId) params.append('tehsilId', tehsilId);
    params.append('drillType', drillType);
    if (categoryId) params.append('categoryId', categoryId);
    if (unitId) params.append('unitId', unitId);
    if (activeType) params.append('activeType', activeType);
    if (locationFilter) params.append('locationFilter', locationFilter);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (courtTitle) params.append('courtTitle', courtTitle);
    return api._externalRequest<any>('dashboard_posting_places_hierarchical.php', params);
  },

  getDashboardPostingPlaceDetail: async (postingPlaceTitle: string, hqId?: string, tehsilId?: string, activeType?: string, unitId?: string) => {
    const params = new URLSearchParams();
    params.append('postingPlaceTitle', postingPlaceTitle);
    if (unitId) params.append('unitId', unitId);
    if (hqId) params.append('hqId', hqId);
    if (tehsilId) params.append('tehsilId', tehsilId);
    if (activeType) params.append('activeType', activeType);
    return api._externalRequest<any>('dashboard_posting_place_detail.php', params);
  },

  getDashboardDrilldown: async (type: string, value: string, hqId?: string, tehsilId?: string, activeType?: string) => {
    const params = new URLSearchParams();
    params.append('type', type);
    params.append('value', value);
    if (hqId) params.append('hqId', hqId);
    if (tehsilId) params.append('tehsilId', tehsilId);
    if (activeType) params.append('activeType', activeType);
    return api._externalRequest<any[]>('dashboard_drilldown.php', params);
  },

  getPhotoUrl: (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = API_BASE_URL.replace('/api/index.php', '');
    return `${baseUrl}/${path.replace(/^\//, '')}`;
  },

  /* ================= AUTH RECOVERY ================= */
  recoverUserId: async (cnic: string) => {
    const baseUrl = API_BASE_URL.replace('/index.php', '');
    const url = `${baseUrl}/auth_recovery.php`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recover_userid', cnic })
    });
    return response.json();
  },

  verifyResetIdentity: async (username: string, cnic: string) => {
    const baseUrl = API_BASE_URL.replace('/index.php', '');
    const url = `${baseUrl}/auth_recovery.php`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_reset_identity', username, cnic })
    });
    return response.json();
  },

  resetPassword: async (username: string, cnic: string, newInformation: string) => {
    const baseUrl = API_BASE_URL.replace('/index.php', '');
    const url = `${baseUrl}/auth_recovery.php`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_password', username, cnic, newInformation })
    });
    return response.json();
  },

  updatePostingTitle: async (data: {
    employeeId: string;
    relievingDate: string;
    joiningDate: string;
    newPostingPlaceTitle: string;
  }) => {
    const baseUrl = API_BASE_URL.replace('/index.php', '');
    const url = `${baseUrl}/update_posting_title.php`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
};

export default api;