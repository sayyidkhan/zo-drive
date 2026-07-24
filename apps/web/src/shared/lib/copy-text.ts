import { toast } from "sonner";

export async function copyText(value: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("Could not copy automatically. Select and copy the link instead.");
  }
}
