import { ApiResponse } from '../types';

const API_BASE = 'http://localhost/judiciary_hrms/api';

export interface ACRStatus {
  yearsOfService: number;
  expectedACRs: number;
  submittedACRs: number;
  missingACRs: number;
  completionPercentage: number;
  meetsMinimumDuration: boolean;
  monthsAtCurrentPosting: number;
}

export interface AssetsStatus {
  yearsOfService: number;
  expectedDeclarations: number;
  submittedDeclarations: number;
  missingDeclarations: number;
  completionPercentage: number;
  doa: string;
}

export interface FBRStatus {
  yearsOfService: number;
  expectedRecords: number;
  submittedRecords: number;
  missingRecords: number;
  completionPercentage: number;
  doa: string;
}

export interface GPFundData {
  records: any[];
  summary: {
    total_availed: number;
    times_availed: number;
    current_balance: number;
    monthly_deduction: number;
    last_updated?: string;
  };
  count: number;
}

class FinancialRecordsService {
  // ACR APIs
  async getACRs(employeeId: string): Promise<any[]> {
    const response = await fetch(
      `${API_BASE}/acr_records.php?action=get_acrs&employee_id=${employeeId}`
    );
    const data = await response.json();
    return data.data || [];
  }

  async createACR(employeeId: string, acrData: any): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'create_acr');
    formData.append('employee_id', employeeId);
    formData.append('year', acrData.year.toString());
    formData.append('period_from', acrData.periodFrom);
    formData.append('period_to', acrData.periodTo);
    formData.append('score', acrData.score || 'Very Good');
    formData.append('status', acrData.status || 'Draft');
    if (acrData.remarks) formData.append('remarks', acrData.remarks);
    if (acrData.title) formData.append('title', acrData.title);
    if (acrData.document) formData.append('document', acrData.document);

    const response = await fetch(`${API_BASE}/acr_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async updateACR(id: string, updates: any): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'update_acr');
    formData.append('id', id);
    if (updates.score) formData.append('score', updates.score);
    if (updates.status) formData.append('status', updates.status);
    if (updates.remarks) formData.append('remarks', updates.remarks);

    const response = await fetch(`${API_BASE}/acr_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async deleteACR(id: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'delete_acr');
    formData.append('id', id);

    const response = await fetch(`${API_BASE}/acr_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async getACRCompletionStatus(employeeId: string): Promise<ACRStatus> {
    const response = await fetch(
      `${API_BASE}/acr_records.php?action=acr_completion_status&employee_id=${employeeId}`
    );
    const data = await response.json();
    return data.data;
  }

  // Assets Declaration APIs
  async getAssets(employeeId: string): Promise<any[]> {
    const response = await fetch(
      `${API_BASE}/asset_declarations.php?action=get_assets&employee_id=${employeeId}`
    );
    const data = await response.json();
    return data.data || [];
  }

  async createAsset(employeeId: string, assetData: any): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'create_asset');
    formData.append('employee_id', employeeId);
    formData.append('financial_year', assetData.financialYear);
    formData.append('submission_date', assetData.submissionDate);
    formData.append('status', assetData.status || 'Draft');
    if (assetData.remarks) formData.append('remarks', assetData.remarks);
    if (assetData.document) formData.append('document', assetData.document);

    const response = await fetch(`${API_BASE}/asset_declarations.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async updateAsset(id: string, updates: any): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'update_asset');
    formData.append('id', id);
    if (updates.status) formData.append('status', updates.status);
    if (updates.remarks) formData.append('remarks', updates.remarks);

    const response = await fetch(`${API_BASE}/asset_declarations.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async deleteAsset(id: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'delete_asset');
    formData.append('id', id);

    const response = await fetch(`${API_BASE}/asset_declarations.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async getAssetsCompletionStatus(employeeId: string): Promise<AssetsStatus> {
    const response = await fetch(
      `${API_BASE}/asset_declarations.php?action=assets_completion_status&employee_id=${employeeId}`
    );
    const data = await response.json();
    return data.data;
  }

  // FBR Tax Status APIs
  async getFBRRecords(employeeId: string): Promise<any[]> {
    const response = await fetch(
      `${API_BASE}/fbr_tax_records.php?action=get_fbr_records&employee_id=${employeeId}`
    );
    const data = await response.json();
    return data.data || [];
  }

  async createFBRRecord(employeeId: string, fbrData: any): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'create_fbr_record');
    formData.append('employee_id', employeeId);
    formData.append('tax_year', fbrData.taxYear.toString());
    formData.append('filer_status', fbrData.filerStatus || 'Inactive');
    if (fbrData.submissionDate) formData.append('submission_date', fbrData.submissionDate);
    if (fbrData.taxPaid) formData.append('tax_paid', fbrData.taxPaid.toString());
    if (fbrData.remarks) formData.append('remarks', fbrData.remarks);
    if (fbrData.document) formData.append('document', fbrData.document);

    const response = await fetch(`${API_BASE}/fbr_tax_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async updateFBRRecord(id: string, updates: any): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'update_fbr_record');
    formData.append('id', id);
    if (updates.filerStatus) formData.append('filer_status', updates.filerStatus);
    if (updates.taxPaid) formData.append('tax_paid', updates.taxPaid.toString());
    if (updates.remarks) formData.append('remarks', updates.remarks);

    const response = await fetch(`${API_BASE}/fbr_tax_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async deleteFBRRecord(id: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'delete_fbr_record');
    formData.append('id', id);

    const response = await fetch(`${API_BASE}/fbr_tax_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async getFBRCompletionStatus(employeeId: string): Promise<FBRStatus> {
    const response = await fetch(
      `${API_BASE}/fbr_tax_records.php?action=fbr_completion_status&employee_id=${employeeId}`
    );
    const data = await response.json();
    return data.data;
  }

  // GP Fund APIs
  async getGPFundRecords(employeeId: string): Promise<GPFundData> {
    const response = await fetch(
      `${API_BASE}/gp_fund_records.php?action=get_gp_fund_records&employee_id=${employeeId}`
    );
    const data = await response.json();
    return data.data || { records: [], summary: { total_availed: 0, times_availed: 0, current_balance: 0, monthly_deduction: 0 }, count: 0 };
  }

  async createGPFundAdvance(employeeId: string, gpData: any): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'create_gp_fund_advance');
    formData.append('employee_id', employeeId);
    formData.append('amount', gpData.amount.toString());
    formData.append('date', gpData.date);
    if (gpData.description) formData.append('description', gpData.description);
    if (gpData.monthlyInstallment) formData.append('monthly_installment', gpData.monthlyInstallment.toString());
    if (gpData.remainingAmount) formData.append('remaining_amount', gpData.remainingAmount.toString());
    if (gpData.referenceNumber) formData.append('reference_number', gpData.referenceNumber);
    if (gpData.remarks) formData.append('remarks', gpData.remarks);

    const response = await fetch(`${API_BASE}/gp_fund_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async recordGPFundRecovery(employeeId: string, recoveryData: any): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'record_gp_fund_recovery');
    formData.append('employee_id', employeeId);
    formData.append('amount', recoveryData.amount.toString());
    formData.append('date', recoveryData.date);
    if (recoveryData.description) formData.append('description', recoveryData.description);
    if (recoveryData.remarks) formData.append('remarks', recoveryData.remarks);

    const response = await fetch(`${API_BASE}/gp_fund_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async deleteGPFundRecord(id: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('action', 'delete_gp_fund_record');
    formData.append('id', id);

    const response = await fetch(`${API_BASE}/gp_fund_records.php`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async getGPFundSummary(employeeId: string) {
    const response = await fetch(
      `${API_BASE}/gp_fund_records.php?action=get_gp_fund_summary&employee_id=${employeeId}`
    );
    const data = await response.json();
    return data.data;
  }
}

export const financialRecordsService = new FinancialRecordsService();
