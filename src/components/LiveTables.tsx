"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button, Input } from "@/components/shabe-ui";
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
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
  value?: string | number;
  subject?: string;
  activityType?: string;
  type?: string;
  status?: string;
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
  const [searchTerm, setSearchTerm] = useState('');
  // Get user's teams for data access
  const teams = useQuery(api.crm.getTeamsByUser, user?.id ? { userId: user.id } : "skip");
  const teamId = teams && teams.length > 0 ? teams[0]._id : null;

  // Direct Convex queries for each table type
  const contacts = useQuery(
    api.crm.getContactsByTeam, 
    teamId ? { teamId: teamId.toString() } : "skip"
  );
  const accounts = useQuery(
    api.crm.getAccountsByTeam, 
    teamId ? { teamId: teamId.toString() } : "skip"
  );
  const deals = useQuery(
    api.crm.getDealsByTeam, 
    teamId ? { teamId: teamId.toString() } : "skip"
  );
  const activities = useQuery(
    api.crm.getActivitiesByTeam, 
    teamId ? { teamId: teamId.toString() } : "skip"
  );

  // Get data based on active table
  const getDataForTable = (tableType: TableType): DataRecord[] => {
    switch (tableType) {
      case 'contacts':
        return contacts || [];
      case 'accounts':
        return accounts || [];
      case 'deals':
        return deals || [];
      case 'activities':
        return activities || [];
      default:
        return [];
    }
  };

  const data = getDataForTable(activeTable);
  const loading = !teams || (teamId && data === undefined) || false;
  const error: string | null = null; // Convex handles errors internally

  const tableConfigs: Record<TableType, TableConfig> = {
    contacts: {
      icon: Users,
      label: 'Contacts',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      columns: ['name', 'email', 'company', 'title', 'leadStatus'],
      formatters: {
        name: (record: DataRecord) => {
          const firstName = record.firstName || '';
          const lastName = record.lastName || '';
          return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'N/A';
        },
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
        amount: (record: DataRecord) => record.value ? `$${parseFloat(record.value.toString()).toLocaleString()}` : 'N/A',
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
        activityType: (record: DataRecord) => record.type || 'task',
        dueDate: (record: DataRecord) => record.dueDate ? new Date(record.dueDate).toLocaleDateString() : 'N/A'
      }
    }
  };

  // Filter data based on search term
  console.log('🔍 LiveTables current state:', {
    dataLength: data.length,
    activeTable,
    searchTerm,
    loading,
    error
  });
 
  // Debug: Log raw data from Convex to verify freshness
  console.log('🔍 Raw Convex data for', activeTable, ':', data);
  console.log('🔍 Sample contact record:', data[0]);
  
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
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="p-4 border-b border-line-200 bg-accent-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">Live Tables</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Re-fetch data when refreshing
              setActiveTable(activeTable); // Keep activeTable as is
            }}
            disabled={loading}
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
                  flex items-center gap-2 p-2 rounded-ctl text-sm font-medium transition-all
                  ${isActive 
                    ? 'bg-accent-500 text-black border border-accent-600' 
                    : 'bg-bg-soft text-ink-600 hover:bg-accent-50 border border-line-200'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{config.label}</span>
                <span className={`
                  ml-auto text-xs px-1.5 py-0.5 rounded-pill
                  ${isActive ? 'bg-white/70' : 'bg-line-200'}
                `}>
                  {activeTable === type ? filteredData.length : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink-500" />
          <Input
            placeholder={`Search ${currentConfig.label.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-ink-500" />
            <span className="ml-2 text-ink-600">Loading {currentConfig.label.toLowerCase()}...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-danger-500">
            <span>{error}</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-ink-500">
            {(() => {
              const Icon = currentConfig.icon;
              return <Icon className="h-8 w-8 mb-2 text-ink-400" />;
            })()}
            <span>No {currentConfig.label.toLowerCase()} found</span>
            {searchTerm && (
              <span className="text-sm mt-1">Try adjusting your search</span>
            )}
          </div>
        ) : (
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg border-b border-line-200 shadow-card z-10">
                <tr>
                  {currentConfig.columns.map((column) => (
                    <th
                      key={column}
                      className="text-left p-3 font-medium text-ink-700 capitalize bg-bg"
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
                      border-b border-line-100 hover:bg-accent-50 cursor-pointer transition-colors
                      ${highlightedRecordId === record._id ? 'bg-accent-100 border-accent-500' : ''}
                    `}
                  >
                    {currentConfig.columns.map((column) => (
                      <td key={column} className="p-3 text-ink-700">
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
        <div className="p-3 border-t border-line-200 bg-accent-50 text-xs text-ink-600">
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