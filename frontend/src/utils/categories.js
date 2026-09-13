// Category labels, icons and cover art. Events have no uploaded image, so each
// cover is a gradient picked from its category, varied per event by a seed.
export const CATEGORIES = [
  {
    value: 'music', label: 'Music', icon: 'music',
    gradients: ['linear-gradient(135deg, #ff6ec4 0%, #7873f5 100%)', 'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)']
  },
  {
    value: 'food', label: 'Food & drink', icon: 'utensils',
    gradients: ['linear-gradient(135deg, #f7b267 0%, #f25c54 100%)', 'linear-gradient(135deg, #ff9a44 0%, #fc6076 100%)']
  },
  {
    value: 'conference', label: 'Conference', icon: 'mic',
    gradients: ['linear-gradient(135deg, #4facfe 0%, #3a7bd5 100%)', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)']
  },
  {
    value: 'community', label: 'Community', icon: 'users',
    gradients: ['linear-gradient(135deg, #34d399 0%, #0ea5a4 100%)', 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)']
  },
  {
    value: 'film', label: 'Film', icon: 'film',
    gradients: ['linear-gradient(135deg, #fa709a 0%, #f9a14a 100%)', 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)']
  },
  {
    value: 'talk', label: 'Talk', icon: 'message',
    gradients: ['linear-gradient(135deg, #a18cd1 0%, #e98bd5 100%)', 'linear-gradient(135deg, #8e5cff 0%, #e5376b 100%)']
  },
  {
    value: 'other', label: 'Other', icon: 'sparkles',
    gradients: ['linear-gradient(135deg, #89a4bf 0%, #5b6b8c 100%)']
  }
];

const FALLBACK = CATEGORIES[CATEGORIES.length - 1];

export function categoryMeta(value) {
  return CATEGORIES.find((c) => c.value === value) || FALLBACK;
}

export function coverGradient(category, seed = '') {
  const options = categoryMeta(category).gradients;
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return options[hash % options.length];
}
