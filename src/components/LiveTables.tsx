"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Building, 
  DollarSign, 
  Calendar,
  Plus,
  Loader2,
  Search,
  ChevronDown
} from "lucide-react";
import { Input } from "@/components/ui/input";

type TableType = 'contacts' | 'accounts' | 'deals' | 'activities';

interface DataRecord {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
  leadStatus?: string;
  name?: string;
  industry?: string;
  website?: string;
  stage?: string;
  amount?: number;
  subject?: string;
  activityType?: string;
  dueDate?: string;
  [key: string]: unknown;
}

interface TableConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
  columns: string[];
  formatters: Record<string, (record: DataRecord) => string>;
}

interface LiveTablesProps {
  onRecordSelect?: (record: DataRecord, type: TableType) => void;
  highlightedRecordId?: string;
}

export default function LiveTables({ onRecordSelect, highlightedRecordId }: LiveTablesProps) {
  const { user } = useUser();
  const [activeTable, setActiveTable] = useState<TableType>('contacts');
  const [data, setData] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tableConfigs: Record<TableType, TableConfig> = {
    contacts: {
      icon: Users,
      label: 'Contacts',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      columns: ['name', 'email', 'company', 'title', 'leadStatus'],
      formatters: {
        name: (record: DataRecord) => record.name || 'N/A',
        email: (record: DataRecord) => record.email || 'N/A',
        company: (record: DataRecord) => record.company || 'N/A',
        title: (record: DataRecord) => record.title || 'N/A',
        leadStatus: (record: DataRecord) => record.leadStatus || 'new'
      }
    },
    accounts: {
      icon: Building,
      label: 'Accounts',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      columns: ['name', 'industry', 'website', 'phone'],
      formatters: {
        name: (record: DataRecord) => record.name || 'N/A',
        industry: (record: DataRecord) => record.industry || 'N/A',
        website: (record: DataRecord) => record.website || 'N/A',
        phone: (record: DataRecord) => record.phone || 'N/A'
      }
    },
    deals: {
      icon: DollarSign,
      label: 'Deals',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      columns: ['name', 'stage', 'amount', 'company'],
      formatters: {
        name: (record: DataRecord) => record.name || 'N/A',
        stage: (record: DataRecord) => record.stage || 'prospecting',
        amount: (record: DataRecord) => record.amount ? `$${record.amount.toLocaleString()}` : 'N/A',
        company: (record: DataRecord) => record.company || 'N/A'
      }
    },
    activities: {
      icon: Calendar,
      label: 'Activities',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      columns: ['subject', 'activityType', 'dueDate'],
      formatters: {
        subject: (record: DataRecord) => record.subject || 'N/A',
        activityType: (record: DataRecord) => record.activityType || 'task',
        dueDate: (record: DataRecord) => record.dueDate ? new Date(record.dueDate).toLocaleDateString() : 'N/A'
      }
    }
  };

  // Fetch data when activeTable changes
  useEffect(() => {
    if (!user?.id) return;
    
    fetchTableData();
  }, [activeTable, user?.id]);

  const fetchTableData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `view all ${activeTable}` }],
          userId: user.id,
          sessionFiles: [],
          companyData: {},
          userData: {}
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.data && Array.isArray(result.data.records)) {
        setData(result.data.records);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching table data:', err);
      setError('Failed to load data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on search term
  const filteredData = data.filter(record => {
    if (!searchTerm) return true;
    
    const config: TableConfig = tableConfigs[activeTable];
    return config.columns.some((column: string) => {
      const value = config.formatters[column](record);
      return value.toLowerCase().includes(searchTerm.toLowerCase());
    });
  });

  const currentConfig = tableConfigs[activeTable];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-[#d9d2c7] bg-[#f3e89a]/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Live Tables</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTableData}
            disabled={loading}
            className="text-black hover:bg-[#f3e89a]/20"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Refresh'
            )}
          </Button>
        </div>

        {/* Table Type Selector */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(tableConfigs).map(([type, config]) => {
            const Icon = config.icon;
            const isActive = activeTable === type;
            
            return (
              <button
                key={type}
                onClick={() => setActiveTable(type as TableType)}
                className={`
                  flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-all
                  ${isActive 
                    ? `${config.bgColor} ${config.color} border border-current` 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{config.label}</span>
                <span className={`
                  ml-auto text-xs px-1.5 py-0.5 rounded-full
                  ${isActive ? 'bg-white/70' : 'bg-gray-200'}
                `}>
                  {activeTable === type ? filteredData.length : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={`Search ${currentConfig.label.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 text-sm border-[#d9d2c7] focus:border-[#f3e89a] focus:ring-[#f3e89a]"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading {currentConfig.label.toLowerCase()}...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-red-500">
            <span>{error}</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <currentConfig.icon className="h-8 w-8 mb-2 text-gray-300" />
            <span>No {currentConfig.label.toLowerCase()} found</span>
            {searchTerm && (
              <span className="text-sm mt-1">Try adjusting your search</span>
            )}
          </div>
        ) : (
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-[#d9d2c7] shadow-sm z-10">
                <tr>
                  {currentConfig.columns.map((column) => (
                    <th
                      key={column}
                      className="text-left p-3 font-medium text-gray-700 capitalize bg-white"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((record) => (
                  <tr
                    key={record._id}
                    onClick={() => onRecordSelect?.(record, activeTable)}
                    className={`
                      border-b border-gray-100 hover:bg-[#f3e89a]/5 cursor-pointer transition-colors
                      ${highlightedRecordId === record._id ? 'bg-[#f3e89a]/20 border-[#f3e89a]' : ''}
                    `}
                  >
                    {currentConfig.columns.map((column) => (
                      <td key={column} className="p-3 text-gray-700">
                        {currentConfig.formatters[column](record)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer with record count */}
      {!loading && !error && (
        <div className="p-3 border-t border-[#d9d2c7] bg-[#f3e89a]/5 text-xs text-gray-500">
          {searchTerm ? (
            `${filteredData.length} of ${data.length} ${currentConfig.label.toLowerCase()}`
          ) : (
            `${data.length} ${currentConfig.label.toLowerCase()}`
          )}
        </div>
      )}
    </div>
  );
}