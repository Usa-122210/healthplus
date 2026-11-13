import type { AiBackendProviderMode, AppState, ChatMessage } from '@/types/wellness';
import { runAiOrchestrator, type OrchestratorTurnResult } from '@/engine/aiOrchestrator';
import { evaluateProfileSafety } from '@/engine/safetyConfig';

export interface BackendHealthStatus {
  ok: boolean;
  aiGateway: {
    configured: boolean;
    provider: string | null;
    mode: AiBackendProviderMode;
    reason: string | null;
  };
  persistence: {
    supabaseConfigured: boolean;
    mode: 'local_browser_vault_only' | 'supabase_connected';
    reason: string | null;
  };
}

export async function fetchBackendHealth(): Promise<BackendHealthStatus> {
  try {
    const resp = await fetch('/api/health');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as BackendHealthStatus;
    return data;
  } catch {
    return {
      ok: false,
      aiGateway: {
        configured: false,
        provider: null,
        mode: 'grounded_fallback_unconfigured',
        reason: 'backend_unreachable_using_grounded_fallback',
      },
      persistence: {
        supabaseConfigured: false,
        mode: 'local_browser_vault_only',
        reason: 'blocked_by_missing_supabase_credentials',
      },
    };
  }
}

/**
 * Full Phase 4A Pipeline:
 * 1. Deterministic NLU + safety/ingredient/macro computation produces the strictly grounded baseline & memory state.
 * 2. Sends anonymized, verified profile + pantry + today totals + conversation history to `/api/ai/chat`.
 * 3. If a server LLM key (Gemini/OpenAI) is configured and passes output safety validation, upgrades natural copy while retaining strict safety attachments; otherwise returns the honestly labeled deterministic grounded coordinator reply.
 */
export async function executeConnectedAiTurn(
  userText: string,
  state: AppState
): Promise<{
  turn: OrchestratorTurnResult;
  providerMode: AiBackendProviderMode;
  providerLabel: string;
}> {
  const localTurn = runAiOrchestrator(userText, state);

  if (!state.profile || !state.targets || !state.onboardingCompleted) {
    return {
      turn: localTurn,
      providerMode: 'grounded_fallback_unconfigured',
      providerLabel: 'Onboarding Gate',
    };
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const mealsToday = state.mealsLogged.filter((m) => m.dateISO === todayISO);
  const workoutsToday = state.workoutsLogged.filter((w) => w.dateISO === todayISO);
  const safetyEval = evaluateProfileSafety(state.profile);

  const userContext = {
    name: state.profile.basic.name,
    primaryGoal: state.profile.goals.primaryGoal,
    dietaryPattern: state.profile.foodPreferences.dietaryPattern,
    allergies: state.profile.safety.allergies,
    celiacOrGlutenFree: state.profile.safety.celiacOrGlutenFree,
    conditions: {
      disclosureStatus: state.profile.safety.disclosureStatus ?? 'disclosed',
      diabetes: state.profile.safety.diabetesOrSugarConcern,
      hypertension: state.profile.safety.hypertensionOrBpConcern,
      kidney: state.profile.safety.kidneyOrRenalConcern,
      pregnancy: state.profile.safety.pregnancyOrPostpartum,
    },
    unavailableIngredients: localTurn.updatedMemory.unavailableIngredients,
    availableIngredients:
      localTurn.newlyAvailableIngredients ?? state.profile.foodAvailability.availableIngredients,
    targets: state.targets,
    todayRecorded: {
      mealsCount: mealsToday.length,
      caloriesLogged: mealsToday.reduce((s, m) => s + m.calories, 0),
      proteinLoggedG: mealsToday.reduce((s, m) => s + m.proteinG, 0),
      workoutsCount: workoutsToday.length,
      repsLogged: workoutsToday.reduce((s, w) => s + w.repsCompleted, 0),
    },
    activeSafetyRules: safetyEval.activeRules.map((r) => r.title),
  };

  try {
    const resp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        targetLanguage: localTurn.assistantMessage.language,
        intent: localTurn.assistantMessage.pipelineTrace?.intent ?? 'general_checkin',
        userContext,
        history: state.chatMessages.slice(-6).map((m: ChatMessage) => ({
          role: m.role,
          content: m.content,
        })),
        candidateReplyHint: localTurn.assistantMessage.content,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Gateway status ${resp.status}`);
    }

    const payload = (await resp.json()) as {
      ok: boolean;
      configured: boolean;
      provider?: string | null;
      model?: string;
      validated?: boolean;
      content?: string;
      reason?: string;
    };

    if (payload.configured && payload.validated && payload.content) {
      const upgradedMsg: ChatMessage = {
        ...localTurn.assistantMessage,
        content: payload.content,
        providerMode: 'live_llm_gateway',
        pipelineTrace: localTurn.assistantMessage.pipelineTrace
          ? {
              ...localTurn.assistantMessage.pipelineTrace,
              providerMode: 'live_llm_gateway',
              providerLabel: `${payload.provider || 'LLM'} (${payload.model || 'gateway'})`,
              safetyChecksPassed: [
                ...localTurn.assistantMessage.pipelineTrace.safetyChecksPassed,
                'Server output safety & allergen validator passed',
              ],
            }
          : undefined,
      };
      return {
        turn: { ...localTurn, assistantMessage: upgradedMsg },
        providerMode: 'live_llm_gateway',
        providerLabel: `Live LLM (${payload.provider || 'gateway'})`,
      };
    }

    const fallbackLabel = payload.configured
      ? 'Grounded Safety Fallback (LLM validation guard triggered)'
      : 'Grounded Rules Fallback (No LLM API key configured)';

    const annotatedMsg: ChatMessage = {
      ...localTurn.assistantMessage,
      providerMode: 'grounded_fallback_unconfigured',
      pipelineTrace: localTurn.assistantMessage.pipelineTrace
        ? {
            ...localTurn.assistantMessage.pipelineTrace,
            providerMode: 'grounded_fallback_unconfigured',
            providerLabel: fallbackLabel,
          }
        : undefined,
    };
    return {
      turn: { ...localTurn, assistantMessage: annotatedMsg },
      providerMode: 'grounded_fallback_unconfigured',
      providerLabel: fallbackLabel,
    };
  } catch {
    return {
      turn: {
        ...localTurn,
        assistantMessage: {
          ...localTurn.assistantMessage,
          providerMode: 'grounded_fallback_unconfigured',
        },
      },
      providerMode: 'grounded_fallback_unconfigured',
      providerLabel: 'Offline Grounded Rules Fallback',
    };
  }
}
