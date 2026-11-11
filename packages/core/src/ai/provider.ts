export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatResponse {
  text: string;
  provider: string;
  model: string;
  simulated: boolean;
  tokensUsed?: number;
}

export interface AiProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
}

/**
 * Creates the active AI provider based on environment variables.
 * Defaults to safe offline simulation mode on factory intranets with no external internet.
 */
export function createAiProvider(): AiProvider {
  const providerType = (process.env['AI_PROVIDER'] ?? 'local').toLowerCase();
  const apiKey = process.env['AI_API_KEY'];
  const baseUrl = (process.env['AI_API_BASE_URL'] ?? 'http://localhost:11434/v1').replace(/\/$/, '');
  const model = process.env['AI_MODEL'] ?? 'dorna-llama3';

  // If explicitly disabled or no local/cloud credentials available
  if (providerType === 'disabled') {
    return {
      name: 'disabled',
      async chat() {
        throw new Error('سیستم هوش مصنوعی بر اساس تنظیمات اینترانت غیرفعال شده است.');
      },
    };
  }

  // Real HTTP OpenAI-compatible or Ollama endpoint
  if (providerType === 'openai' || providerType === 'ollama' || (providerType === 'local' && apiKey)) {
    return {
      name: providerType,
      async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
        const timeoutMs = options?.timeoutMs ?? 15_000;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        try {
          const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model,
              messages,
              temperature: options?.temperature ?? 0.3,
              max_tokens: options?.maxTokens ?? 1024,
            }),
            signal: AbortSignal.timeout(timeoutMs),
          });

          if (!res.ok) {
            throw new Error(`خطای سرور هوش مصنوعی (${res.status})`);
          }

          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { total_tokens?: number };
          };
          const reply = data.choices?.[0]?.message?.content ?? '';

          return {
            text: reply,
            provider: providerType,
            model,
            simulated: false,
            tokensUsed: data.usage?.total_tokens,
          };
        } catch (err) {
          // Graceful fallback to simulated rule-based response if endpoint is unreachable on intranet
          console.warn('AI endpoint unreachable, falling back to local heuristic:', err);
          return simulateAiResponse(messages);
        }
      },
    };
  }

  // Default: Safe Intranet heuristic mode
  return {
    name: 'simulated-heuristic',
    async chat(messages: ChatMessage[]): Promise<ChatResponse> {
      return simulateAiResponse(messages);
    },
  };
}

function simulateAiResponse(messages: ChatMessage[]): ChatResponse {
  const userMsg = messages.find((m) => m.role === 'user')?.content ?? '';
  let advice = 'بر اساس سوابق نگهداری تجهیز و استانداردهای صنعتی:';

  if (userMsg.includes('پمپ') || userMsg.includes('آب‌بندی') || userMsg.includes('فشار')) {
    advice +=
      '\n• ارتعاش و صدای غیرعادی پمپ معمولاً ناشی از کاویتاسیون (Cavitation) یا ناهم‌راستایی کوپلینگ (Misalignment) است.\n• فشار خط مکش و سلامت مکانیکال‌سیل (Mechanical Seal) را بررسی کنید.\n• دمای پوسته یاتاقان نباید از ۶۵ درجه سانتی‌گراد فراتر رود.';
  } else if (userMsg.includes('پرس') || userMsg.includes('هیدرولیک') || userMsg.includes('روغن')) {
    advice +=
      '\n• افت فشار هیدرولیک ناشی از فرسودگی پکینگ‌های جک یا انسداد فیلتر خط برگشت است.\n• دمای روغن مخزن هیدرولیک و شاخص ویسکوزیته (ISO VG 46/68) را بسنجید.\n• شیرهای کنترل فشار (Pressure Relief Valve) را از نظر نشتی داخلی تست نمایید.';
  } else if (userMsg.includes('کمپرسور') || userMsg.includes('دما')) {
    advice +=
      '\n• افزایش دمای تخلیه کمپرسور اسکرو ناشی از انسداد رادیاتور روغن یا پایان عمر فیلتر سپراتور است.\n• مقدار روغن در گیج شیشه‌ای را در حالت بارداری (Loaded) چک کنید.\n• شیر ترموستاتیک جریان روغن را بازرسی نمایید.';
  } else {
    advice +=
      '\n• اتصالات مکانیکی، روغن‌کاری گریس‌خورها و سلامت بلبرینگ‌ها را با استتوسکوپ صنعتی بررسی کنید.\n• جریان مصرفی الکتروموتور (آمپراژ) را با پلاک نامی مقایسه نمایید.\n• از سفت بودن پیچ‌های فونداسیون اطمینان حاصل کنید.';
  }

  advice +=
    '\n\n⚠️ **هشدار ایمنی الزامی:** این پیشنهاد صرفاً راهنمای کمکی است. قبل از هرگونه بازرسی فنی، اجرای کامل دستورالعمل قفل‌گذاری و برچسب‌گذاری (LOTO) و تخلیه انرژی باقیمانده الزامی است.';

  return {
    text: advice,
    provider: 'heuristic-local',
    model: 'factory-cmms-v1',
    simulated: true,
  };
}
