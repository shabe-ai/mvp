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
    <div className="bg-white rounded-xl border border-[#d9d2c7] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#f3e89a]/20 to-[#efe076]/20 px-6 py-4 border-b border-[#d9d2c7]">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-black">{title}</h3>
          <div className="flex items-center space-x-2">
            {isEditable && !isEditing && (
              <button
                onClick={handleEdit}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-[#d9d2c7] hover:text-black bg-white border border-[#d9d2c7] rounded-lg hover:bg-[#d9d2c7]/10 transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-[#d9d2c7] hover:text-black bg-white border border-[#d9d2c7] rounded-lg hover:bg-[#d9d2c7]/10 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <form onSubmit={handleSubmit(isEditing ? handleSaveEdit : handleSend)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Title
              </label>
              <input
                {...register("title")}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                  !isEditing 
                    ? "bg-[#d9d2c7]/10 text-[#d9d2c7] border-[#d9d2c7]" 
                    : "bg-white text-black border-[#d9d2c7] focus:border-[#f3e89a] focus:ring-2 focus:ring-[#f3e89a]/20"
                }`}
              />
              {errors.title && (
                <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
              )}
            </div>

            {watchedValues.subject && (
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Subject
                </label>
                <input
                  {...register("subject")}
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                    !isEditing 
                      ? "bg-[#d9d2c7]/10 text-[#d9d2c7] border-[#d9d2c7]" 
                      : "bg-white text-black border-[#d9d2c7] focus:border-[#f3e89a] focus:ring-2 focus:ring-[#f3e89a]/20"
                  }`}
                />
                {errors.subject && (
                  <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Content
              </label>
              <textarea
                {...register("content")}
                disabled={!isEditing}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg text-sm resize-none transition-colors ${
                  !isEditing 
                    ? "bg-[#d9d2c7]/10 text-[#d9d2c7] border-[#d9d2c7]" 
                    : "bg-white text-black border-[#d9d2c7] focus:border-[#f3e89a] focus:ring-2 focus:ring-[#f3e89a]/20"
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
                  className="flex items-center space-x-2 px-4 py-2 bg-[#f3e89a] hover:bg-[#efe076] text-black rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center space-x-2 px-4 py-2 text-[#d9d2c7] hover:text-black bg-white border border-[#d9d2c7] rounded-lg font-medium transition-colors hover:bg-[#d9d2c7]/10"
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
                  className="flex items-center space-x-2 px-4 py-2 bg-[#f3e89a] hover:bg-[#efe076] text-black rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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