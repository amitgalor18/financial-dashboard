export const CATEGORY_PALETTE = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3',
    '#54A0FF', '#F59E0B', '#34D399', '#A855F7', '#F472B6', '#22D3EE',
    '#FB923C', '#84CC16', '#818CF8', '#E879F9', '#2DD4BF', '#FBBF24',
];

// Deterministic string hash so each category name always maps to the same color,
// regardless of which tab renders it or what order the data arrives in.
const hashString = (s: string): number => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
    return h;
};

const assigned = new Map<string, string>();

export const getCategoryColor = (name: string): string => {
    const cached = assigned.get(name);
    if (cached) return cached;

    // Prefer the hashed slot; on collision, probe forward for a free palette color
    const used = new Set(assigned.values());
    const start = hashString(name) % CATEGORY_PALETTE.length;
    let color = CATEGORY_PALETTE[start];
    if (used.size < CATEGORY_PALETTE.length) {
        for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
            const candidate = CATEGORY_PALETTE[(start + i) % CATEGORY_PALETTE.length];
            if (!used.has(candidate)) { color = candidate; break; }
        }
    }
    assigned.set(name, color);
    return color;
};
