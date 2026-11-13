import React, { useState } from 'react';
import {
  Utensils,
  Clock,
  ShieldAlert,
  CheckCircle2,
  ChefHat,
  SlidersHorizontal,
  Sparkles,
  Camera,
  Plus,
  RefreshCw,
  Info,
  ShoppingBag,
  ThumbsDown,
  PackageX,
  Zap,
  Wallet,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RecipeVisual } from '@/components/food/RecipeVisual';
import { useApp } from '@/context/AppContext';
import {
  INGREDIENT_CATALOG,
  NUTRITION_RECIPES,
  extractIngredientsFromText,
  getIngredientLabel,
} from '@/engine/nutritionCatalog';
import { recommendMeals } from '@/engine/recommendationEngine';
import type { IngredientKey, MealSlot } from '@/types/wellness';

export interface FoodHubPageProps {
  onNavigate?: (path: string) => void;
  initialTab?: 'diary' | 'scanner' | 'plan' | 'grocery';
}

const SLOT_LABELS: Array<{ id: MealSlot; label: string }> = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snack', label: 'Evening Snack' },
  { id: 'dinner', label: 'Dinner' },
];

export const FoodHubPage: React.FC<FoodHubPageProps> = ({
  onNavigate = () => {},
  initialTab = 'plan',
}) => {
  const {
    state,
    mealsToday,
    caloriesConsumedToday,
    proteinConsumedToday,
    activeSafetyBanners,
    activeMealSlot,
    setActiveMealSlot,
    recommendationBundle,
    updateFoodAvailability,
    submitFoodFeedback,
    resetFoodFeedbackFilters,
    logMeal,
  } = useApp();

  const [tab, setTab] = useState<'ideas' | 'plan_grocery' | 'pantry' | 'log'>(
    initialTab === 'scanner' || initialTab === 'diary'
      ? 'log'
      : initialTab === 'grocery'
        ? 'plan_grocery'
        : 'ideas'
  );
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [pantryInput, setPantryInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Honest Photo / Manual Estimator state
  const [selectedEstimateId, setSelectedEstimateId] = useState(NUTRITION_RECIPES[2]?.id ?? '');
  const [portionMultiplier, setPortionMultiplier] = useState(1);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);

  const profile = state.profile;
  const targets = state.targets;

  if (!profile || !targets) {
    return null;
  }

  const available = profile.foodAvailability.availableIngredients;
  const unavailable = Array.from(
    new Set<IngredientKey>([
      ...profile.foodAvailability.unavailableIngredients,
      ...state.conversationMemory.unavailableIngredients,
    ])
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleIngredient = (key: IngredientKey) => {
    if (available.includes(key)) {
      updateFoodAvailability(
        available.filter((i) => i !== key),
        Array.from(new Set([...unavailable, key]))
      );
    } else {
      updateFoodAvailability(
        [...available, key],
        unavailable.filter((i) => i !== key)
      );
    }
  };

  const handleQuickPantryParse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pantryInput.trim()) return;
    const detected = extractIngredientsFromText(pantryInput);
    if (detected.length > 0) {
      updateFoodAvailability(
        Array.from(new Set([...available, ...detected])),
        unavailable.filter((item) => !detected.includes(item))
      );
      showToast(
        `Kitchen updated with ${detected.map((k) => getIngredientLabel(k).split(' / ')[0]).join(', ')}`
      );
    } else {
      showToast('Try naming common Indian ingredients like dal, curd, paneer, soya, rice, eggs.');
    }
    setPantryInput('');
  };

  const estimateTemplate =
    NUTRITION_RECIPES.find((r) => r.id === selectedEstimateId) ?? NUTRITION_RECIPES[0];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogEstimatedMeal = () => {
    if (!estimateTemplate) return;
    logMeal({
      recipeId: estimateTemplate.id,
      name: `${estimateTemplate.name} (${portionMultiplier}x portion)`,
      mealSlot: activeMealSlot,
      calories: Math.round(estimateTemplate.macros.calories * portionMultiplier),
      proteinG: Math.round(estimateTemplate.macros.proteinG * portionMultiplier),
      carbsG: Math.round(estimateTemplate.macros.carbsG * portionMultiplier),
      fatG: Math.round(estimateTemplate.macros.fatG * portionMultiplier),
      fiberG: Number((estimateTemplate.macros.fiberG * portionMultiplier).toFixed(1)),
      sodiumMg: Math.round(estimateTemplate.macros.sodiumMg * portionMultiplier),
      source: uploadedPreviewUrl ? 'photo_prototype_estimate' : 'quick_estimate',
      provenanceLabel: 'Prototype portion-weighted kitchen estimate',
    });
    showToast(`Logged ${estimateTemplate.name} to Today's record.`);
  };

  return (
    <div className="space-y-6 pb-20 text-left animate-fadeIn max-w-6xl mx-auto">
      {/* Header + Daily Nutrition Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="emerald" size="sm">
              Safe Home Nutrition
            </Badge>
            <span className="text-xs text-forest/65 dark:text-ivory/65">
              Diet: <strong className="capitalize">{profile.foodPreferences.dietaryPattern.replace('_', ' ')}</strong> ·{' '}
              Max {profile.foodPreferences.cookingTimeLimitMins}m prep
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-forest dark:text-white mt-1">
            Food That Fits Your Kitchen &amp; Health
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === 'ideas' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setTab('ideas')}
            leftIcon={<ChefHat className="w-3.5 h-3.5" />}
          >
            Meal Ideas
          </Button>
          <Button
            variant={tab === 'plan_grocery' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setTab('plan_grocery')}
            leftIcon={<ShoppingBag className="w-3.5 h-3.5" />}
          >
            Daily Plan &amp; Grocery
          </Button>
          <Button
            variant={tab === 'pantry' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setTab('pantry')}
            leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
          >
            Kitchen ({available.length})
          </Button>
          <Button
            variant={tab === 'log' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setTab('log')}
            leftIcon={<Utensils className="w-3.5 h-3.5" />}
          >
            Today&apos;s Log ({mealsToday.length})
          </Button>
        </div>
      </div>

      {/* Macro Summary Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card variant="surface" className="p-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-bold text-forest dark:text-white">Daily Energy Intake</span>
            <span className="font-semibold text-emerald dark:text-emerald-400">
              {caloriesConsumedToday.toLocaleString()} / {targets.calorieTarget.toLocaleString()} kcal
            </span>
          </div>
          <ProgressBar
            progress={Math.min(100, Math.round((caloriesConsumedToday / targets.calorieTarget) * 100))}
            variant="emerald"
            size="sm"
          />
        </Card>
        <Card variant="surface" className="p-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-bold text-forest dark:text-white">Protein Progress</span>
            <span className="font-semibold text-amber-600 dark:text-gold">
              {proteinConsumedToday}g / {targets.proteinTargetG}g
            </span>
          </div>
          <ProgressBar
            progress={Math.min(100, Math.round((proteinConsumedToday / targets.proteinTargetG) * 100))}
            variant="gold"
            size="sm"
          />
        </Card>
      </div>

      {/* Safety Banners */}
      {activeSafetyBanners.length > 0 && (
        <div className="space-y-2">
          {activeSafetyBanners.map((b, i) => (
            <div
              key={i}
              className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs text-forest dark:text-ivory"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-gold shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{b.title}: </span>
                <span>{b.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {toastMessage && (
        <div className="p-3 rounded-xl bg-emerald/15 border border-emerald/35 text-xs font-semibold text-forest dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TAB 1: MEAL IDEAS & REACTIVE FEEDBACK */}
      {tab === 'ideas' && (
        <div className="space-y-5">
          {/* Meal Slot Selector & Active Constraint Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {SLOT_LABELS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setActiveMealSlot(slot.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    activeMealSlot === slot.id
                      ? 'bg-forest text-white dark:bg-emerald dark:text-white border-forest dark:border-emerald'
                      : 'bg-white/70 dark:bg-white/5 border-forest/10 dark:border-white/10 text-forest/75 dark:text-ivory/75'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {unavailable.length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-rose-500/12 text-rose-700 dark:text-rose-300 font-semibold">
                  Not at home:{' '}
                  {unavailable.map((k) => getIngredientLabel(k).split(' / ')[0]).join(', ')}
                </span>
              )}
              {(state.foodFeedbackMemory.rejectedRecipeIds.length > 0 ||
                state.foodFeedbackMemory.preferFaster ||
                state.foodFeedbackMemory.preferCheaper ||
                unavailable.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    resetFoodFeedbackFilters();
                    showToast('Session food filters reset cleanly.');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-forest/8 dark:bg-white/10 text-forest dark:text-ivory font-semibold hover:bg-forest/15"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Recommendations List */}
          {recommendationBundle && recommendationBundle.recommendations.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {recommendationBundle.recommendations.map((scored) => {
                const { recipe } = scored;
                const isExpanded = expandedRecipeId === recipe.id;
                const heroIngredient = recipe.requiredIngredients[0];

                return (
                  <Card key={recipe.id} variant="elevated" className="overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-5 space-y-4 flex-1">
                      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 items-center">
                        <RecipeVisual theme={recipe.visualTheme} />

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="emerald" size="sm">
                              <Clock className="w-3 h-3 mr-1 inline" />
                              {recipe.prepMins} min
                            </Badge>
                            <Badge variant="gold" size="sm">
                              {recipe.budgetTier === 'budget' ? 'Budget Friendly' : recipe.difficulty}
                            </Badge>
                            {scored.safetyNotes[0] && (
                              <Badge variant="sage" size="sm">
                                {scored.safetyNotes[0]}
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-heading font-bold text-base sm:text-lg text-forest dark:text-white leading-snug">
                            {recipe.name}
                          </h3>
                          <p className="text-[11px] font-medium text-emerald dark:text-emerald-400">
                            {recipe.hinglishName}
                          </p>
                          <p className="text-xs text-forest/75 dark:text-ivory/75">
                            {scored.matchReasons[0]}
                          </p>
                        </div>
                      </div>

                      {/* Macro Strip */}
                      <div className="grid grid-cols-4 gap-2 p-2.5 rounded-2xl bg-forest/4 dark:bg-white/5 text-center">
                        <div>
                          <div className="text-xs font-extrabold text-forest dark:text-white">
                            {recipe.macros.calories}
                          </div>
                          <div className="text-[10px] text-forest/60 dark:text-ivory/60">kcal</div>
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-emerald dark:text-emerald-400">
                            {recipe.macros.proteinG}g
                          </div>
                          <div className="text-[10px] text-forest/60 dark:text-ivory/60">Protein</div>
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-forest dark:text-white">
                            {recipe.macros.carbsG}g
                          </div>
                          <div className="text-[10px] text-forest/60 dark:text-ivory/60">Carbs</div>
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-amber-600 dark:text-gold">
                            {recipe.macros.fiberG}g
                          </div>
                          <div className="text-[10px] text-forest/60 dark:text-ivory/60">Fiber</div>
                        </div>
                      </div>

                      {/* Expandable Prep Steps & Provenance */}
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRecipeId(isExpanded ? null : recipe.id)
                          }
                          className="text-xs font-bold text-emerald dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Info className="w-3.5 h-3.5" />
                          {isExpanded
                            ? 'Hide prep steps & data source'
                            : 'View simple cooking steps, swaps & nutrition basis'}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-forest/4 dark:bg-white/5 space-y-2.5 text-xs text-forest/85 dark:text-ivory/85">
                            <p>{recipe.summary}</p>
                            <ol className="list-decimal list-inside space-y-1">
                              {recipe.steps.map((s, idx) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ol>
                            {recipe.swaps.length > 0 && (
                              <p className="text-[11px] text-emerald dark:text-emerald-400">
                                <strong>Easy Swaps:</strong> {recipe.swaps.join(' · ')}
                              </p>
                            )}
                            <p className="text-[10px] text-forest/60 dark:text-ivory/60 border-t border-forest/10 dark:border-white/10 pt-2">
                              <strong>Data Provenance:</strong> {recipe.provenanceNote} (
                              {recipe.ingredientAmounts.map((i) => i.amountLabel).join(' · ')} — {recipe.referenceItems.join(', ')}).
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Primary Action + Interactive Rejection / Preference Feedback */}
                      <div className="pt-2 border-t border-forest/8 dark:border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              logMeal({
                                recipeId: recipe.id,
                                name: recipe.name,
                                mealSlot: activeMealSlot,
                                calories: recipe.macros.calories,
                                proteinG: recipe.macros.proteinG,
                                carbsG: recipe.macros.carbsG,
                                fatG: recipe.macros.fatG,
                                fiberG: recipe.macros.fiberG,
                                sodiumMg: recipe.macros.sodiumMg,
                                source: 'recommended_recipe',
                                provenanceLabel: 'Prototype kitchen recipe estimate',
                              });
                              showToast(`Logged "${recipe.name}" to Today.`);
                            }}
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                          >
                            Log This Meal
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onNavigate('/coach')}
                            leftIcon={<Sparkles className="w-3.5 h-3.5 text-gold" />}
                          >
                            Ask AI Coach
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              submitFoodFeedback(recipe.id, 'dont_have', heroIngredient);
                              showToast(
                                `Removed "${recipe.name}" & marked ${getIngredientLabel(heroIngredient).split(' / ')[0]} unavailable.`
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forest/5 dark:bg-white/5 hover:bg-rose-500/15 text-[11px] font-semibold text-forest/80 dark:text-ivory/80"
                          >
                            <PackageX className="w-3 h-3" />
                            I don&apos;t have this
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              submitFoodFeedback(recipe.id, 'dont_like');
                              showToast(`Hidden "${recipe.name}" and refreshed options.`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forest/5 dark:bg-white/5 hover:bg-rose-500/15 text-[11px] font-semibold text-forest/80 dark:text-ivory/80"
                          >
                            <ThumbsDown className="w-3 h-3" />
                            I don&apos;t like this
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              submitFoodFeedback(recipe.id, 'faster');
                              showToast('Prioritizing faster <= 15 min meals.');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forest/5 dark:bg-white/5 hover:bg-emerald/15 text-[11px] font-semibold text-forest/80 dark:text-ivory/80"
                          >
                            <Zap className="w-3 h-3" />
                            Make it faster
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              submitFoodFeedback(recipe.id, 'cheaper');
                              showToast('Prioritizing budget-friendly pantry recipes.');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forest/5 dark:bg-white/5 hover:bg-emerald/15 text-[11px] font-semibold text-forest/80 dark:text-ivory/80"
                          >
                            <Wallet className="w-3 h-3" />
                            Make it cheaper
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              submitFoodFeedback(recipe.id, 'something_else');
                              showToast('Swapped for fresh safe alternatives.');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forest/5 dark:bg-white/5 hover:bg-emerald/15 text-[11px] font-semibold text-forest/80 dark:text-ivory/80"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Suggest something else
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card variant="elevated" className="p-6 text-center space-y-3">
              <p className="text-sm font-bold text-forest dark:text-white">
                No exact meal matches left with your current kitchen filters.
              </p>
              <p className="text-xs text-forest/70 dark:text-ivory/70">
                Tell me what ingredients you do have in the Kitchen tab or reset temporary filters.
              </p>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => setTab('pantry')}>
                  Update Kitchen Ingredients
                </Button>
                <Button size="sm" variant="outline" onClick={resetFoodFeedbackFilters}>
                  Reset Session Filters
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: DAILY KITCHEN AVAILABILITY */}
      {tab === 'pantry' && (
        <Card variant="elevated" className="p-5 sm:p-6">
          <h2 className="font-heading font-bold text-base text-forest dark:text-white mb-4">
            What&apos;s Available at Home Today
          </h2>
          <div className="space-y-4">
            <p className="text-xs text-forest/75 dark:text-ivory/75">
              Tap ingredients to mark them available or out of stock. Both Food Hub and your AI Coach immediately adapt around this list.
            </p>

            <form onSubmit={handleQuickPantryParse} className="flex gap-2">
              <input
                type="text"
                value={pantryInput}
                onChange={(e) => setPantryInput(e.target.value)}
                placeholder="Type what you have right now, e.g. 'dal, curd, soya, tomato, rice'"
                className="flex-1 rounded-xl border border-forest/15 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-xs text-forest dark:text-white"
              />
              <Button type="submit" size="sm">
                Update Kitchen
              </Button>
            </form>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {INGREDIENT_CATALOG.map((ing) => {
                const isAvail = available.includes(ing.key);
                const isUnavail = unavailable.includes(ing.key);
                return (
                  <button
                    key={ing.key}
                    type="button"
                    onClick={() => handleToggleIngredient(ing.key)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                      isAvail
                        ? 'bg-emerald/15 border-emerald text-forest dark:text-white'
                        : isUnavail
                          ? 'bg-rose-500/12 border-rose-500/30 text-rose-700 dark:text-rose-300'
                          : 'bg-forest/4 dark:bg-white/5 border-forest/10 dark:border-white/10 text-forest/70 dark:text-ivory/70'
                    }`}
                  >
                    <div className="truncate">{ing.label.split(' / ')[0]}</div>
                    <div className="text-[10px] opacity-75">
                      {isAvail ? 'In kitchen ✓' : isUnavail ? 'Marked out ✕' : 'Tap to add'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* TAB 1B: STRUCTURED DAILY MEAL PLAN & AUTOMATIC GROCERY LIST */}
      {tab === 'plan_grocery' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-5">
          <Card variant="elevated" className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-heading font-bold text-base text-forest dark:text-white">
                  Full-Day Profile-Safe Indian Meal Plan
                </h2>
                <p className="text-[11px] text-forest/70 dark:text-ivory/70">
                  Built from ingredient-weighted home-portion recipes, excluding allergens &amp; items unavailable at home.
                </p>
              </div>
              <Badge variant="emerald" size="sm">
                4 Daily Slots
              </Badge>
            </div>

            <div className="space-y-3">
              {SLOT_LABELS.map((slot) => {
                const slotBundle = recommendMeals(
                  profile,
                  {
                    mealSlot: slot.id,
                    rejectedRecipeIds: Array.from(
                      new Set([
                        ...state.foodFeedbackMemory.rejectedRecipeIds,
                        ...state.conversationMemory.rejectedRecipeIds,
                      ])
                    ),
                    unavailableIngredients: unavailable,
                    availableIngredients: available,
                    maxPrepMins: profile.foodPreferences.cookingTimeLimitMins,
                    budgetPriority: profile.foodPreferences.budgetTier === 'budget',
                    antiRepeatIds: [],
                    strictAvailabilityOnly: false,
                  },
                  state.mealsLogged,
                  1
                );
                const pick = slotBundle.recommendations[0];
                return (
                  <div
                    key={slot.id}
                    className="p-3.5 rounded-2xl bg-forest/4 dark:bg-white/5 border border-forest/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {pick ? (
                      <>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald dark:text-emerald-300">
                            {slot.label} · {pick.recipe.prepMins} min
                          </span>
                          <p className="text-sm font-bold text-forest dark:text-white">
                            {pick.recipe.name}
                          </p>
                          <p className="text-[11px] text-forest/70 dark:text-ivory/70">
                            ~{pick.recipe.macros.calories} kcal · ~{pick.recipe.macros.proteinG}g P ·{' '}
                            {pick.recipe.macros.fiberG}g fiber
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            logMeal({
                              recipeId: pick.recipe.id,
                              name: pick.recipe.name,
                              mealSlot: pick.recipe.mealSlot,
                              calories: pick.recipe.macros.calories,
                              proteinG: pick.recipe.macros.proteinG,
                              carbsG: pick.recipe.macros.carbsG,
                              fatG: pick.recipe.macros.fatG,
                              fiberG: pick.recipe.macros.fiberG,
                              sodiumMg: pick.recipe.macros.sodiumMg,
                              source: 'recommended_recipe',
                              provenanceLabel: 'Ingredient-computed home recipe estimate',
                            });
                            showToast(`Logged "${pick.recipe.name}" for ${slot.label}.`);
                          }}
                        >
                          Log {slot.label}
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-forest/65 dark:text-ivory/65">
                        {slot.label}: No safe match with current exclusions — adjust filters in Kitchen.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card variant="elevated" className="p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-heading font-bold text-base text-forest dark:text-white">
                Smart Kitchen Grocery List
              </h2>
              <p className="text-[11px] text-forest/70 dark:text-ivory/70">
                Missing staples needed to prepare your top recommended daily dishes.
              </p>
            </div>

            {(() => {
              const needed = Array.from(
                new Set(
                  SLOT_LABELS.flatMap((slot) => {
                    const b = recommendMeals(
                      profile,
                      {
                        mealSlot: slot.id,
                        rejectedRecipeIds: Array.from(
                          new Set([
                            ...state.foodFeedbackMemory.rejectedRecipeIds,
                            ...state.conversationMemory.rejectedRecipeIds,
                          ])
                        ),
                        unavailableIngredients: unavailable,
                        availableIngredients: available,
                        maxPrepMins: profile.foodPreferences.cookingTimeLimitMins,
                        budgetPriority: profile.foodPreferences.budgetTier === 'budget',
                        antiRepeatIds: [],
                        strictAvailabilityOnly: false,
                      },
                      state.mealsLogged,
                      1
                    );
                    return b.recommendations[0]?.missingIngredients ?? [];
                  })
                )
              );

              if (needed.length === 0) {
                return (
                  <div className="p-4 rounded-2xl bg-emerald/10 border border-emerald/25 text-xs text-forest dark:text-ivory">
                    All ingredients for today&apos;s 4-slot home plan are already marked in your kitchen.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {needed.map((ingKey) => (
                    <div
                      key={ingKey}
                      className="p-3 rounded-xl bg-forest/4 dark:bg-white/5 border border-forest/10 dark:border-white/10 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-semibold text-forest dark:text-white">
                        {getIngredientLabel(ingKey)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleIngredient(ingKey)}
                        className="px-2.5 py-1 rounded-lg bg-emerald/15 hover:bg-emerald/25 text-emerald dark:text-emerald-300 font-bold"
                      >
                        Mark In Kitchen
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {/* TAB 3: LOGGED MEALS & HONEST PROTOTYPE PHOTO ESTIMATOR */}
      {tab === 'log' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card variant="elevated" className="p-5 sm:p-6">
            <h2 className="font-heading font-bold text-base text-forest dark:text-white mb-4">
              Log a Home Meal / Visual Estimator
            </h2>
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-forest dark:text-ivory/90">
                <strong>Honest Prototype Note:</strong> Automated live image classification is disabled in offline mode. Upload a plate photo for your visual diary and choose the closest Indian dish + portion size using standardized prototype home-portion estimates.
              </div>

              <div>
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-forest/15 dark:border-white/15 bg-forest/5 dark:bg-white/5 text-xs font-semibold cursor-pointer text-forest dark:text-white">
                  <Camera className="w-4 h-4 text-emerald" />
                  <span>{uploadedPreviewUrl ? 'Change Plate Photo' : 'Attach Meal Photo (Local Only)'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
                {uploadedPreviewUrl && (
                  <img
                    src={uploadedPreviewUrl}
                    alt="Uploaded meal plate"
                    className="mt-3 w-full h-40 object-cover rounded-2xl border border-forest/10 dark:border-white/10"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest dark:text-ivory mb-1.5">
                  Select Indian Dish Baseline
                </label>
                <select
                  value={selectedEstimateId}
                  onChange={(e) => setSelectedEstimateId(e.target.value)}
                  className="w-full rounded-xl border border-forest/15 dark:border-white/15 bg-white dark:bg-[#0A1E17] px-3 py-2 text-xs text-forest dark:text-white"
                >
                  {NUTRITION_RECIPES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (~{r.macros.calories} kcal)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest dark:text-ivory mb-1.5">
                  Portion Scale: <strong>{portionMultiplier}x</strong> (~
                  {Math.round((estimateTemplate?.macros.calories ?? 0) * portionMultiplier)} kcal)
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.25}
                  value={portionMultiplier}
                  onChange={(e) => setPortionMultiplier(Number(e.target.value))}
                  className="w-full accent-emerald"
                />
              </div>

              <Button onClick={handleLogEstimatedMeal} leftIcon={<Plus className="w-4 h-4" />}>
                Add Meal to Today ({activeMealSlot})
              </Button>
            </div>
          </Card>

          <Card variant="elevated" className="p-5 sm:p-6">
            <h2 className="font-heading font-bold text-base text-forest dark:text-white mb-4">
              Meals Logged Today
            </h2>
            <div className="space-y-3">
              {mealsToday.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-forest/4 dark:bg-white/5 text-xs text-forest/70 dark:text-ivory/70">
                  No meals logged yet today. Log one of your recommended meals or add an entry when you eat.
                </div>
              ) : (
                mealsToday.map((meal) => (
                  <div
                    key={meal.id}
                    className="p-3 rounded-2xl border border-forest/10 dark:border-white/10 bg-white/70 dark:bg-white/5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-forest dark:text-white">{meal.name}</p>
                      <p className="text-[11px] text-forest/65 dark:text-ivory/65 capitalize">
                        {meal.mealSlot} · {meal.timeLabel} · {meal.provenanceLabel}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-extrabold text-emerald dark:text-emerald-400">
                        {meal.calories} kcal
                      </p>
                      <p className="text-[10px] text-forest/60 dark:text-ivory/60">
                        {meal.proteinG}g P · {meal.fiberG}g Fib
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
