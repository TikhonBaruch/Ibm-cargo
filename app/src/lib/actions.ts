'use server';

import { z } from 'zod';
import { PHONE_REGEX, PHONE_ERROR } from './constants';
import { prisma } from './prisma';
import { notifyBooking } from './telegram';
import { logCreate } from "./audit";

const bookingSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  phone: z.string().regex(PHONE_REGEX, PHONE_ERROR),
  service: z.string().optional(),
  message: z.string().optional(),
  notifyRole: z.string().optional(),
});

type BookingResult = { success: true; error?: string | undefined } | { success: false; error: string | null };

export async function createBooking(
  prevState: BookingResult,
  formData: FormData
): Promise<BookingResult> {
  try {
    const validatedData = bookingSchema.parse({
      name: formData.get('name'),
      phone: formData.get('phone'),
      service: formData.get('service') || undefined,
      message: formData.get('message') || undefined,
      notifyRole: formData.get('notifyRole') || undefined,
    });

    const booking = await prisma.booking.create({
      data: {
        name: validatedData.name,
        phone: validatedData.phone,
        service: validatedData.service || null,
        message: validatedData.message || null,
        notifyRole: validatedData.notifyRole || null,
      },
    });

    const text =
      `<b>Новая заявка на запись</b>\n\n` +
      `<b>Имя:</b> ${validatedData.name}\n` +
      `<b>Телефон:</b> ${validatedData.phone}\n` +
      (validatedData.service ? `<b>Услуга:</b> ${validatedData.service}\n` : '') +
      (validatedData.message ? `<b>Сообщение:</b> ${validatedData.message}\n` : '') +
      `\nID: ${booking.id}`;

    notifyBooking(text, validatedData.notifyRole);

    logCreate(
      "booking",
      booking.id,
      "",
      validatedData.name,
      "USER",
      `Phone: ${validatedData.phone}, Service: ${validatedData.service || "не указана"}`
    );

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0].message,
      };
    }
    console.error('Booking error:', error);
    return {
      success: false,
      error: 'Произошла ошибка при обработке заявки',
    };
  }
}
