/**
 * Serverless /api/nutrition/history/[id] endpoint.
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

  // Provide realistic recent meal logs
  const now = new Date();
  const sampleMeals = [
    {
      id: 'meal-hist-1',
      meal_type: 'lunch',
      confirmed_items: [
        { item: 'Roti / Chapati', quantity: 2, serving_unit: '1 piece', calories: 208, protein_g: 6.4, carbs_g: 40, fats_g: 3.0 },
        { item: 'Dal Tadka', quantity: 1, serving_unit: '1 bowl', calories: 154, protein_g: 9.0, carbs_g: 22, fats_g: 3.5 },
        { item: 'Curd / Plain Dahi', quantity: 1, serving_unit: '1 katori', calories: 98, protein_g: 4.5, carbs_g: 6, fats_g: 6.0 },
      ],
      total_calories: 460,
      total_protein: 20,
      total_carbs: 68,
      total_fats: 13,
      is_anomaly: false,
      bot_feedback: 'Optimal lunch balance with gut-friendly probiotic dahi.',
      logged_at: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: 'meal-hist-2',
      meal_type: 'breakfast',
      confirmed_items: [
        { item: 'Poha with Peanuts', quantity: 1, serving_unit: '1 plate', calories: 260, protein_g: 6.5, carbs_g: 44, fats_g: 7.2 },
        { item: 'Masala Chai (Low Sugar)', quantity: 1, serving_unit: '1 cup', calories: 75, protein_g: 2.0, carbs_g: 10, fats_g: 2.5 },
      ],
      total_calories: 335,
      total_protein: 9,
      total_carbs: 54,
      total_fats: 10,
      is_anomaly: false,
      bot_feedback: 'Good light morning fuel with complex carbs.',
      logged_at: new Date(now.getTime() - 7 * 3600 * 1000).toISOString(),
    },
  ];

  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      meals: sampleMeals,
      total: sampleMeals.length,
      page: 1,
      per_page: 10,
    })
  );
};
