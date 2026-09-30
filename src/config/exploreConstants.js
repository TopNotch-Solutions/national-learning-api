/** Shared explore taxonomy — same simple place fields for every category. */

const NAMIBIA_REGIONS = [
  { id: 'kunene', name: 'Kunene' },
  { id: 'omusati', name: 'Omusati' },
  { id: 'oshana', name: 'Oshana' },
  { id: 'ohangwena', name: 'Ohangwena' },
  { id: 'oshikoto', name: 'Oshikoto' },
  { id: 'kavango-west', name: 'Kavango West' },
  { id: 'kavango-east', name: 'Kavango East' },
  { id: 'zambezi', name: 'Zambezi' },
  { id: 'otjozondjupa', name: 'Otjozondjupa' },
  { id: 'erongo', name: 'Erongo' },
  { id: 'khomas', name: 'Khomas' },
  { id: 'omaheke', name: 'Omaheke' },
  { id: 'hardap', name: 'Hardap' },
  { id: 'karas', name: 'ǁKaras' },
];

const EXPLORE_CATEGORIES = [
  { id: 'geography', number: 1, title: 'Physical Geography & Natural Landscapes' },
  { id: 'culture', number: 2, title: 'Culture' },
  { id: 'history-sites', number: 3, title: 'Historical Sites' },
  { id: 'events', number: 4, title: 'Events & Festivals' },
  { id: 'gastronomy', number: 5, title: 'Gastronomy' },
  { id: 'safety', number: 6, title: 'Safety & Advisory' },
];

const CATEGORY_IDS = new Set(EXPLORE_CATEGORIES.map((c) => c.id));
const REGION_IDS = new Set(NAMIBIA_REGIONS.map((r) => r.id));

module.exports = {
  NAMIBIA_REGIONS,
  EXPLORE_CATEGORIES,
  CATEGORY_IDS,
  REGION_IDS,
};
