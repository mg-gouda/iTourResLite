"use client";

import { useParams } from "next/navigation";
import { BookingForm } from "@/components/booking-form";

export default function EditBookingPage() {
  const params = useParams<{ id: string }>();
  return <BookingForm bookingId={params.id} />;
}
