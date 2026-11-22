import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["STUDENT", "BUSINESS"]),
    city: z.string().trim().min(1, "City is required"),
    phone: z.string().trim().min(1, "Phone is required"),
    university: z.string().trim().optional(),
    businessName: z.string().trim().optional(),
    category: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STUDENT" && !data.university) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["university"], message: "University is required" });
    }
    if (data.role === "BUSINESS" && !data.businessName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businessName"], message: "Business name is required" });
    }
  });

export const offerSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(1000),
  city: z.string().trim().min(1, "City is required"),
  hourlyRate: z.coerce.number().positive("Rate must be positive").max(1000),
  durationMin: z.coerce
    .number()
    .int("Duration must be a whole number of minutes")
    .positive("Duration must be positive")
    .max(120, "Shifts must be 2 hours (120 minutes) or less"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  city: z.string().trim().min(1, "City is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  bio: z.string().trim().max(500).optional(),
  university: z.string().trim().optional(),
  businessName: z.string().trim().optional(),
  category: z.string().trim().optional(),
  description: z.string().trim().max(1000).optional(),
});

export const messageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

/** Every suspension / ban / reactivation must carry an explicit reason. */
export const moderationReasonSchema = z
  .string()
  .trim()
  .min(3, "A reason of at least 3 characters is required")
  .max(200, "Reason must be 200 characters or less");

/** Business feedback on a student: 1-5 stars, optional short note. */
export const feedbackSchema = z.object({
  rating: z.coerce
    .number()
    .int("Pick a whole number of stars")
    .min(1, "Pick at least 1 star")
    .max(5, "Maximum 5 stars"),
  comment: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
});
