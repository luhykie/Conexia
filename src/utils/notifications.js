import { supabase } from "../supabaseConfig";

export async function createNotification({
  userId,
  documentId = null,
  title,
  message,
  type = "document_update",
}) {
  if (!userId) {
    console.error("Notification recipient is required.");
    return {
      success: false,
      error: "Notification recipient is required.",
    };
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      document_id: documentId,
      title,
      message,
      notification_type: type,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Unable to create notification:", error);

    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    data,
  };
}