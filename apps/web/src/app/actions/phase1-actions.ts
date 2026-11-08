'use server';

import { revalidatePath } from 'next/cache';
import {
  createAsset,
  createLocation,
  createUser,
  recordMeterReading,
  normalizeDigits,
} from '@cmms/core';
import { signIn, signOut } from '@/auth';
import { getServerContext } from '@/lib/server-context';

export async function loginAction(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim();
  const secret = String(formData.get('secret') ?? '').trim();
  const mode = String(formData.get('mode') ?? 'PASSWORD') as 'PASSWORD' | 'PIN';

  try {
    await signIn('credentials', {
      username,
      secret,
      mode,
      redirectTo: '/assets',
    });
    return { ok: true };
  } catch (err) {
    // NextAuth redirect throws NEXT_REDIRECT which must be rethrown
    if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
      throw err;
    }
    return { ok: false, error: 'نام کاربری یا رمز/پین وارد شده معتبر نیست.' };
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}

export async function createAssetAction(formData: FormData) {
  const { ctx } = await getServerContext();

  const plantId = String(formData.get('plantId') ?? '');
  const locationId = String(formData.get('locationId') ?? '') || null;
  const code = String(formData.get('code') ?? '');
  const name = String(formData.get('name') ?? '');
  const serialNumber = String(formData.get('serialNumber') ?? '') || undefined;
  const criticality = String(formData.get('criticality') ?? 'MEDIUM') as
    | 'CRITICAL'
    | 'HIGH'
    | 'MEDIUM'
    | 'LOW';
  const requiresLoto = formData.get('requiresLoto') === 'on';
  const lotoEnergySource = String(formData.get('lotoEnergySource') ?? '').trim();
  const lotoIsolationPoint = String(formData.get('lotoIsolationPoint') ?? '').trim();
  const lotoVerification = String(formData.get('lotoVerification') ?? '').trim();

  const meterName = String(formData.get('meterName') ?? '').trim();
  const meterUnit = String(formData.get('meterUnit') ?? 'ساعت').trim();
  const meterInitial = Number(normalizeDigits(String(formData.get('meterReading') ?? '0')));

  await createAsset(ctx, {
    plantId,
    locationId,
    code,
    name,
    serialNumber,
    status: 'OPERATIONAL',
    criticality,
    requiresLoto,
    lotoProcedure:
      requiresLoto && lotoEnergySource
        ? [
            {
              stepNumber: 1,
              energySource: lotoEnergySource,
              isolationPoint: lotoIsolationPoint || 'تابلو برق اصلی دستگاه',
              verificationMethod: lotoVerification || 'تست استارت و بررسی بی‌برقی کامل',
            },
          ]
        : [],
    initialMeter: meterName
      ? {
          name: meterName,
          unit: meterUnit,
          currentReading: Number.isNaN(meterInitial) ? 0 : meterInitial,
        }
      : undefined,
  });

  revalidatePath('/assets');
  revalidatePath('/');
}

export async function recordMeterReadingAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const meterId = String(formData.get('meterId') ?? '');
  const rawReading = normalizeDigits(String(formData.get('reading') ?? '0'));
  const reading = Number(rawReading);

  await recordMeterReading(ctx, {
    meterId,
    reading,
  });

  revalidatePath('/assets');
}

export async function createLocationAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const plantId = String(formData.get('plantId') ?? '');
  const code = String(formData.get('code') ?? '');
  const name = String(formData.get('name') ?? '');

  await createLocation(ctx, { plantId, code, name });
  revalidatePath('/organization');
  revalidatePath('/assets');
}

export async function createUserAction(formData: FormData) {
  const { ctx } = await getServerContext();
  const plantId = String(formData.get('plantId') ?? '');
  const username = String(formData.get('username') ?? '');
  const fullName = String(formData.get('fullName') ?? '');
  const phone = String(formData.get('phone') ?? '') || undefined;
  const role = String(formData.get('role') ?? 'TECHNICIAN') as
    | 'ADMIN'
    | 'PLANT_HEAD'
    | 'MAINTENANCE_MANAGER'
    | 'PLANNER'
    | 'SUPERVISOR'
    | 'TECHNICIAN'
    | 'OPERATOR'
    | 'AUDITOR';
  const password = String(formData.get('password') ?? '123456');
  const pin = String(formData.get('pin') ?? '1234') || undefined;

  await createUser(ctx, {
    username,
    fullName,
    phone,
    role,
    password,
    pin,
    plantIds: [plantId],
  });

  revalidatePath('/organization');
}
