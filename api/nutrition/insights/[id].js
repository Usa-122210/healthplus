/**
 * Serverless /api/nutrition/insights/[id] endpoint.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const response = {
    baseline: {
      available: true,
      days_logged: 7,
      avg_daily_calories: 1850,
      avg_daily_protein_g: 72,
      avg_daily_carbs_g: 220,
      avg_meals_per_day: 3.2,
      avg_meal_hour: { breakfast: 9, lunch: 13, snack: 17, dinner: 21 },
    },
    today: {
      calories: 795,
      protein_g: 29,
      carbs_g: 122,
      fats_g: 23,
      meals_logged: 2,
    },
    targets: {
      calories: 2000,
      protein_g: 80,
    },
    clusters: {
      available: true,
      clusters: [
        {
          id: 1,
          label: 'Consistent Whole Food Days',
          days: 5,
          avg_calories: 1820,
          avg_protein_g: 78,
          carb_share_pct: 54,
          late_calorie_pct: 12,
          description: 'High adherence to balanced Indian macro targets with timely meals.',
        },
      ],
    },
    patterns: [
      {
        type: 'protein_distribution',
        severity: 'info',
        message: 'Adding paneer or sprouts to breakfast increases satiety by 35% through the afternoon.',
      },
    ],
    generated_at: new Date().toISOString(),
  };

  res.statusCode = 200;
  return res.end(JSON.stringify(response));
};
