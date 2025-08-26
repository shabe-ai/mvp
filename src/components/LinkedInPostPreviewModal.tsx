'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Globe, Users, X, Send, Save } from 'lucide-react';

interface LinkedInPostPreview {
  content: string;
  platform: string;
  scheduledAt?: string;
  visibility: string;
  postType: string;
}

interface LinkedInPostPreviewModalProps {
  isVisible: boolean;
  postPreview: LinkedInPostPreview;
  onConfirm: (postData: LinkedInPostPreview) => void;
  onCancel: () => void;
  onEdit: (content: string) => void;
}

export default function LinkedInPostPreviewModal({
  isVisible,
  postPreview,
  onConfirm,
  onCancel,
  onEdit
}: LinkedInPostPreviewModalProps) {
  const [content, setContent] = useState(postPreview.content);
  const [visibility, setVisibility] = useState(postPreview.visibility);
  const [scheduledAt, setScheduledAt] = useState(postPreview.scheduledAt || '');
  const [isEditing, setIsEditing] = useState(false);

  if (!isVisible) return null;

  const handleConfirm = () => {
    onConfirm({
      ...postPreview,
      content,
      visibility,
      scheduledAt: scheduledAt || undefined
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
    onEdit(content);
  };

  const formatScheduleTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">in</span>
              </div>
              <CardTitle className="text-lg">LinkedIn Personal Post Preview</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-text-secondary hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Post Content */}
          <div>
            <Label htmlFor="content" className="text-sm font-medium text-text-primary">
              Post Content
            </Label>
            {isEditing ? (
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your LinkedIn post..."
                className="mt-2 min-h-[120px] font-body"
                maxLength={1300}
              />
            ) : (
              <div className="mt-2 p-4 bg-neutral-secondary/10 rounded-md border border-neutral-secondary">
                <p className="whitespace-pre-wrap font-body text-text-primary">{content}</p>
              </div>
            )}
            <div className="mt-2 text-xs text-text-secondary">
              {content.length}/1300 characters
            </div>
          </div>

          {/* Post Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-text-primary">Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4" />
                      <span>Public</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="connections">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4" />
                      <span>Connections</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-text-primary">Schedule</Label>
              <div className="mt-2">
                {scheduledAt ? (
                  <div className="flex items-center space-x-2 text-sm text-text-secondary">
                    <Calendar className="w-4 h-4" />
                    <span>{formatScheduleTime(scheduledAt)}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-sm text-text-secondary">
                    <Clock className="w-4 h-4" />
                    <span>Post immediately</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-neutral-secondary">
            <div className="flex space-x-2">
              {!isEditing ? (
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  className="border-neutral-secondary text-text-secondary hover:bg-neutral-secondary/20"
                >
                  Edit Post
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="border-neutral-secondary text-text-secondary hover:bg-neutral-secondary/20"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={onCancel}
                className="border-neutral-secondary text-text-secondary hover:bg-neutral-secondary/20"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {scheduledAt ? 'Schedule Post' : 'Publish Post'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
