/**
 * LLMClient.ts
 * LLM 调用封装 —— 兼容 OpenAI API 格式（LM Studio / Ollama / Groq）
 */

import fetch from 'node-fetch';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: process.env.LLM_BASE_URL || 'http://192.168.200.11:1234',
  model: process.env.LLM_MODEL || 'google/gemma-3-4b',
  apiKey: process.env.LLM_API_KEY || '',
  temperature: 0.8,
  maxTokens: 512,
};

export class LLMClient {
  private config: LLMConfig;

  constructor(config?: Partial<LLMConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;

    const body = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 如果配置了 apiKey，添加 Authorization 头
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LLM 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('LLM 返回为空');
    }

    return {
      content: choice.message?.content ?? '',
      usage: data.usage,
    };
  }

  /**
   * 简单单轮对话
   */
  async ask(systemPrompt: string, userMessage: string): Promise<string> {
    const result = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);
    return result.content;
  }
}
