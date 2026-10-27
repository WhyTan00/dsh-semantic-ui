/** Shared by the finite capacity source and its bound local control, not generic numeric data. */
export const CAPACITY_DOMAIN={min:0,max:1e12} as const;
export const validCapacityAmount=(value:number)=>Number.isFinite(value)&&value>=CAPACITY_DOMAIN.min&&value<=CAPACITY_DOMAIN.max;
