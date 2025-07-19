"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Generic schema - can be extended for specific use cases
const previewCardSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  subject: z.string().optional(),
  action: z.enum(["send", "edit", "cancel"]).optional(),
});

type PreviewCardData = z.infer<typeof previewCardSchema>;

interface PreviewCardProps {
  initialData?: Partial<PreviewCardData> & { subject?: string };
  onSend?: (data: PreviewCardData) => void;
  onEdit?: (data: PreviewCardData) => void;
  onCancel?: () => void;
  title?: string;
  isEditable?: boolean;
}

export default function PreviewCard({
  initialData = {},
  onSend,
  onEdit,
  onCancel,
  title = "Preview",
  isEditable = true,
}: PreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Debug logging
  console.log("PreviewCard props:", { isEditable, isEditing, title });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    watch,
  } = useForm<PreviewCardData>({
    resolver: zodResolver(previewCardSchema),
    defaultValues: {
      title: initialData.title || "",
      content: initialData.content || "",
      subject: initialData.subject || "",
    },
  });

  const watchedValues = watch();

  const handleSend = (data: PreviewCardData) => {
    onSend?.(data);
    setIsEditing(false);
  };

  const handleEdit = () => {
    console.log("Edit button clicked");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    reset();
    onCancel?.();
  };

  const handleSaveEdit = (data: PreviewCardData) => {
    onEdit?.(data);
    setIsEditing(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          {title}
          {/* Debug info */}
          <div className="text-xs text-gray-500">
            isEditable: {isEditable.toString()}, isEditing: {isEditing.toString()}
          </div>
          {isEditable && !isEditing && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEdit}
                className="bg-blue-500 text-white hover:bg-blue-600"
              >
                Edit
              </Button>
              {/* Fallback button in case shadcn Button doesn't work */}
              <button 
                onClick={handleEdit}
                className="ml-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Edit (Fallback)
              </button>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(isEditing ? handleSaveEdit : handleSend)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input
                {...register("title")}
                disabled={!isEditing}
                className={!isEditing ? "bg-gray-50" : ""}
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            {watchedValues.subject && (
              <div>
                <label className="block text-sm font-medium mb-2">Subject</label>
                <Input
                  {...register("subject")}
                  disabled={!isEditing}
                  className={!isEditing ? "bg-gray-50" : ""}
                />
                {errors.subject && (
                  <p className="text-red-500 text-sm mt-1">{errors.subject.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Content</label>
              <Textarea
                {...register("content")}
                disabled={!isEditing}
                rows={4}
                className={!isEditing ? "bg-gray-50" : ""}
              />
              {errors.content && (
                <p className="text-red-500 text-sm mt-1">{errors.content.message}</p>
              )}
            </div>

            {isEditing ? (
              <div className="flex gap-2">
                <Button type="submit" disabled={!isValid}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="submit" disabled={!isValid}>
                  Send
                </Button>
              </div>
            )}
          </div>
        </form>

        {/* Preview of current values */}
        {!isEditing && (watchedValues.title || watchedValues.content) && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <h4 className="font-medium text-sm mb-2">Preview:</h4>
            {watchedValues.title && (
              <p className="text-sm font-medium">{watchedValues.title}</p>
            )}
            {watchedValues.subject && (
              <p className="text-sm font-medium mt-1">Subject: {watchedValues.subject}</p>
            )}
            {watchedValues.content && (
              <p className="text-sm text-gray-600 mt-1">{watchedValues.content}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 