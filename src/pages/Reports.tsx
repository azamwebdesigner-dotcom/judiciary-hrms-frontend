
import React from 'react';
import { FileText, BarChart, Download } from 'lucide-react';

import { api } from '../services/api';

const Reports: React.FC = () => {
  const handleDownload = async (reportType: string) => {
    let printWindow: Window | null = null;

    try {
      let action = '';
      if (reportType === 'Seniority List') action = 'seniority_list';
      else if (reportType === 'Leave Analysis') action = 'leave_analysis';
      else if (reportType === 'Transfer History') action = 'transfer_history';
      else if (reportType === 'Disciplinary Analysis') action = 'disciplinary_analysis';
      else {
        alert('This report is under development.');
        return;
      }

      // Open window IMMEDIATELY to avoid popup blockers
      printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write('<html><body style="font-family: sans-serif; text-align: center; padding-top: 50px;"><h2>Generating Report...</h2><p>Please wait while we fetch the data.</p></body></html>');
      } else {
        alert('Please allow popups for this website to download reports.');
        return;
      }

      const response = await api.getReport(action);

      if (printWindow) {
        // The API returns { success: true, data: { html: '...', filename: '...' } }
        // We need to check response.data.html
        // @ts-ignore
        const reportData = response.data || response;

        if (reportData && reportData.html) {
          printWindow.document.open(); // Clear previous content
          printWindow.document.write(reportData.html);
          printWindow.document.close();
          printWindow.focus();
          // Small delay to ensure styles load
          setTimeout(() => {
            if (printWindow) printWindow.print();
          }, 1000);
        } else {
          console.error('Report response missing html:', response);
          printWindow.document.body.innerHTML = '<h2>Error</h2><p>No data received for this report.</p>';
        }
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      if (printWindow) {
        printWindow.document.body.innerHTML = '<h2>Error</h2><p>Failed to generate report. Please try again.</p>';
      } else {
        alert('Failed to generate report.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-judiciary-100 rounded-lg text-judiciary-700">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Reports Center</h2>
            <p className="text-gray-500 text-sm">Generate and download HR analytics</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder Report Cards */}
        {['Seniority List', 'Leave Analysis', 'Transfer History', 'Disciplinary Analysis'].map((report) => (
          <div key={report} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-judiciary-50 transition-colors">
                <BarChart className="text-gray-500 group-hover:text-judiciary-600" size={24} />
              </div>
              <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded">PDF</span>
            </div>
            <h3 className="font-bold text-gray-800 mb-1 group-hover:text-judiciary-700 transition-colors">{report}</h3>
            <p className="text-sm text-gray-500 mb-4">Detailed breakdown of {report.toLowerCase()} for all staff members.</p>
            <button
              onClick={() => handleDownload(report)}
              className="text-sm font-medium text-judiciary-600 flex items-center gap-2 group-hover:underline"
            >
              <Download size={16} /> Download Report
            </button>
          </div>
        ))}
      </div>


    </div>
  );
};

export default Reports;
