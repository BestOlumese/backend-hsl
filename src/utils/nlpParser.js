import { getCountryId } from './countryMapping.js';

export const parseNLQ = (q) => {
    if (!q || typeof q !== 'string') return {};
    
    let query = q.toLowerCase();
    const filters = {};

    if (query.match(/\b(males|male)\b/)) {
        filters.gender = 'male';
    } else if (query.match(/\b(females|female)\b/)) {
        filters.gender = 'female';
    }

    if (query.match(/\b(children|child)\b/)) {
        filters.age_group = 'child';
    } else if (query.match(/\b(teenagers|teenager|teens|teen)\b/)) {
        filters.age_group = 'teenager';
    } else if (query.match(/\b(adults|adult)\b/)) {
        filters.age_group = 'adult';
    } else if (query.match(/\b(seniors|senior)\b/)) {
        filters.age_group = 'senior';
    }

    const fromMatch = query.match(/from\s+([a-z\s]+)/);
    if (fromMatch) {
       let words = fromMatch[1].trim().split(' ');
       for (let len = Math.min(3, words.length); len > 0; len--) {
           const candidate = words.slice(0, len).join(' ');
           const code = getCountryId(candidate);
           if (code) {
               filters.country_id = code;
               break;
           }
       }
    }

    if (query.match(/\byoung\b/)) {
        filters.min_age = 16;
        filters.max_age = 24;
    }

    const aboveMatch = query.match(/\b(above|over|>|older than|greater than)\s+(\d+)\b/);
    if (aboveMatch) {
        filters.min_age = parseInt(aboveMatch[2], 10);
    }
    
    const underMatch = query.match(/\b(under|below|<|younger than|less than)\s+(\d+)\b/);
    if (underMatch) {
        filters.max_age = parseInt(underMatch[2], 10);
    }

    return filters;
};
