"use client";

import { useState, useCallback, useEffect } from "react";
import Chat from "@/components/Chat";
import SidebarLayout from "@/components/SidebarLayout";
import LiveTables from "@/components/LiveTables";
// import TourTrigger from "@/components/TourTrigger";

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

type TableType = 'contacts' | 'accounts' | 'deals' | 'activities';

export default function ChatWithSidebar() {
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | undefined>();
  const [refreshTables, setRefreshTables] = useState(0);
  const [defaultSidebarOpen, setDefaultSidebarOpen] = useState(true);

  // Check if mobile on initial load
  useEffect(() => {
    const checkMobile = () => {
      setDefaultSidebarOpen(window.innerWidth >= 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle when a record is selected in the sidebar
  const handleRecordSelect = useCallback((record: DataRecord, type: TableType) => {
    console.log('Selected record:', record, type);
    // You could trigger a chat message or other action here
    // For now, just highlight the record
    setHighlightedRecordId(record._id);
  }, []);

  // Handle when chat performs an action that should refresh tables
  const handleChatAction = useCallback((action: string, data?: unknown) => {
    console.log('🎯 ChatWithSidebar received action:', action, data);
    
    // If a contact/account/deal was created, updated, or deleted, refresh tables
    if (['contact_created', 'contact_updated', 'account_created', 'deal_created'].includes(action)) {
      console.log('🔄 Triggering table refresh for action:', action);
      setRefreshTables(prev => prev + 1);
    }
    
    // If a specific record was mentioned, highlight it
    if (data && typeof data === 'object' && 'recordId' in data) {
      setHighlightedRecordId(data.recordId as string);
    }
  }, []);

  return (
    <SidebarLayout
      sidebar={
        <LiveTables 
          onRecordSelect={handleRecordSelect}
          highlightedRecordId={highlightedRecordId}
          key={refreshTables} // Force refresh when refreshTables changes
        />
      }
      defaultSidebarOpen={defaultSidebarOpen}
    >
      <div className="flex flex-col h-full">
        {/* <TourTrigger /> */}
        <Chat onAction={handleChatAction} />
      </div>
    </SidebarLayout>
  );
}