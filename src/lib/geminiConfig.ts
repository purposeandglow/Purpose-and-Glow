import { GoogleGenAI } from '@google/genai';

export const DEFAULT_PUBLIC_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const DEFAULT_ADMIN_GEMINI_MODEL = 'gemini-3.1-flash-lite';

export interface GeminiRuntimeConfig {
  hasApiKey: boolean;
  publicAiEnabled: boolean;
  publicModel: string;
  adminModel: string;
  limits: {
    hourlyIpLimit: number;
    dailyIpLimit: number;
    dailyGlobalLimit: number;
    monthlyGlobalLimit: number;
  };
}

export function getGeminiRuntimeConfig(env: NodeJS.ProcessEnv = process.env): GeminiRuntimeConfig {
  const parseLimit = (val: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(val || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    hasApiKey: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0),
    publicAiEnabled: env.PUBLIC_AI_ENABLED === 'true',
    publicModel: (env.GEMINI_PUBLIC_MODEL || DEFAULT_PUBLIC_GEMINI_MODEL).trim(),
    adminModel: (env.GEMINI_ADMIN_MODEL || DEFAULT_ADMIN_GEMINI_MODEL).trim(),
    limits: {
      hourlyIpLimit: parseLimit(env.PUBLIC_AI_HOURLY_IP_LIMIT, 3),
      dailyIpLimit: parseLimit(env.PUBLIC_AI_DAILY_IP_LIMIT, 5),
      dailyGlobalLimit: parseLimit(env.PUBLIC_AI_DAILY_LIMIT, 100),
      monthlyGlobalLimit: parseLimit(env.PUBLIC_AI_MONTHLY_LIMIT, 2000),
    },
  };
}

export function createGeminiClient(apiKey: string | undefined = process.env.GEMINI_API_KEY): GoogleGenAI | null {
  if (!apiKey || !apiKey.trim()) return null;
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface GeminiModelVerificationResult {
  configured: boolean;
  verifiedAt: string;
  configuredModels: {
    publicModel: string;
    adminModel: string;
  };
  availableModels: string[];
  publicModelAvailable: boolean;
  adminModelAvailable: boolean;
  fallbackTextCandidates: string[];
  error?: string;
}

export async function verifyAvailableGeminiModels(
  client: GoogleGenAI | null,
  config: GeminiRuntimeConfig = getGeminiRuntimeConfig()
): Promise<GeminiModelVerificationResult> {
  const verifiedAt = new Date().toISOString();
  if (!client) {
    return {
      configured: false,
      verifiedAt,
      configuredModels: {
        publicModel: config.publicModel,
        adminModel: config.adminModel,
      },
      availableModels: [],
      publicModelAvailable: false,
      adminModelAvailable: false,
      fallbackTextCandidates: [],
      error: 'GEMINI_API_KEY is not configured in the server environment.',
    };
  }

  try {
    const pager = await client.models.list({ config: { pageSize: 100 } });
    const names: string[] = [];
    for await (const model of pager) {
      if (model.name) {
        names.push(model.name.replace(/^models\//, ''));
      }
    }

    const publicModelAvailable = names.includes(config.publicModel);
    const adminModelAvailable = names.includes(config.adminModel);
    const fallbackTextCandidates = names.filter((n) =>
      /flash|hydrogen/i.test(n) && !/image|tts|audio|live|transcribe|veo|lyria|embedding/i.test(n)
    );

    return {
      configured: true,
      verifiedAt,
      configuredModels: {
        publicModel: config.publicModel,
        adminModel: config.adminModel,
      },
      availableModels: names.slice(0, 60),
      publicModelAvailable,
      adminModelAvailable,
      fallbackTextCandidates,
    };
  } catch (err: unknown) {
    return {
      configured: true,
      verifiedAt,
      configuredModels: {
        publicModel: config.publicModel,
        adminModel: config.adminModel,
      },
      availableModels: [],
      publicModelAvailable: false,
      adminModelAvailable: false,
      fallbackTextCandidates: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
