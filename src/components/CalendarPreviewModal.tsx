import React, { useState } from 'react';
import { Calendar, Clock, Users, MapPin, FileText, X, Check, Edit3 } from 'lucide-react';

interface CalendarPreviewProps {
  eventPreview: {
    title: string;
    description: string;
    start: string;
    end: string;
    attendees: string[];
    location: string;
    allDay: boolean;
  };
  onConfirm: (eventPreview: any) => void;
  onModify: (field: string, value: any) => void;
  onCancel: () => void;
}

export default function CalendarPreviewModal({
  eventPreview,
  onConfirm,
  onModify,
  onCancel
}: CalendarPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPreview, setEditedPreview] = useState(eventPreview);

  const handleFieldChange = (field: string, value: any) => {
    setEditedPreview(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConfirm = () => {
    onConfirm(editedPreview);
  };

  const handleModify = () => {
    if (isEditing) {
      // Save changes
      Object.keys(editedPreview).forEach(field => {
        if (editedPreview[field as keyof typeof editedPreview] !== eventPreview[field as keyof typeof eventPreview]) {
          onModify(field, editedPreview[field as keyof typeof editedPreview]);
        }
      });
    }
    setIsEditing(!isEditing);
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return 'No date';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return 'No time';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      return 'Invalid time';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Calendar Event Preview
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Meeting Title
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedPreview.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter meeting title"
              />
            ) : (
              <p className="text-gray-900 font-medium">{eventPreview.title}</p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date
              </label>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editedPreview.start}
                  onChange={(e) => handleFieldChange('start', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{formatDate(eventPreview.start)}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Time
              </label>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editedPreview.end}
                  onChange={(e) => handleFieldChange('end', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{formatTime(eventPreview.end)}</p>
              )}
            </div>
          </div>


          {/* Attendees */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Attendees
            </label>
            {eventPreview.attendees.length > 0 ? (
              <div className="space-y-2">
                {eventPreview.attendees.map((attendee, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-gray-900">{attendee}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No attendees specified</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedPreview.location}
                onChange={(e) => handleFieldChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter location or video call link"
              />
            ) : (
              <p className="text-gray-900">
                {eventPreview.location || 'To be determined'}
              </p>
            )}
          </div>

          {/* Description */}
          {isEditing && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={editedPreview.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Enter meeting description or agenda"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={handleModify}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {isEditing ? 'Save Changes' : 'Modify Details'}
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
            >
              <Check className="w-4 h-4" />
              Create Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
