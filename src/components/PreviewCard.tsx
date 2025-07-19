"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, Edit, X, Check } from "lucide-react";

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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-100 px-6 py-4 border-b border-slate-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {isEditable && !isEditing && (
            <button
              onClick={handleEdit}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all duration-200"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <form onSubmit={handleSubmit(isEditing ? handleSaveEdit : handleSend)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title
              </label>
              <input
                {...register("title")}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg text-sm transition-all duration-200 ${
                  !isEditing 
                    ? "bg-slate-50 text-slate-600 border-slate-200" 
                    : "bg-white text-slate-900 border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                }`}
              />
              {errors.title && (
                <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
              )}
            </div>

            {watchedValues.subject && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Subject
                </label>
                <input
                  {...register("subject")}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition-all duration-200 ${
                    !isEditing 
                      ? "bg-slate-50 text-slate-600 border-slate-200" 
                      : "bg-white text-slate-900 border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  }`}
                />
                {errors.subject && (
                  <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Content
              </label>
              <textarea
                {...register("content")}
                disabled={!isEditing}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg text-sm resize-none transition-all duration-200 ${
                  !isEditing 
                    ? "bg-slate-50 text-slate-600 border-slate-200" 
                    : "bg-white text-slate-900 border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                }`}
              />
              {errors.content && (
                <p className="text-red-500 text-xs mt-1">{errors.content.message}</p>
              )}
            </div>

            {/* Action Buttons */}
            {isEditing ? (
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!isValid}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center space-x-2 px-4 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg font-medium transition-all duration-200 hover:bg-slate-50"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!isValid}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
} 