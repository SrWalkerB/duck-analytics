import { z } from 'zod';

export const supportedLocales = ['pt-BR', 'en', 'es'] as const;

export const supportedLocaleSchema = z.enum(supportedLocales);

export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = 'pt-BR';
