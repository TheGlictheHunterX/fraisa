/** Shared human-readable labels/classes for the freelance offer lifecycle. */

export function offerStatusLabel(status: string): string {
  switch (status) {
    case "PENDING": return "PENDING";
    case "ACCEPTED": return "ACCEPTED";
    case "ENDED": return "ENDED / PAID";
    case "REMOVED_BY_BUSINESS": return "REMOVED BY BUSINESS";
    case "REMOVED_BY_ADMIN": return "REMOVED BY ADMIN";
    default: return status;
  }
}

export function offerStatusClass(status: string): string {
  switch (status) {
    case "PENDING": return "bg-amber-100 text-amber-700";
    case "ACCEPTED": return "bg-brand-100 text-brand-700";
    case "ENDED": return "bg-emerald-100 text-emerald-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

export function applicationStatusLabel(status: string): string {
  switch (status) {
    case "PENDING": return "Pending review";
    case "ACCEPTED": return "Accepted · in progress";
    case "COMPLETED": return "Finished · paid";
    case "CANCELLED": return "Cancelled";
    default: return status;
  }
}

export function applicationStatusClass(status: string): string {
  switch (status) {
    case "ACCEPTED": return "bg-brand-100 text-brand-700";
    case "COMPLETED": return "bg-emerald-100 text-emerald-700";
    case "CANCELLED": return "bg-red-100 text-red-700";
    default: return "bg-amber-100 text-amber-700";
  }
}
