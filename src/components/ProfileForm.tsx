"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/lib/actions";

export type ProfileValues = {
  name: string;
  city: string;
  phone: string;
  bio: string;
  university: string;
  businessName: string;
  category: string;
  description: string;
};

export default function ProfileForm({
  role,
  values,
}: {
  role: "STUDENT" | "BUSINESS";
  values: ProfileValues;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    const result = await updateProfileAction(new FormData(event.currentTarget));
    if (!result.ok) {
      setError(result.error ?? "Could not save");
      return;
    }
    setStatus("Saved!");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="name">{role === "STUDENT" ? "Full name" : "Contact name"}</label>
        <input id="name" name="name" className="input" defaultValue={values.name} required />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone</label>
        <input id="phone" name="phone" className="input" defaultValue={values.phone} required />
      </div>
      <div>
        <label className="label" htmlFor="city">City</label>
        <input id="city" name="city" className="input" defaultValue={values.city} required />
      </div>
      {role === "STUDENT" ? (
        <div>
          <label className="label" htmlFor="university">University</label>
          <input id="university" name="university" className="input" defaultValue={values.university} />
        </div>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="businessName">Business name</label>
            <input id="businessName" name="businessName" className="input" defaultValue={values.businessName} />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <input id="category" name="category" className="input" defaultValue={values.category} />
          </div>
        </>
      )}
      <div className="sm:col-span-2">
        <label className="label" htmlFor={role === "STUDENT" ? "bio" : "description"}>
          {role === "STUDENT" ? "Short bio" : "Business description"}
        </label>
        <textarea
          id={role === "STUDENT" ? "bio" : "description"}
          name={role === "STUDENT" ? "bio" : "description"}
          className="input"
          rows={2}
          defaultValue={role === "STUDENT" ? values.bio : values.description}
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary">Save profile</button>
        {status && <span className="text-sm font-medium text-brand-600">{status}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
